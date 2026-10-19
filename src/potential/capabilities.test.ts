import { describe, expect, it } from 'vitest';
import type { EvaluatorEntry, KitMechanic } from '../character-build/domain';
import { fixtureStatsEntry } from '../character-build/registry.fixtures';
import { searchBuilds } from '../character-build/search';
import { gokuEntry } from '../data/real/character-build/registry';
import { resolveCapabilities, objectiveCapability } from './capabilities';
import { snapshotProgressions } from './progression';
import { recommend, recommendationGates } from './recommendation';

const withKit = (
  mechanic: keyof EvaluatorEntry['model']['kit'],
  declared: KitMechanic,
  implemented: EvaluatorEntry['evaluator']['mechanics'] = [],
): EvaluatorEntry => ({
  ...gokuEntry,
  model: {
    ...gokuEntry.model,
    kit: { ...gokuEntry.model.kit, [mechanic]: declared },
  },
  evaluator: { ...gokuEntry.evaluator, mechanics: implemented },
});

describe('capabilities resolved before any search', () => {
  it('describes the real Goku state honestly', () => {
    const c = resolveCapabilities(gokuEntry, snapshotProgressions([gokuEntry]));
    expect(c.allocation.documented).toEqual({
      label: '55% · base board filled · no duplicate routes',
      origin: 'fixed-profile',
      choiceNodes: 0,
    });
    expect(c.allocation.full.available).toBe(false);
    expect(c.allocation.full.missing).toContain(
      'Exact selectable node alternatives and increments',
    );
    expect(c.allocation.custom.available).toBe(true);
    expect(c.equipment.map((e) => [e.slot, e.items])).toEqual([
      ['bronze', 3],
      ['silver', 3],
      ['gold', 0],
    ]);
    expect(c.equipment[2]!.reason).toBe(
      'No gold items are recorded for this state.',
    );
    expect(c.objectives.map((o) => [o.metric, o.status])).toEqual([
      ['attack', 'supported'],
      ['defense', 'supported'],
      ['hp', 'supported'],
      ['additionalSuper', 'experimental'],
      ['critical', 'experimental'],
      ['evasion', 'experimental'],
    ]);
    expect(c.counts).toEqual({ supported: 3, experimental: 3, unavailable: 0 });
    expect(c.gaps.map((g) => g.label)).toEqual([
      'Expected damage',
      'Damage taken and survival',
    ]);
  });

  it('an evaluator without custom input or probabilities offers neither', () => {
    const c = resolveCapabilities(
      fixtureStatsEntry,
      snapshotProgressions([fixtureStatsEntry]),
    );
    expect(c.allocation.custom.available).toBe(false);
    expect(c.objectives.map((o) => o.metric)).toEqual([
      'attack',
      'defense',
      'hp',
    ]);
  });
});

describe('kit mechanics that could change the winner', () => {
  it('a present, unmodeled native critical blocks only the critical objective', () => {
    const entry = withKit('nativeCritical', {
      status: 'present',
      evidenceIds: ['eza-kit'],
      note: 'TEST ONLY',
    });
    const critical = objectiveCapability(entry, 'critical');
    expect(critical.status).toBe('unavailable');
    expect(critical.gates[0]!.message).toBe(
      'Native critical-hit chance: part of this kit but not modeled. It could change this result.',
    );
    expect(objectiveCapability(entry, 'evasion').status).toBe('experimental');
    expect(objectiveCapability(entry, 'attack').status).toBe('supported');
  });

  it('an unknown mechanic fails closed with its own reason', () => {
    const entry = withKit('nativeEvasion', {
      status: 'unknown',
      evidenceIds: [],
      note: 'TEST ONLY',
    });
    expect(objectiveCapability(entry, 'evasion').gates[0]!.message).toBe(
      'Native evasion chance: unknown for this state. It could change this result.',
    );
  });

  it('a modeled mechanic does not block', () => {
    const entry = withKit(
      'nativeCritical',
      { status: 'present', evidenceIds: ['eza-kit'], note: 'TEST ONLY' },
      ['nativeCritical'],
    );
    expect(objectiveCapability(entry, 'critical').status).toBe('experimental');
  });

  it('the recommendation refuses a blocked objective instead of answering', async () => {
    const entry = withKit('nativeCritical', {
      status: 'present',
      evidenceIds: ['eza-kit'],
      note: 'TEST ONLY',
    });
    const request = { ...entry.defaults(), objective: 'critical' as const };
    const gates = recommendationGates(
      entry,
      snapshotProgressions([entry]),
      request,
      'selected-profile',
    );
    expect(gates.map((g) => g.code)).toEqual(['kit-mechanic']);
    const out = await searchBuilds(request, entry, {
      maxScanned: 1000,
      cancelled: () => false,
      yieldControl: async () => {},
    });
    const answer = recommend(out, request, 'selected-profile', gates);
    expect(answer.status).toBe('cannot-recommend');
    expect(answer.selected).toBe(null);
  });
});
