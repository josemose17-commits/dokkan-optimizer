import { describe, expect, it } from 'vitest';
import type { Effect } from '../../character-definitions/domain';
import { evaluateSequence } from './evaluation';
import { effect, input, model, rule, scenario } from './mechanics.fixtures';
import {
  inspectSequenceEffect,
  sequenceModelErrors,
  sequenceObjectiveGates,
} from './support';
import type { Rule, SequenceResult } from './domain';

const evaluated = (r: SequenceResult) => {
  expect(r.status, JSON.stringify(r.reasons)).toBe('evaluated');
  if (r.status !== 'evaluated') throw new Error(r.reasons.join('; '));
  return r;
};
const raise = (id: string, values: Partial<Effect> = {}) =>
  effect(id, {
    family: 'percent-stat',
    stat: 'defense',
    unit: 'percent',
    amount: 50,
    stacking: 'additive',
    duration: { kind: 'permanent', count: null },
    ...values,
  });
const raiseRule = (id: string, values: Partial<Rule> = {}) =>
  rule(id, {
    operation: { kind: 'raise', group: 'test-only:super' },
    maxAttemptsPerTurn: 16,
    ...values,
  });
function chanceModel(family: 'critical' | 'evasion', chance: number) {
  return model(
    [
      effect(family, {
        family,
        unit: 'probability',
        amount: chance,
        timing: 'appearance-start',
        duration: { kind: 'permanent', count: null },
      }),
    ],
    [
      rule(family, {
        event: 'appearance-start',
        operation: { kind: family, combine: 'independent' },
      }),
    ],
  );
}

describe('event-sequence-v1 probability arithmetic (independent expected values)', () => {
  it('combines a native additional chain with one potential release, not a per-chain constant', () => {
    const m = model(
      [effect('native')],
      [
        rule('native', {
          operation: {
            kind: 'additional',
            chance: 0.6,
            superChance: 1,
            superKind: '12-ki',
          },
        }),
      ],
    );
    const r = evaluated(
      evaluateSequence(
        m,
        input(m, { skills: { additional: 10, critical: 0, evasion: 0 } }),
      ),
    );
    // N=1 with p=.4, N=2 with p=.6. P(HP AA)=.4*.2+.6*(1-.8^2)=.296.
    expect(r.metrics.expectedAttacks).toBeCloseTo(1.896, 12);
    expect(r.metrics.expectedSupers).toBeCloseTo(1.748, 12);
    expect(r.probabilityMass).toBeCloseTo(1, 12);
    expect(r.branches.every((b) => b.totals.attacks <= 3)).toBe(true);
  });
  it('keeps dependent native activations local to their successful parent branch', () => {
    const m = model(
      [effect('first'), effect('dependent', { dependencies: ['first'] })],
      ['first', 'dependent'].map((id) =>
        rule(id, {
          operation: {
            kind: 'additional',
            chance: 0.5,
            superChance: 1,
            superKind: '12-ki',
          },
        }),
      ),
    );
    const r = evaluated(evaluateSequence(m, input(m)));
    expect(r.metrics.expectedAttacks).toBe(1.75);
    expect(
      r.branches
        .filter((b) => b.totals.attacks === 1)
        .reduce((p, b) => p + b.probability, 0),
    ).toBe(0.5);
    expect(
      r.branches
        .filter((b) => b.totals.attacks === 3)
        .reduce((p, b) => p + b.probability, 0),
    ).toBe(0.25);
    expect(
      r.branches
        .filter((b) => !b.activated.includes('first'))
        .every((b) => !b.activated.includes('dependent')),
    ).toBe(true);
  });
  it('does not retry a failed once-per-turn native roll on a later attack', () => {
    const m = model(
      [effect('native'), effect('always')],
      [
        rule('native', {
          operation: {
            kind: 'additional',
            chance: 0.5,
            superChance: 0,
            superKind: '12-ki',
          },
        }),
        rule('always'),
      ],
    );
    const r = evaluated(evaluateSequence(m, input(m)));
    expect(r.metrics.expectedAttacks).toBe(2.5);
    expect(r.branches.every((b) => b.attempts.native === 1)).toBe(true);
  });
  it('combines explicitly independent native and potential critical checks', () => {
    const m = chanceModel('critical', 0.5);
    const r = evaluated(
      evaluateSequence(
        m,
        input(m, { skills: { additional: 0, critical: 10, evasion: 0 } }),
      ),
    );
    expect(r.metrics.criticalAttacks).toBeCloseTo(0.6, 12); // 1-.5*.8
  });
  it('combines native and potential evasion, and honors disabled attacks', () => {
    const m = chanceModel('evasion', 0.7);
    const i = input(m, {
      scenario: scenario({
        actions: [
          { kind: 'incoming', evadable: true, damageOnHit: 0, guarded: false },
        ],
      }),
      skills: { additional: 0, critical: 0, evasion: 10 },
    });
    expect(evaluated(evaluateSequence(m, i)).metrics.evadedAttacks).toBeCloseTo(
      0.73,
      12,
    );
    expect(
      evaluated(evaluateSequence(m, { ...i, evasionAllowed: false })).metrics
        .evadedAttacks,
    ).toBe(0);
    i.scenario.actions = [
      { kind: 'incoming', evadable: false, damageOnHit: 0, guarded: false },
    ];
    expect(evaluated(evaluateSequence(m, i)).metrics.evadedAttacks).toBe(0);
  });
  it('keeps a guarantee at 100% without consuming a zero-probability branch', () => {
    const m = chanceModel('critical', 1);
    const r = evaluated(
      evaluateSequence(
        m,
        input(m, { skills: { additional: 0, critical: 40, evasion: 0 } }),
      ),
    );
    expect(r.branches).toHaveLength(1);
    expect(r.metrics.criticalAttacks).toBe(1);
  });
  it('tracks evasion-triggered buildup per branch for the next incoming attack', () => {
    const base = effect('base', {
      family: 'evasion',
      amount: 0.5,
      unit: 'probability',
      timing: 'appearance-start',
      duration: { kind: 'permanent', count: null },
    });
    const gain = effect('gain', {
      family: 'evasion',
      amount: 0.1,
      unit: 'probability',
      timing: 'after-evade',
      stacking: 'additive',
      cap: 0.5,
      duration: { kind: 'turns', count: 1 },
    });
    const m = model(
      [base, gain],
      [
        rule('base', {
          event: 'appearance-start',
          operation: { kind: 'evasion', combine: 'additive' },
        }),
        rule('gain', {
          event: 'after-evade',
          operation: { kind: 'evasion', combine: 'additive' },
          maxAttemptsPerTurn: 16,
        }),
      ],
    );
    const r = evaluated(
      evaluateSequence(
        m,
        input(m, {
          scenario: scenario({
            actions: Array.from({ length: 2 }, () => ({
              kind: 'incoming',
              evadable: true,
              damageOnHit: 0,
              guarded: false,
            })),
          }),
        }),
      ),
    );
    expect(r.metrics.evadedAttacks).toBeCloseTo(1.05, 12); // .5 + .5*.6 + .5*.5
    expect(
      r.branches.find((b) => b.totals.evaded === 2)?.probability,
    ).toBeCloseTo(0.3, 12);
  });
  it('records effective-against-all-types separately from critical damage', () => {
    const m = chanceModel('critical', 1);
    m.abilities[0]!.effects.push(
      effect('effective', {
        family: 'type-effectiveness',
        amount: 1,
        unit: 'probability',
        timing: 'attack-activation',
      }),
    );
    m.rules.push(
      rule('effective', {
        event: 'attack-activation',
        operation: { kind: 'effective' },
      }),
    );
    m.coverage.push({ ...m.coverage[0]!, effectId: 'effective' });
    const r = evaluated(evaluateSequence(m, input(m)));
    expect(r.metrics.effectiveAttacks).toBe(1);
    expect(r.metrics.criticalAttacks).toBe(1);
    expect('damage' in r.metrics).toBe(false);
  });
});

describe('event order, lifetimes and completed counters', () => {
  it('separates start-of-turn, on-attack and Super groups under the declared effect algebra', () => {
    const m = model(
      [
        raise('start', {
          stat: 'attack',
          amount: 100,
          timing: 'start-of-turn',
          stacking: 'once',
        }),
        raise('on-attack', {
          stat: 'attack',
          amount: 100,
          timing: 'attack-activation',
          stacking: 'once',
        }),
        raise('super', {
          stat: 'attack',
          amount: 50,
          timing: 'super-activation',
        }),
      ],
      [
        raiseRule('start', {
          event: 'start-of-turn',
          operation: { kind: 'raise', group: 'start' },
        }),
        raiseRule('on-attack', {
          event: 'attack-activation',
          operation: { kind: 'raise', group: 'on-attack' },
        }),
        raiseRule('super', { event: 'super-activation' }),
      ],
    );
    const b = evaluated(evaluateSequence(m, input(m))).branches[0]!;
    expect(b.trace.find((e) => e.event === 'before-attack')!.attackFactor).toBe(
      2,
    );
    expect(
      b.trace.find((e) => e.event === 'attack-activation')!.attackFactor,
    ).toBe(4);
    expect(
      b.trace.find((e) => e.event === 'damage-calculation')!.attackFactor,
    ).toBe(6);
  });
  it('counts a threshold only in branches whose earlier native attack actually completed', () => {
    const m = model(
      [
        effect('coin'),
        effect('three', {
          condition: {
            kind: 'threshold',
            field: 'attacksPerformed',
            operator: '>=',
            value: 3,
          },
        }),
      ],
      [
        rule('coin', {
          operation: {
            kind: 'additional',
            chance: 0.5,
            superChance: 1,
            superKind: '12-ki',
          },
        }),
        rule('three'),
      ],
    );
    const s = scenario();
    s.initial.values.attacksPerformed = 1;
    const r = evaluated(evaluateSequence(m, input(m, { scenario: s })));
    expect(r.metrics.expectedAttacks).toBe(2);
    expect(r.branches.find((b) => b.totals.attacks === 1)!.probability).toBe(
      0.5,
    );
    expect(r.branches.find((b) => b.totals.attacks === 3)!.probability).toBe(
      0.5,
    );
  });
  it('a three-turn buff includes its activation turn and expires before turn four', () => {
    const m = model(
      [
        raise('temporary', {
          stat: 'attack',
          timing: 'start-of-turn',
          duration: { kind: 'turns', count: 3 },
          stacking: 'once',
        }),
      ],
      [raiseRule('temporary', { event: 'start-of-turn', maxActivations: 1 })],
    );
    const s = scenario({
      actions: [{ kind: 'advance', battleTurn: 3, appearance: 2, values: {} }],
    });
    expect(
      evaluated(evaluateSequence(m, input(m, { scenario: s }))).metrics
        .attackRaise,
    ).toBe(0.5);
    s.actions.push({
      kind: 'advance',
      battleTurn: 4,
      appearance: 3,
      values: {},
    });
    expect(
      evaluated(evaluateSequence(m, input(m, { scenario: s }))).metrics
        .attackRaise,
    ).toBe(0);
  });
  it('uses updated HP conditions after a hit and refuses to reuse a stale percentage without max HP', () => {
    const m = model(
      [
        raise('low-hp', {
          timing: 'after-hit',
          condition: {
            kind: 'threshold',
            field: 'hpPercent',
            operator: '<',
            value: 50,
          },
        }),
      ],
      [raiseRule('low-hp', { event: 'after-hit' })],
    );
    const s = scenario({
      actions: [
        { kind: 'incoming', evadable: false, damageOnHit: 60, guarded: false },
      ],
    });
    expect(
      evaluated(evaluateSequence(m, input(m, { scenario: s }))).metrics
        .defenseRaise,
    ).toBe(0.5);
    s.maxHp = null;
    const r = evaluateSequence(m, input(m, { scenario: s }));
    expect(r.status).toBe('unavailable');
    expect(r.reasons.join(' ')).toContain('unspecified');
  });
  it('applies an 18-Ki Super raise before its damage and a 12-Ki raise only to the additional Super', () => {
    const filter = (kind: '12-ki' | '18-ki') => ({
      sources: ['initial', 'native', 'potential'] as const,
      kinds: [kind],
    });
    const m = model(
      [
        raise('18', {
          stat: 'attack',
          amount: 100,
          timing: 'super-activation',
          duration: { kind: 'turns', count: 1 },
        }),
        raise('12', {
          stat: 'attack',
          amount: 50,
          timing: 'super-activation',
          duration: { kind: 'turns', count: 1 },
        }),
        effect('native'),
      ],
      [
        raiseRule('18', {
          event: 'super-activation',
          attack: { sources: [...filter('18-ki').sources], kinds: ['18-ki'] },
        }),
        raiseRule('12', {
          event: 'super-activation',
          attack: { sources: [...filter('12-ki').sources], kinds: ['12-ki'] },
        }),
        rule('native'),
      ],
    );
    const r = evaluated(
      evaluateSequence(
        m,
        input(m, {
          scenario: scenario({
            actions: [
              { kind: 'attack', attack: '18-ki', ki: 18, enemySurvives: true },
            ],
          }),
        }),
      ),
    );
    const damage = r.branches[0]!.trace.filter(
      (e) => e.event === 'damage-calculation',
    );
    expect(damage.map((e) => [e.attack?.kind, e.attackFactor])).toEqual([
      ['18-ki', 2],
      ['12-ki', 2.5],
    ]);
    expect(
      r.branches[0]!.trace.find((e) => e.event === 'before-attack')!
        .attackFactor,
    ).toBe(1);
  });
  it('does not apply an after-attack benefit to that attack or to earlier defense', () => {
    const m = model(
      [raise('gain', { amount: 20 }), effect('native')],
      [raiseRule('gain'), rule('native')],
    );
    const b = evaluated(evaluateSequence(m, input(m))).branches[0]!;
    expect(
      b.trace
        .filter((e) => e.event === 'damage-calculation')
        .map((e) => e.defenseFactor),
    ).toEqual([1, 1.2]);
    expect(b.buffs.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(0.4, 12);
  });
  it('uses completed attacks to unlock a dependent attack within the same turn', () => {
    const m = model(
      [
        effect('threshold', {
          condition: {
            kind: 'threshold',
            field: 'attacksPerformed',
            operator: '>=',
            value: 3,
          },
        }),
      ],
      [rule('threshold')],
    );
    const s = scenario();
    s.initial.values.attacksPerformed = 2;
    const r = evaluated(evaluateSequence(m, input(m, { scenario: s })));
    expect(r.metrics.expectedAttacks).toBe(2);
    expect(r.branches[0]!.counters.attacksPerformed).toBe(4);
    expect(
      r.branches[0]!.trace.find((e) => e.effectIds.includes('threshold'))!
        .counters.attacksPerformed,
    ).toBe(3);
  });
  it('expires one-turn buffs before a later appearance, while permanent raises persist', () => {
    const m = model(
      [
        raise('temporary', {
          timing: 'super-activation',
          duration: { kind: 'turns', count: 1 },
        }),
        raise('permanent', { timing: 'super-activation', amount: 30 }),
      ],
      [
        raiseRule('temporary', { event: 'super-activation' }),
        raiseRule('permanent', { event: 'super-activation' }),
      ],
    );
    const s = scenario();
    s.actions.push({
      kind: 'advance',
      battleTurn: 3,
      appearance: 2,
      values: {},
    });
    const r = evaluated(evaluateSequence(m, input(m, { scenario: s })));
    expect(r.metrics.defenseRaise).toBeCloseTo(0.3, 12);
    expect(r.branches[0]!.buffs.map((b) => b.effectId)).toEqual(['permanent']);
  });
  it('counts appearance lifetimes separately from elapsed off-rotation turns', () => {
    const m = model(
      [
        raise('two-appearances', {
          timing: 'super-activation',
          duration: { kind: 'appearances', count: 2 },
        }),
      ],
      [raiseRule('two-appearances', { event: 'super-activation' })],
    );
    const s = scenario();
    s.actions.push(
      { kind: 'advance', battleTurn: 4, appearance: 1, values: {} },
      { kind: 'advance', battleTurn: 6, appearance: 2, values: {} },
    );
    expect(
      evaluated(evaluateSequence(m, input(m, { scenario: s }))).metrics
        .defenseRaise,
    ).toBe(0.5);
    s.actions.push({
      kind: 'advance',
      battleTurn: 8,
      appearance: 3,
      values: {},
    });
    expect(
      evaluated(evaluateSequence(m, input(m, { scenario: s }))).metrics
        .defenseRaise,
    ).toBe(0);
  });
  it('caps hit-triggered permanent buildup and activates guard dependencies only after a guarded hit', () => {
    const m = model(
      [
        raise('guard-gain', {
          amount: 30,
          timing: 'after-hit',
          cap: 50,
          dependencies: ['event:guard'],
        }),
      ],
      [raiseRule('guard-gain', { event: 'after-hit' })],
    );
    const s = scenario({
      actions: [
        { kind: 'incoming', evadable: false, damageOnHit: 1, guarded: false },
        ...Array.from({ length: 3 }, () => ({
          kind: 'incoming' as const,
          evadable: false,
          damageOnHit: 1,
          guarded: true,
        })),
      ],
    });
    const r = evaluated(evaluateSequence(m, input(m, { scenario: s })));
    expect(r.metrics.defenseRaise).toBe(0.5);
    expect(r.branches[0]!.counters.attacksReceived).toBe(4);
    expect(
      r.branches[0]!.trace.find((e) => e.event === 'before-hit')!.defenseFactor,
    ).toBe(1);
  });
  it('stops dead branches before later attacks, hit-trigger buffs and scheduled events', () => {
    const m = chanceModel('evasion', 0.5);
    m.abilities[0]!.effects.push(raise('gain', { timing: 'after-hit' }));
    m.rules.push(raiseRule('gain', { event: 'after-hit' }));
    m.coverage.push({ ...m.coverage[0]!, effectId: 'gain' });
    const s = scenario({
      hp: 1,
      maxHp: 1,
      actions: [
        { kind: 'incoming', evadable: true, damageOnHit: 1, guarded: true },
        { kind: 'attack', attack: '12-ki', ki: 12, enemySurvives: true },
      ],
    });
    const r = evaluated(evaluateSequence(m, input(m, { scenario: s })));
    expect(r.metrics.expectedAttacks).toBe(0.5);
    const dead = r.branches.find((b) => !b.alive)!;
    expect(dead.totals.attacks).toBe(0);
    expect(dead.buffs.some((b) => b.effectId === 'gain')).toBe(false);
    expect(dead.trace.at(-1)!.note).toContain('lethal');
  });
  it('does not release native or potential attacks after a supplied enemy kill', () => {
    const m = model([effect('native')], [rule('native')]);
    const s = scenario({
      actions: [
        { kind: 'attack', attack: '12-ki', ki: 12, enemySurvives: false },
      ],
    });
    const r = evaluated(
      evaluateSequence(
        m,
        input(m, {
          scenario: s,
          skills: { additional: 40, critical: 0, evasion: 0 },
        }),
      ),
    );
    expect(r.metrics.expectedAttacks).toBe(1);
    expect(r.branches.every((b) => !b.enemyAlive)).toBe(true);
    expect(r.branches.every((b) => b.pending.length === 0)).toBe(true);
    s.actions.push(
      { kind: 'incoming', evadable: false, damageOnHit: 100, guarded: false },
      { kind: 'advance', battleTurn: 3, appearance: 2, values: {} },
    );
    const terminal = evaluated(evaluateSequence(m, input(m, { scenario: s })));
    expect(
      terminal.branches.every(
        (b) =>
          b.alive && b.turn === 1 && b.trace.at(-1)!.event === 'after-attack',
      ),
    ).toBe(true);
  });
  it('does not mutate a scenario or model while enumerating branches', () => {
    const m = chanceModel('critical', 0.5),
      i = input(m),
      before = JSON.stringify([m, i]);
    evaluated(evaluateSequence(m, i));
    expect(JSON.stringify([m, i])).toBe(before);
  });
});

describe('effect coverage, schema and budget gates', () => {
  it('blocks unmodeled transitive dependencies and rejects activation cycles', () => {
    const m = model(
      [
        effect('first', { representation: 'recorded-only' }),
        effect('dependent', { dependencies: ['first'] }),
      ],
      [rule('dependent')],
    );
    m.coverage[0]!.affects = ['effectiveAttacks'];
    expect(
      sequenceObjectiveGates(m, scenario(), 'expectedSupers').join(' '),
    ).toContain('first');
    m.abilities[0]!.effects[0]!.representation = 'structured';
    m.abilities[0]!.effects[0]!.dependencies = ['dependent'];
    m.rules.push(rule('first'));
    expect(sequenceModelErrors(m).join(' ')).toContain('Cyclic');
  });
  it('keeps recorded, structured, implemented and supported context distinct', () => {
    const e = raise('unknown', {
      timing: 'after-hit',
      condition: { kind: 'other', description: 'not established' },
    });
    const support = inspectSequenceEffect(
      e,
      raiseRule('unknown', { event: 'after-hit' }),
    );
    expect([
      support.recorded,
      support.structured,
      support.implemented,
      support.supported,
    ]).toEqual([true, true, true, false]);
  });
  it('blocks essential unmodeled effects and keeps other metrics null when not requested', () => {
    const m = model([effect('unknown', { representation: 'recorded-only' })]);
    m.coverage[0]!.affects = ['expectedAttacks'];
    expect(
      sequenceObjectiveGates(m, scenario(), 'expectedAttacks').join(' '),
    ).toContain('unmodeled');
    const r = evaluated(evaluateSequence(m, input(m), ['evadedAttacks']));
    expect(r.metrics.expectedAttacks).toBeNull();
    expect(r.metrics.evadedAttacks).toBe(0);
  });
  it('does not convert unknown activation or resolved death into zero', () => {
    const m = model(
      [
        raise('unknown', {
          condition: {
            kind: 'threshold',
            field: 'collectedOrbs',
            operator: '>=',
            value: 1,
          },
        }),
      ],
      [raiseRule('unknown')],
    );
    expect(evaluateSequence(m, input(m)).status).toBe('unavailable');
    const empty = model(),
      s = scenario({
        actions: [
          {
            kind: 'incoming',
            evadable: true,
            damageOnHit: null,
            guarded: false,
          },
        ],
      });
    const r = evaluateSequence(empty, input(empty, { scenario: s }));
    expect(r.status).toBe('unavailable');
    expect(r.metrics.expectedAttacks).toBeNull();
  });
  it.each(['maxBranches', 'maxEvents'] as const)(
    'fails closed at the %s budget, without renormalizing a truncated subset',
    (key) => {
      const m = chanceModel('critical', 0.5),
        i = input(m, { [key]: 1 });
      const r = evaluateSequence(m, i);
      expect(r.status).toBe('unavailable');
      expect(r.branches).toEqual([]);
      expect(r.probabilityMass).toBeNull();
    },
  );
  it('rejects unknown versions, state substitution, invalid probability, duplicate rules and unknown dependencies', () => {
    const m = model([effect('native')], [rule('native')]);
    expect(
      evaluateSequence(m, { ...input(m), modelRevision: 'wrong' }).status,
    ).toBe('unavailable');
    const wrong = input(m);
    wrong.scenario.initial.state = 'another-state';
    expect(evaluateSequence(m, wrong).status).toBe('unavailable');
    m.rules.push(rule('native'));
    expect(sequenceModelErrors(m).join(' ')).toContain('Duplicate');
    m.rules.pop();
    m.rules[0]!.operation = {
      kind: 'additional',
      chance: 1.01,
      superChance: 1,
      superKind: '12-ki',
    };
    expect(sequenceModelErrors(m).join(' ')).toContain('[0, 1]');
    m.abilities[0]!.effects[0]!.dependencies = ['unknown-effect'];
    expect(sequenceModelErrors(m).join(' ')).toContain(
      'Unknown activation dependency',
    );
  });
  it('does not clamp an unknown additive overlap convention', () => {
    const a = effect('a', {
      family: 'critical',
      unit: 'probability',
      amount: 0.7,
      timing: 'appearance-start',
      duration: { kind: 'permanent', count: null },
    });
    const m = model(
      [a, { ...a, id: 'b' }],
      ['a', 'b'].map((id) =>
        rule(id, {
          event: 'appearance-start',
          operation: { kind: 'critical', combine: 'additive' },
        }),
      ),
    );
    expect(evaluateSequence(m, input(m)).status).toBe('unavailable');
  });
});
