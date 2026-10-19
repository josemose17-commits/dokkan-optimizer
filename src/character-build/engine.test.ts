import { describe, expect, it } from 'vitest';
import {
  characterCatalog,
  defaultRequest,
  ORB_IDS,
} from '../data/real/character-build/goku';
import type {
  Build,
  CharacterCatalog,
  ChoiceNode,
  EvaluatorEntry,
  MetricKey,
  Orb,
} from './domain';
import { gokuEntry } from '../data/real/character-build/registry';
import { compareBuilds, frontier } from './comparison';
import {
  evaluateBuild,
  hiddenPotentialChance,
  independentChecks,
} from './evaluation';
import { estimateCandidateSpace, generateBuilds } from './generation';
import { buildErrors, orbErrors, requestErrors } from './legality';

const cloneCatalog = () => structuredClone(characterCatalog);
// The production Goku entry with a (possibly modified) evaluation model.
const E = (model: CharacterCatalog = characterCatalog): EvaluatorEntry => ({
  ...gokuEntry,
  model,
});
const empty: Build = {
  choices: {},
  equips: { bronze: null, silver: null, gold: null },
};
const vector = (
  attack: number,
  defense: number,
  damage: number | null = null,
) => {
  const e = evaluateBuild(empty, defaultRequest(), gokuEntry);
  e.metrics.attack.value = attack;
  e.metrics.defense.value = defense;
  e.metrics.damage.value = damage;
  return e;
};

describe('independent probability arithmetic (not game-behavior confirmation)', () => {
  it('has the independently calculated AA10 branches and expected counts', () => {
    const q = hiddenPotentialChance(10, 'additional');
    expect(q).toBeCloseTo(0.2);
    expect(1 - q).toBeCloseTo(0.8);
    expect(q / 2).toBeCloseTo(0.1);
    // Test-only, hypothetical one-extra model. No total-turn metric is shipped.
    expect(1 + q).toBeCloseTo(1.2);
    expect(1 + q / 2).toBeCloseTo(1.1);
  });
  it('combines independent critical checks as 65%, not 80%', () => {
    expect(
      independentChecks(0.5, hiddenPotentialChance(15, 'critical')),
    ).toBeCloseTo(0.65);
  });
  it('combines independent evasion checks as 74.5%, not 85%', () => {
    expect(
      independentChecks(0.7, hiddenPotentialChance(15, 'evasion')),
    ).toBeCloseTo(0.745);
  });
  it('handles zero and guaranteed checks', () => {
    expect(independentChecks(0, 0)).toBe(0);
    expect(independentChecks(1, 0.3)).toBe(1);
    expect(hiddenPotentialChance(0, 'critical')).toBe(0);
  });
  it.each([-1, 1.5, NaN, Infinity, 51])(
    'rejects invalid AA level %s without clamping',
    (level) => {
      expect(() => hiddenPotentialChance(level, 'additional')).toThrow();
    },
  );
  it.each([-0.1, NaN, 1.1, Infinity])('rejects invalid probability %s', (p) => {
    expect(() => independentChecks(p, 0.5)).toThrow();
  });
  it('has a hand-worked hypothetical branch-damage answer, not a combat test', () => {
    // Invented branch values test expectation arithmetic, not actual Dokkan damage.
    // 100 initial + 10% * 20 normal + 10% * 100 super = 112.
    const q = hiddenPotentialChance(10, 'additional');
    expect(100 + (q / 2) * 20 + (q / 2) * 100).toBe(112);
  });
});

describe('real, limited Goku snapshot', () => {
  it('evaluates the unequipped source-documented 55% baseline', () => {
    const e = evaluateBuild(empty, defaultRequest(), gokuEntry);
    expect(e.stats).toEqual({ hp: 15327, attack: 13911, defense: 8596 });
    expect(e.skills).toEqual({ additional: 5, critical: 0, evasion: 0 });
    expect(e.metrics.additionalTrigger.value).toBeCloseTo(0.1);
    expect(e.metrics.additionalSuper.value).toBeCloseTo(0.05);
    expect(e.metrics.critical.value).toBe(0);
    expect(e.metrics.evasion.value).toBe(0);
    expect(e.metrics.damage.value).toBeNull();
    expect(e.metrics.battleDefense.value).toBeNull();
  });
  it('adds a flat equip to card stats without combat multipliers', () => {
    const build = {
      ...empty,
      equips: { ...empty.equips, bronze: ORB_IDS.attack },
    };
    expect(evaluateBuild(build, defaultRequest(), gokuEntry).stats.attack).toBe(
      14411,
    );
  });
  it('calculates the initial-check chance with AA+2, independently expected 7%', () => {
    const build = {
      ...empty,
      equips: { ...empty.equips, silver: ORB_IDS.additional },
    };
    const e = evaluateBuild(build, defaultRequest(), gokuEntry);
    expect(e.metrics.additionalTrigger.value).toBeCloseTo(0.14);
    expect(e.metrics.additionalSuper.value).toBeCloseTo(0.07);
  });
  it('changes evasion only for the explicit eligible-attack context', () => {
    const request = defaultRequest();
    const build = {
      ...empty,
      equips: { ...empty.equips, silver: ORB_IDS.evasion },
    };
    expect(
      evaluateBuild(build, request, gokuEntry).metrics.evasion.value,
    ).toBeCloseTo(0.02);
    request.context.evasionAllowed = false;
    expect(evaluateBuild(build, request, gokuEntry).metrics.evasion.value).toBe(
      0,
    );
  });
  it('does not promote source documentation or arithmetic tests to game verification', () => {
    for (const evidence of characterCatalog.evidence) {
      expect(evidence.status).not.toBe('independently-corroborated');
      expect(evidence.verifiedAt).toBeNull();
      expect(evidence.independentConfirmation).toBeNull();
    }
    expect(characterCatalog.profile.nodes).toEqual([]);
  });
});

describe('independently enumerated real equip choices', () => {
  // Explicit oracle: four bronze × four silver choices, with gold locked.
  const expected = [
    [null, null],
    [null, ORB_IDS.additional],
    [null, ORB_IDS.critical],
    [null, ORB_IDS.evasion],
    [ORB_IDS.hp, null],
    [ORB_IDS.hp, ORB_IDS.additional],
    [ORB_IDS.hp, ORB_IDS.critical],
    [ORB_IDS.hp, ORB_IDS.evasion],
    [ORB_IDS.attack, null],
    [ORB_IDS.attack, ORB_IDS.additional],
    [ORB_IDS.attack, ORB_IDS.critical],
    [ORB_IDS.attack, ORB_IDS.evasion],
    [ORB_IDS.defense, null],
    [ORB_IDS.defense, ORB_IDS.additional],
    [ORB_IDS.defense, ORB_IDS.critical],
    [ORB_IDS.defense, ORB_IDS.evasion],
  ]
    .map((pair) => JSON.stringify(pair))
    .sort();
  it('generates exactly the 16 independently listed builds, no gold or node choices', () => {
    const builds = [...generateBuilds(defaultRequest(), gokuEntry)];
    expect(
      builds
        .map((b) => JSON.stringify([b.equips.bronze, b.equips.silver]))
        .sort(),
    ).toEqual(expected);
    expect(
      builds.every(
        (b) => b.equips.gold === null && Object.keys(b.choices).length === 0,
      ),
    ).toBe(true);
  });
  it('uses inventory quantities, and does not assume the catalog is owned', () => {
    const request = defaultRequest();
    request.mode = 'inventory';
    expect([...generateBuilds(request, gokuEntry)]).toEqual([empty]);
    request.inventory = { [ORB_IDS.attack]: 1, [ORB_IDS.critical]: 1 };
    const builds = [...generateBuilds(request, gokuEntry)];
    expect(builds).toHaveLength(4);
    expect(
      builds.every(
        (b) => !b.equips.silver || b.equips.silver === ORB_IDS.critical,
      ),
    ).toBe(true);
  });
  it('can retain current equips when the unequipped inventory count is zero', () => {
    const request = defaultRequest();
    request.mode = 'inventory';
    request.current.equips.silver = ORB_IDS.critical;
    expect([...generateBuilds(request, gokuEntry)]).toHaveLength(2);
    expect(
      compareBuilds(request, gokuEntry).groups.some((g) =>
        g.alternatives.some((a) => a.isCurrent),
      ),
    ).toBe(true);
  });
  it('catalog mode ignores ownership, while still reporting needed items', () => {
    const result = compareBuilds(defaultRequest(), gokuEntry);
    expect(
      result.groups.some((g) =>
        g.alternatives.some((a) => a.missingInventory[ORB_IDS.critical] === 1),
      ),
    ).toBe(true);
    expect(result.search).toMatchObject({
      evaluated: 16,
      unique: 16,
      totalLegal: 16,
      truncated: false,
    });
  });
});

describe('eligibility before evaluation', () => {
  it('rejects unknown progression, duplicate routes and invented numeric allocations', () => {
    const r = defaultRequest();
    r.progression.routes = ['topLeft'];
    expect(compareBuilds(r, gokuEntry).errors.join(' ')).toContain(
      'progression',
    );
    r.progression.routes = [];
    r.current.choices = { invented: 'critical' };
    expect(compareBuilds(r, gokuEntry).groups).toEqual([]);
  });
  it('rejects SEZA, a different region alias, level and SA state', () => {
    for (const changes of [
      { cardStateId: 'global-en:1003211:seza' },
      { cardStateId: 'jp:1003211:eza' },
      { level: 120 },
      { superAttackLevel: 10 },
    ]) {
      expect(
        compareBuilds({ ...defaultRequest(), ...changes }, gokuEntry).errors
          .length,
      ).toBeGreaterThan(0);
    }
  });
  it('rejects unsupported contexts rather than silently ignoring effects', () => {
    const r = defaultRequest();
    const invalid = {
      ...r.context,
      battleTurn: 8,
    } as unknown as typeof r.context;
    expect(compareBuilds({ ...r, context: invalid }, gokuEntry).groups).toEqual(
      [],
    );
  });
  it('requires an unlocked potential system', () => {
    const r = defaultRequest();
    r.progression.systemUnlocked = false;
    expect(requestErrors(r, gokuEntry).join(' ')).toContain(
      'already be unlocked',
    );
  });
  it('fails closed on unrecognized context effects', () => {
    const r = defaultRequest();
    r.context = { ...r.context, mysteryEffect: true } as typeof r.context;
    expect(compareBuilds(r, gokuEntry).groups).toEqual([]);
    expect(compareBuilds(r, gokuEntry).errors.join(' ')).toContain(
      'Unsupported context',
    );
  });
  it('rejects malformed source stat contracts', () => {
    const c = cloneCatalog();
    c.card.baseStats = {
      hp: 1,
      attack: 2,
      mystery: 3,
    } as unknown as typeof c.card.baseStats;
    expect(requestErrors(defaultRequest(), E(c))).toContain(
      'Invalid or unsupported card/profile facts.',
    );
  });
  it('rejects wrong-slot and unknown equips', () => {
    const r = defaultRequest();
    r.current.equips.bronze = ORB_IDS.critical;
    expect(compareBuilds(r, gokuEntry).errors.join(' ')).toContain(
      'wrong equip slot',
    );
    r.current.equips.bronze = 'not-a-catalog-item';
    // The unknown ID stays identifiable instead of reading as an empty slot.
    expect(compareBuilds(r, gokuEntry).errors.join(' ')).toContain(
      'Unknown equip in bronze: not-a-catalog-item.',
    );
  });
  it.each([
    ['type', 'restricted to type not-this-card'],
    ['category', 'requires documented category not-this-card'],
    ['cardState', 'restricted to character state not-this-card'],
    ['unsupported', 'unsupported requirement'],
    ['invented', 'unknown restriction'],
  ])('fails closed on unmet/unknown %s restrictions', (kind, reason) => {
    const c = cloneCatalog();
    c.orbs[0]!.restrictions = [
      { kind, value: 'not-this-card' },
    ] as unknown as Orb['restrictions'];
    expect(
      orbErrors(c.orbs[0]!, 'bronze', defaultRequest(), c).join(' '),
    ).toContain(reason);
    expect(
      [...generateBuilds(defaultRequest(), E(c))].some(
        (b) => b.equips.bronze === c.orbs[0]!.id,
      ),
    ).toBe(false);
  });
  it('rejects unsupported item mechanics and invalid/unknown effect fields', () => {
    const c = cloneCatalog();
    const orb = c.orbs[0]!;
    orb.support = 'unsupported';
    expect(
      orbErrors(orb, 'bronze', defaultRequest(), c).length,
    ).toBeGreaterThan(0);
    orb.support = 'supported';
    orb.stats = { hp: NaN };
    expect(orbErrors(orb, 'bronze', defaultRequest(), c).join(' ')).toContain(
      'invalid stat',
    );
    orb.stats = {};
    orb.skills = { mystery: 3 } as unknown as Orb['skills'];
    expect(orbErrors(orb, 'bronze', defaultRequest(), c).join(' ')).toContain(
      'unknown or invalid skill',
    );
  });
  it('checks silver SA9/10 and gold one/two-route boundaries in an abstract eligibility example', () => {
    const c = cloneCatalog();
    const r = defaultRequest();
    r.superAttackLevel = 9;
    expect(orbErrors(c.orbs[3]!, 'silver', r, c).length).toBeGreaterThan(0);
    r.superAttackLevel = 10;
    expect(orbErrors(c.orbs[3]!, 'silver', r, c)).toEqual([]);
    const gold: Orb = { ...c.orbs[3]!, slots: ['gold'], minRoutes: 2 };
    r.progression.routes = ['topLeft'];
    expect(orbErrors(gold, 'gold', r, c).length).toBeGreaterThan(0);
    r.progression.routes = ['topLeft', 'bottomRight'];
    expect(orbErrors(gold, 'gold', r, c)).toEqual([]);
  });
  it.each([-1, 0.5, NaN, Infinity, 1000])(
    'rejects inventory quantity %s',
    (n) => {
      const r = defaultRequest();
      r.inventory[ORB_IDS.attack] = n;
      expect(compareBuilds(r, gokuEntry).groups).toEqual([]);
    },
  );
  it('does not offer a damage objective', () => {
    const r = defaultRequest();
    r.objective = 'damage' as typeof r.objective;
    expect(compareBuilds(r, gokuEntry).errors).toContain(
      'Unsupported objective.',
    );
  });
});

describe('abstract graphs and quantities (not fictional game cards)', () => {
  function graph() {
    const c: CharacterCatalog = cloneCatalog();
    const node = (
      id: string,
      options: ChoiceNode['options'],
      prerequisites: string[] = [],
    ): ChoiceNode => ({
      id,
      options,
      prerequisites,
      route: 'topLeft',
      levels: 3,
      minSuperAttackLevel: 10,
      evidenceIds: ['base-board'],
      reviewedAt: '2026-10-18',
      verifiedAt: null,
      support: 'supported',
    });
    c.profile.routes = ['topLeft'];
    c.profile.nodes = [
      node('test-a', ['additional', 'critical']),
      node('test-b', ['additional', 'evasion'], ['test-a']),
    ];
    c.orbs = [];
    const r = defaultRequest();
    r.progression.routes = ['topLeft'];
    r.progression.activatedNodes = ['test-a', 'test-b'];
    r.current.choices = { 'test-a': 'additional', 'test-b': 'additional' };
    return { c, r };
  }
  it('matches four manually listed allocations and never generates the expected set from production code', () => {
    const { c, r } = graph();
    expect([...generateBuilds(r, E(c))].map((b) => b.choices)).toEqual([
      { 'test-a': 'additional', 'test-b': 'additional' },
      { 'test-a': 'additional', 'test-b': 'evasion' },
      { 'test-a': 'critical', 'test-b': 'additional' },
      { 'test-a': 'critical', 'test-b': 'evasion' },
    ]);
  });
  it('enforces prerequisites, exactly one legal choice and support status', () => {
    const { c, r } = graph();
    r.progression.activatedNodes = ['test-b'];
    r.current.choices = { 'test-b': 'evasion' };
    expect(requestErrors(r, E(c)).join(' ')).toContain('prerequisite');
    r.progression.activatedNodes = ['test-a', 'test-b'];
    expect(requestErrors(r, E(c)).join(' ')).toContain('exactly one');
    r.current.choices = { 'test-a': 'critical', 'test-b': 'critical' };
    expect(requestErrors(r, E(c)).join(' ')).toContain('unsupported choice');
    c.profile.nodes[0]!.support = 'unsupported';
    expect(requestErrors(r, E(c)).join(' ')).toContain('Unsupported node');
  });
  it('never selects two copies of a one-copy multi-slot test item', () => {
    const c = cloneCatalog();
    c.orbs = [{ ...c.orbs[0]!, slots: ['bronze', 'silver'], restrictions: [] }];
    const r = defaultRequest();
    r.mode = 'inventory';
    r.inventory[c.orbs[0]!.id] = 1;
    expect([...generateBuilds(r, E(c))]).toHaveLength(3); // empty, bronze only, silver only
    const both: Build = {
      choices: {},
      equips: { bronze: c.orbs[0]!.id, silver: c.orbs[0]!.id, gold: null },
    };
    expect(buildErrors(both, r, c).join(' ')).toContain('Insufficient');
    r.inventory[c.orbs[0]!.id] = 2;
    expect([...generateBuilds(r, E(c))]).toHaveLength(4);
  });
  it('does not treat an attached ordinary item as a free movable copy', () => {
    const c = cloneCatalog();
    c.orbs = [{ ...c.orbs[0]!, slots: ['bronze', 'silver'], restrictions: [] }];
    const r = defaultRequest();
    r.mode = 'inventory';
    r.current.equips.bronze = c.orbs[0]!.id;
    expect([...generateBuilds(r, E(c))]).toHaveLength(2); // empty or retained in bronze
    expect(
      [...generateBuilds(r, E(c))].every((b) => b.equips.silver === null),
    ).toBe(true);
  });
  it('retains alternative legal allocations that give the same evaluated totals', () => {
    const { c, r } = graph();
    c.profile.nodes[1]!.options = ['additional', 'critical'];
    const result = compareBuilds(r, E(c));
    expect(result.search.evaluated).toBe(4);
    expect(result.groups).toHaveLength(3);
    expect(
      result.groups
        .find((g) => g.alternatives.length === 2)!
        .alternatives.map((a) => a.build.choices),
    ).toEqual([
      { 'test-a': 'additional', 'test-b': 'critical' },
      { 'test-a': 'critical', 'test-b': 'additional' },
    ]);
  });
  it('fails closed on cyclic prerequisites', () => {
    const { c, r } = graph();
    c.profile.nodes[0]!.prerequisites = ['test-b'];
    expect(requestErrors(r, E(c))).toContain(
      'Cyclic choice prerequisites are unsupported.',
    );
  });
});

describe('comparisons, ties, equivalence, context and search scope', () => {
  it('uses a common available metric set; unavailable damage is never zero', () => {
    const f = frontier(
      [vector(10, 8, null), vector(9, 9, 100)],
      ['attack', 'defense', 'damage'],
    );
    expect(f.metricsUsed).toEqual(['attack', 'defense']);
    expect(f.omittedMetrics).toEqual(['damage']);
    expect(f.indices).toEqual([0, 1]);
    expect(frontier([vector(10, 8), vector(9, 9)], ['damage']).comparable).toBe(
      false,
    );
  });
  it('preserves non-dominated tradeoffs and exact ties', () => {
    expect(
      frontier(
        [vector(10, 8), vector(9, 9), vector(8, 8), vector(10, 8)],
        ['attack', 'defense'],
      ).indices,
    ).toEqual([0, 1, 3]);
  });
  it('cannot compare different contexts', () => {
    const a = vector(10, 8);
    const b = vector(1, 1);
    b.comparisonKey = 'other';
    expect(frontier([a, b], ['attack']).comparable).toBe(false);
  });
  it('ranks only the selected metric and preserves four first-place ties', () => {
    const r = defaultRequest();
    r.objective = 'attack';
    const result = compareBuilds(r, gokuEntry);
    expect(result.groups.filter((g) => g.rank === 1)).toHaveLength(4);
    expect(result.groups[0]!.evaluation.stats.attack).toBe(14411);
    expect(result.groups[0]!.deltas.attack).toBe(500);
    expect(result.groups.every((g) => g.deltas.damage === null)).toBe(true);
    expect(result.groups.filter((g) => g.frontier)).toHaveLength(9);
  });
  it('deduplicates equivalent evaluations while retaining all alternative legal equips', () => {
    const r = defaultRequest();
    r.context.evasionAllowed = false;
    const result = compareBuilds(r, gokuEntry);
    expect(result.search.evaluated).toBe(16);
    expect(result.groups).toHaveLength(12);
    expect(result.groups.reduce((n, g) => n + g.alternatives.length, 0)).toBe(
      16,
    );
    expect(
      result.groups.some(
        (g) =>
          g.alternatives.some((a) => a.isCurrent) &&
          g.alternatives.length === 2,
      ),
    ).toBe(true);
  });
  it('discloses truncation and still evaluates the actual current baseline', () => {
    const r = defaultRequest();
    r.maxCandidates = 2;
    r.current.equips.bronze = ORB_IDS.attack;
    const result = compareBuilds(r, gokuEntry);
    expect(result.search).toMatchObject({
      evaluated: 2,
      limit: 2,
      truncated: true,
      totalLegal: null,
    });
    expect(result.current!.stats.attack).toBe(14411);
  });
  it('does not call a complete search truncated at its exact size', () => {
    const r = defaultRequest();
    r.maxCandidates = 16;
    expect(compareBuilds(r, gokuEntry).search.truncated).toBe(false);
  });
  it('includes the current baseline when checking truncated frontier dominance', () => {
    const r = defaultRequest();
    r.maxCandidates = 2;
    r.current.equips.bronze = ORB_IDS.attack;
    r.frontierMetrics = ['attack'];
    const result = compareBuilds(r, gokuEntry);
    expect(result.groups.every((g) => !g.frontier)).toBe(true);
  });
  it('is deterministic and does not mutate the request or source catalog', () => {
    const r = defaultRequest();
    const before = JSON.stringify([r, characterCatalog]);
    expect(compareBuilds(r, gokuEntry)).toEqual(compareBuilds(r, gokuEntry));
    expect(JSON.stringify([r, characterCatalog])).toBe(before);
  });
  it('does not invent numeric deltas for unknown metrics', () => {
    for (const group of compareBuilds(defaultRequest(), gokuEntry).groups)
      for (const key of ['damage', 'battleDefense'] as MetricKey[])
        expect(group.deltas[key]).toBeNull();
  });
});

describe('candidate-space estimate before search (hand-counted)', () => {
  it('counts four bronze × four silver × one locked gold option for the real profile', () => {
    // Empty + three AGL bronze items; empty + three silver items; gold empty only.
    expect(estimateCandidateSpace(defaultRequest(), gokuEntry)).toEqual({
      allocations: 1,
      slotOptions: { bronze: 4, silver: 4, gold: 1 },
      upperBound: 16,
      exceedsLimit: false,
    });
  });
  it('is an upper bound: inventory checks can only remove targets', () => {
    const request = defaultRequest();
    request.mode = 'inventory';
    expect(estimateCandidateSpace(request, gokuEntry)!.upperBound).toBe(16);
    expect([...generateBuilds(request, gokuEntry)]).toHaveLength(1);
  });
  it('multiplies abstract allocation options and flags a limit that will truncate', () => {
    const c = cloneCatalog();
    c.profile.routes = ['topLeft'];
    c.profile.nodes = (['test-a', 'test-b'] as const).map((id): ChoiceNode => ({
      id,
      options: ['additional', 'critical', 'evasion'],
      prerequisites: [],
      route: 'topLeft',
      levels: 1,
      minSuperAttackLevel: 10,
      evidenceIds: ['base-board'],
      reviewedAt: '2026-10-18',
      verifiedAt: null,
      support: 'supported',
    }));
    const r = defaultRequest();
    r.progression.routes = ['topLeft'];
    r.progression.activatedNodes = ['test-a', 'test-b'];
    r.current.choices = { 'test-a': 'critical', 'test-b': 'critical' };
    r.maxCandidates = 100;
    // 3 × 3 allocations × 16 equip combinations = 144.
    expect(estimateCandidateSpace(r, E(c))).toMatchObject({
      allocations: 9,
      upperBound: 144,
      exceedsLimit: true,
    });
  });
  it('returns no estimate for an ineligible request', () => {
    const request = defaultRequest();
    request.superAttackLevel = 14;
    expect(estimateCandidateSpace(request, gokuEntry)).toBeNull();
  });
});
