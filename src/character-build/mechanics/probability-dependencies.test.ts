import { describe, expect, it } from 'vitest';
import type { Effect } from '../../character-definitions/domain';
import { evaluateSequence } from './evaluation';
import { effect, input, model, rule, scenario } from './mechanics.fixtures';
import { requiredEffects, sequenceObjectiveGates } from './support';

function criticalDependency() {
  const m = model(
    [
      effect('native-critical', {
        family: 'critical',
        unit: 'probability',
        amount: 1,
        timing: 'appearance-start',
        duration: { kind: 'permanent', count: null },
      }),
      effect('critical-followup', { dependencies: ['event:critical'] }),
    ],
    [
      rule('native-critical', {
        event: 'appearance-start',
        operation: { kind: 'critical', combine: 'independent' },
      }),
      rule('critical-followup'),
    ],
  );
  m.coverage[0]!.affects = ['criticalAttacks'];
  m.coverage[1]!.affects = ['expectedAttacks'];
  return m;
}
function incomingDependency(condition?: Effect['condition']) {
  const m = model(
    [
      effect('native-evasion', {
        family: 'evasion',
        unit: 'probability',
        amount: 0.5,
        timing: 'appearance-start',
        duration: { kind: 'permanent', count: null },
      }),
      effect('hit-gain', {
        family: 'percent-stat',
        stat: 'defense',
        unit: 'percent',
        amount: 50,
        timing: 'after-hit',
        duration: { kind: 'permanent', count: null },
        condition: condition ?? { kind: 'always' },
      }),
    ],
    [
      rule('native-evasion', {
        event: 'appearance-start',
        operation: { kind: 'evasion', combine: 'independent' },
      }),
      rule('hit-gain', {
        event: 'after-hit',
        operation: { kind: 'raise', group: 'test-only:hit-gain' },
      }),
    ],
  );
  m.coverage[0]!.affects = ['evadedAttacks'];
  m.coverage[1]!.affects = ['defenseRaise'];
  const s = scenario({
    actions: [
      { kind: 'incoming', evadable: true, damageOnHit: 0, guarded: false },
    ],
  });
  return { m, s };
}

describe('transitive native probability providers', () => {
  it('includes native critical for a critical-dependent count objective', () => {
    const m = criticalDependency();
    expect(requiredEffects(m, scenario(), ['expectedAttacks'])).toContain(
      'native-critical',
    );
    const r = evaluateSequence(m, input(m), ['expectedAttacks']);
    expect(r.status).toBe('evaluated');
    expect(r.metrics.expectedAttacks).toBe(2);
  });
  it('fails closed when the native critical provider is recorded but unmodeled', () => {
    const m = criticalDependency();
    m.rules.shift();
    expect(
      sequenceObjectiveGates(m, scenario(), 'expectedAttacks').join(' '),
    ).toContain('native-critical');
  });
  it('keeps unknown critical overlap gated for a count objective', () => {
    const m = criticalDependency();
    m.potential.critical = 'unknown';
    expect(
      evaluateSequence(m, input(m), ['expectedAttacks']).status,
    ).toBe('unavailable');
  });
  it('includes evasion for hit-triggered effects when damage is zero', () => {
    const { m, s } = incomingDependency();
    expect(requiredEffects(m, s, ['defenseRaise'])).toContain('native-evasion');
    const r = evaluateSequence(m, input(m, { scenario: s }), ['defenseRaise']);
    expect(r.status).toBe('evaluated');
    expect(r.metrics.defenseRaise).toBe(0.25);
    expect(r.probabilityMass).toBeCloseTo(1, 12);
  });
  it('includes evasion when hit-counter conditions have no event dependency', () => {
    const { m, s } = incomingDependency({
      kind: 'threshold',
      field: 'attacksReceived',
      operator: '>=',
      value: 1,
    });
    const r = evaluateSequence(m, input(m, { scenario: s }), ['defenseRaise']);
    expect(r.status).toBe('evaluated');
    expect(r.metrics.defenseRaise).toBe(0.25);
  });
  it('blocks unknown evasion overlap for zero-damage incoming events', () => {
    const { m, s } = incomingDependency();
    m.potential.evasion = 'unknown';
    expect(
      evaluateSequence(m, input(m, { scenario: s }), ['defenseRaise']).status,
    ).toBe('unavailable');
  });
  it('blocks a missing native evasion implementation for a dependent objective', () => {
    const { m, s } = incomingDependency();
    m.rules.shift();
    expect(sequenceObjectiveGates(m, s, 'defenseRaise').join(' ')).toContain(
      'native-evasion',
    );
  });
  it('does not add unrelated native providers to an attack-only context', () => {
    const m = model([
      effect('unrelated', {
        family: 'evasion',
        representation: 'recorded-only',
      }),
    ]);
    m.coverage[0]!.affects = ['evadedAttacks'];
    expect(requiredEffects(m, scenario(), ['expectedAttacks']).size).toBe(0);
  });
});
