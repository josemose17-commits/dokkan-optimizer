import { describe, expect, it } from 'vitest';
import {
  CARD_STATE_ID,
  defaultRequest,
} from '../data/real/character-build/goku';
import {
  gokuEntry,
  productionRegistry,
} from '../data/real/character-build/registry';
import { validateCatalog } from '../character-data/validation';
import { compareBuilds } from './comparison';
import type { EvaluatorEntry } from './domain';
import { estimateCandidateSpace, generateBuilds } from './generation';
import { requestErrors } from './legality';
import { buildStatus, createSavedBuild } from './library';
import {
  FIXTURE_BORROWING_STATE,
  FIXTURE_MISSING_STATE,
  FIXTURE_NODE_STATE,
  FIXTURE_STATS_STATE,
  FIXTURE_UNSUPPORTED_STATE,
  fixtureNodeEntry,
  fixtureNodeRequest,
  fixtureStatsEntry,
  fixtureStatsRequest,
  registryFixtureSnapshot,
} from './registry.fixtures';
import {
  optimizableStates,
  registryErrors,
  resolveEvaluator,
} from './registry';
import { loadCharacterState, saveCharacterState } from './storage';

// TEST ONLY fixtures: fictional characters used to prove isolation. Expected
// values below are worked out by hand from the fixture definitions.
const registry: EvaluatorEntry[] = [
  gokuEntry,
  fixtureNodeEntry,
  fixtureStatsEntry,
];
const snapshot = registryFixtureSnapshot();
function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('registry resolution', () => {
  it('uses a structurally valid TEST ONLY catalog that normal validation rejects', () => {
    expect(validateCatalog(snapshot, { allowTestFixtures: true }).ok).toBe(
      true,
    );
    expect(validateCatalog(snapshot).ok).toBe(false);
  });
  it('ships one production entry, bound to the admitted Goku state and its original key', () => {
    expect(registryErrors(productionRegistry)).toEqual([]);
    expect(
      productionRegistry.map((e) => [e.id, e.stateId, e.storageKey]),
    ).toEqual([
      [
        'goku-initial-check-v1',
        'global-en:1003211:eza-7:lv140:sa15',
        'dokkan.character-builds.v1',
      ],
    ]);
    expect(JSON.stringify(productionRegistry)).not.toContain('test-only');
  });
  it('selects each state’s own evaluator by the catalog’s evaluator ID', () => {
    const pick = (id: string) => {
      const r = resolveEvaluator(registry, snapshot, id);
      return r.ok ? [r.entry.id, r.state.id] : r.code;
    };
    expect(pick(CARD_STATE_ID)).toEqual([
      'goku-initial-check-v1',
      CARD_STATE_ID,
    ]);
    expect(pick(FIXTURE_NODE_STATE)).toEqual([
      'test-only-node-v1',
      FIXTURE_NODE_STATE,
    ]);
    expect(pick(FIXTURE_STATS_STATE)).toEqual([
      'test-only-stats-v1',
      FIXTURE_STATS_STATE,
    ]);
    // A declared alias resolves to the canonical state, then its evaluator.
    expect(pick('test-only-node-alias')).toEqual([
      'test-only-node-v1',
      FIXTURE_NODE_STATE,
    ]);
  });
  it.each([
    [
      'an unknown state',
      'test-only:not-in-catalog',
      'unknown-state',
      'not in this catalog',
    ],
    [
      'a state without support',
      FIXTURE_UNSUPPORTED_STATE,
      'not-supported',
      'TEST ONLY — no evaluator admitted for this state.',
    ],
    [
      'an evaluator ID with no implementation',
      FIXTURE_MISSING_STATE,
      'no-implementation',
      'test-only-missing-v1',
    ],
    [
      'a state naming another state’s evaluator',
      FIXTURE_BORROWING_STATE,
      'binding-mismatch',
      'never reused',
    ],
  ])(
    'refuses %s with its exact reason and no fallback',
    (_label, id, code, reason) => {
      const r = resolveEvaluator(registry, snapshot, id);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.code).toBe(code);
      expect(r.reason).toContain(reason);
      expect('entry' in r).toBe(false);
    },
  );
  it('refuses an evaluator whose data disagrees with the catalog state', () => {
    const skewed: EvaluatorEntry = {
      ...fixtureNodeEntry,
      model: {
        ...fixtureNodeEntry.model,
        card: { ...fixtureNodeEntry.model.card, level: 99 },
      },
    };
    const r = resolveEvaluator(
      [gokuEntry, skewed],
      snapshot,
      FIXTURE_NODE_STATE,
    );
    expect(r.ok || [r.code, r.reason.includes('level')]).toEqual([
      'data-mismatch',
      true,
    ]);
  });
  it.each([
    ['evaluator ID', { stateId: 'test-only:another-state', storageKey: 'k1' }],
    ['state binding', { id: 'test-only-copy', storageKey: 'k2' }],
    ['working-settings key', { id: 'test-only-copy', stateId: 'test-only:x' }],
  ])('refuses a registry with a duplicate %s', (what, overrides) => {
    const duplicate = { ...fixtureNodeEntry, ...overrides };
    expect(registryErrors([fixtureNodeEntry, duplicate]).join(' ')).toContain(
      `Duplicate ${what}`,
    );
    const r = resolveEvaluator(
      [fixtureNodeEntry, duplicate],
      snapshot,
      FIXTURE_NODE_STATE,
    );
    expect(r.ok || r.code).toBe('invalid-registry');
  });
  it('fails closed when an entry lacks the rule evidence its implementation needs', () => {
    const missing: EvaluatorEntry = {
      ...fixtureNodeEntry,
      model: {
        ...fixtureNodeEntry.model,
        evidence: fixtureNodeEntry.model.evidence.filter(
          (e) => e.id !== 'critical-check',
        ),
      },
    };
    expect(registryErrors([missing]).join(' ')).toContain(
      'lacks the "critical-check" rule evidence',
    );
    expect(requestErrors(fixtureNodeRequest(), missing).length).toBeGreaterThan(
      0,
    );
  });
  it('lists only states that resolve', () => {
    expect(
      optimizableStates(registry, snapshot).map((r) => r.entry.id),
    ).toEqual([
      'goku-initial-check-v1',
      'test-only-node-v1',
      'test-only-stats-v1',
    ]);
    expect(
      optimizableStates([gokuEntry], snapshot).map((r) => r.entry.id),
    ).toEqual(['goku-initial-check-v1']);
  });
});

describe('isolation between characters', () => {
  it('rejects one state’s settings in another state’s evaluator', () => {
    expect(
      requestErrors(defaultRequest(), fixtureNodeEntry).join(' '),
    ).toContain(`Settings are for ${CARD_STATE_ID}`);
    expect(requestErrors(fixtureNodeRequest(), gokuEntry).join(' ')).toContain(
      `Settings are for ${FIXTURE_NODE_STATE}`,
    );
    expect(compareBuilds(defaultRequest(), fixtureNodeEntry).groups).toEqual(
      [],
    );
  });
  it('takes objectives and context options from the entry', () => {
    const stats = fixtureStatsRequest();
    stats.objective = 'critical';
    expect(requestErrors(stats, fixtureStatsEntry)).toContain(
      'Unsupported objective.',
    );
    const frontier = fixtureStatsRequest();
    frontier.frontierMetrics = ['hp', 'critical'];
    expect(requestErrors(frontier, fixtureStatsEntry)).toContain(
      'Select distinct supported frontier metrics.',
    );
    const node = fixtureNodeRequest();
    node.context.evasionAllowed = false;
    expect(requestErrors(node, fixtureNodeEntry).join(' ')).toContain(
      'Unsupported context option',
    );
    // The same options are valid for the production Goku entry.
    const goku = defaultRequest();
    goku.context.evasionAllowed = false;
    expect(requestErrors(goku, gokuEntry)).toEqual([]);
  });
  it('evaluates the second character from its own data (hand-computed)', () => {
    const request = fixtureNodeRequest();
    const build = {
      choices: { 'test-only-node-a': 'evasion' as const },
      equips: {
        bronze: 'test-only:bronze:attack',
        silver: 'test-only:silver:additional',
        gold: 'test-only:gold:critical',
      },
    };
    const e = fixtureNodeEntry.evaluator.evaluate(
      build,
      request,
      fixtureNodeEntry,
    );
    // Stats: base 1000/2000/500 + profile 100/200/300 + bronze ATK 50.
    expect(e.stats).toEqual({ hp: 1100, attack: 2250, defense: 800 });
    // Skills: fixed AA1/crit2/eva3; node +2 evasion; silver AA+1; gold crit+3.
    expect(e.skills).toEqual({ additional: 2, critical: 5, evasion: 5 });
    expect(e.metrics.additionalTrigger.value).toBeCloseTo(0.04, 12);
    expect(e.metrics.additionalSuper.value).toBeCloseTo(0.02, 12);
    expect(e.metrics.critical.value).toBeCloseTo(0.1, 12);
    expect(e.metrics.evasion.value).toBeCloseTo(0.05, 12);
  });
  it('enumerates the fixture’s gold slot and choice node: 2 × 2 × 2 × 2 = 16', () => {
    const request = fixtureNodeRequest();
    expect(estimateCandidateSpace(request, fixtureNodeEntry)).toEqual({
      allocations: 2,
      slotOptions: { bronze: 2, silver: 2, gold: 2 },
      upperBound: 16,
      exceedsLimit: false,
    });
    expect([...generateBuilds(request, fixtureNodeEntry)]).toHaveLength(16);
    const result = compareBuilds(request, fixtureNodeEntry);
    // Critical 4 (fixed 2 + node 2) + gold 3 = 7 levels → 14%, with four
    // bronze/silver combinations, each a distinct evaluation tied at rank 1.
    const top = result.groups.filter((g) => g.rank === 1);
    expect(top).toHaveLength(4);
    expect(
      top.every((g) => g.evaluation.metrics.critical.value === 7 * 0.02),
    ).toBe(true);
  });
  it('reports unavailable metrics from another implementation, never zero', () => {
    const result = compareBuilds(fixtureStatsRequest(), fixtureStatsEntry);
    // Bronze: empty or the TEQ HP item; the AGL-only item is ineligible.
    expect(result.search.evaluated).toBe(2);
    expect(
      result.groups.flatMap((g) =>
        g.alternatives.map((a) => a.build.equips.bronze),
      ),
    ).toEqual(['test-only:bronze:teq-hp', null]);
    expect(result.groups[0]!.evaluation.stats.hp).toBe(3100);
    expect(result.groups[0]!.evaluation.metrics.critical.value).toBeNull();
    expect(result.groups[0]!.deltas.critical).toBeNull();
    expect(result.frontier.metricsUsed).toEqual(['attack', 'defense', 'hp']);
  });
  it('keeps working settings under each entry’s own key', () => {
    const storage = memory();
    const node = fixtureNodeRequest();
    node.current.equips.gold = 'test-only:gold:critical';
    expect(saveCharacterState(storage, node, fixtureNodeEntry)).toBeNull();
    expect([...storage.values.keys()]).toEqual([
      'dokkan.character-builds.v1:test-only-node-v1',
    ]);
    expect(loadCharacterState(storage, gokuEntry)).toMatchObject({
      state: defaultRequest(),
      warning: null,
    });
    expect(loadCharacterState(storage, fixtureNodeEntry).state).toEqual(node);
  });
  it('resolves saved builds only to the evaluator bound to their exact state', () => {
    const now = new Date('2026-10-19T00:00:00.000Z');
    const created = createSavedBuild({
      id: 'node-build',
      name: 'Fixture build',
      now,
      request: fixtureNodeRequest(),
      entry: fixtureNodeEntry,
    });
    const build = created.build!;
    expect(build.evaluatorVersion).toBe('test-only-node-v1');
    expect(buildStatus(build, [gokuEntry]).kind).toBe('unsupported');
    expect(buildStatus(build, [gokuEntry, fixtureNodeEntry]).kind).toBe(
      'ready',
    );
    expect(
      buildStatus(
        { ...build, evaluatorVersion: 'goku-initial-check-v1' },
        registry,
      ).kind,
    ).toBe('stale');
    const goku = createSavedBuild({
      id: 'goku-build',
      name: 'Goku build',
      now,
      request: defaultRequest(),
      entry: gokuEntry,
    }).build!;
    expect(buildStatus(goku, [fixtureNodeEntry, fixtureStatsEntry]).kind).toBe(
      'unsupported',
    );
  });
});
