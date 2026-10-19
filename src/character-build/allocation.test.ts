import { describe, expect, it } from 'vitest';
import { gokuEntry } from '../data/real/character-build/registry';
import { ORB_IDS } from '../data/real/character-build/goku';
import {
  CUSTOM_PROFILE_ID,
  allocationSpace,
  attainableAllocations,
  customFromCurrent,
  customPotentialErrors,
} from './allocation';
import type { BuildRequest, EvaluatorEntry } from './domain';
import { sourceBreakdown } from './explanation';
import { candidateBuilds } from './generation';
import { requestErrors } from './legality';
import { parseBuildRequest } from './library';
import {
  fixtureNodeEntry,
  fixtureNodeRequest,
  fixtureStatsEntry,
} from './registry.fixtures';
import { searchBuilds } from './search';

const control = () => ({
  maxScanned: 10_000,
  chunkSize: 8,
  cancelled: () => false,
  yieldControl: async () => {},
});

// TEST ONLY abstract graph: node A (2 levels, critical|evasion) and node B
// (1 level, additional|critical, requires A). Fixed skills 1/2/3. Not game data.
function graph(): { entry: EvaluatorEntry; request: BuildRequest } {
  const entry = {
    ...fixtureNodeEntry,
    model: structuredClone(fixtureNodeEntry.model),
  };
  entry.model.profile.nodes.push({
    ...structuredClone(entry.model.profile.nodes[0]!),
    id: 'test-only-node-b',
    route: 'topRight',
    levels: 1,
    options: ['additional', 'critical'],
    prerequisites: ['test-only-node-a'],
  });
  const request = fixtureNodeRequest();
  request.progression.activatedNodes = ['test-only-node-a', 'test-only-node-b'];
  request.current.choices = {
    'test-only-node-a': 'evasion',
    'test-only-node-b': 'additional',
  };
  return { entry, request };
}

const custom = (request: BuildRequest): BuildRequest => ({
  ...request,
  progression: {
    ...request.progression,
    profileId: CUSTOM_PROFILE_ID,
    activatedNodes: [],
  },
  current: { ...request.current, choices: {} },
  customPotential: {
    skills: { additional: 7, critical: 3, evasion: 0 },
    stats: { hp: 3000, attack: 3500, defense: 2500 },
  },
});

describe('attainable allocations', () => {
  it('a fixed documented profile has exactly one allocation', () => {
    const r = gokuEntry.defaults();
    expect(allocationSpace(r, gokuEntry)).toEqual({
      origin: 'fixed-profile',
      nodes: [],
      count: 1,
    });
    expect([...attainableAllocations(r, gokuEntry)]).toEqual([{}]);
  });

  it('enumerates one option per activated choice node, nothing else', () => {
    const { entry, request } = graph();
    const space = allocationSpace(request, entry);
    expect(space.origin).toBe('choice-graph');
    expect(space.count).toBe(4); // 2 options × 2 options
    expect([...attainableAllocations(request, entry)]).toEqual([
      { 'test-only-node-a': 'critical', 'test-only-node-b': 'additional' },
      { 'test-only-node-a': 'critical', 'test-only-node-b': 'critical' },
      { 'test-only-node-a': 'evasion', 'test-only-node-b': 'additional' },
      { 'test-only-node-a': 'evasion', 'test-only-node-b': 'critical' },
    ]);
  });

  it('combines every allocation with every eligible equipment combination', () => {
    const { entry, request } = graph();
    // 4 allocations × bronze {empty, ATK} × silver {empty, AA} × gold
    // {empty, critical} = 32 candidates.
    expect([...candidateBuilds(request, entry)]).toHaveLength(32);
  });
});

describe('multiple allocations searched with equipment', () => {
  it('finds the best allocation and equipment together (critical)', async () => {
    const { entry, request } = graph();
    request.objective = 'critical';
    const out = await searchBuilds(request, entry, control());
    expect(out.stop).toBe('complete');
    expect(out.progress.evaluated).toBe(32);
    // Hand enumeration of critical levels: fixed 2, A critical +2, B critical
    // +1, gold +3. Best = 2 + 2 + 1 + 3 = 8 levels = 16%.
    const best = out.comparison.groups[0]!;
    expect(best.evaluation.skills.critical).toBe(8);
    expect(best.evaluation.metrics.critical.value).toBeCloseTo(0.16);
    for (const a of best.alternatives) {
      expect(a.build.choices).toEqual({
        'test-only-node-a': 'critical',
        'test-only-node-b': 'critical',
      });
      expect(a.build.equips.gold).toBe('test-only:gold:critical');
    }
    // Baseline: A evasion, B additional, no equips = 2 levels = 4%.
    expect(out.comparison.current!.metrics.critical.value).toBeCloseTo(0.04);
  });

  it('a different objective picks a different allocation (evasion)', async () => {
    const { entry, request } = graph();
    request.objective = 'evasion';
    const out = await searchBuilds(request, entry, control());
    // Evasion: fixed 3 + A evasion 2 = 5 levels = 5%; B has no evasion option.
    const best = out.comparison.groups[0]!;
    expect(best.evaluation.skills.evasion).toBe(5);
    expect(best.evaluation.metrics.evasion.value).toBeCloseTo(0.05);
    expect(
      best.alternatives.every(
        (a) => a.build.choices['test-only-node-a'] === 'evasion',
      ),
    ).toBe(true);
  });

  it('ranks skill chances exactly by total skill level (convention-independent order)', async () => {
    const { entry, request } = graph();
    request.objective = 'critical';
    const groups = (await searchBuilds(request, entry, control())).comparison
      .groups;
    for (const a of groups)
      for (const b of groups) {
        const byChance = Math.sign(
          a.evaluation.metrics.critical.value! -
            b.evaluation.metrics.critical.value!,
        );
        const byLevel = Math.sign(
          a.evaluation.skills.critical - b.evaluation.skills.critical,
        );
        expect(byChance).toBe(byLevel);
      }
  });
});

describe('user-entered current potential values', () => {
  it('replaces the documented profile and is evaluated as entered', async () => {
    const r = custom(gokuEntry.defaults());
    r.objective = 'critical';
    expect(requestErrors(r, gokuEntry)).toEqual([]);
    expect(allocationSpace(r, gokuEntry)).toEqual({
      origin: 'custom',
      nodes: [],
      count: 1,
    });
    const out = await searchBuilds(r, gokuEntry, control());
    // Same 16 equipment combinations as the documented profile.
    expect(out.progress.evaluated).toBe(16);
    const best = out.comparison.groups[0]!;
    // Entered critical 3 + silver Critical Hit +2 = 5 levels × 2% = 10%.
    expect(best.evaluation.skills.critical).toBe(5);
    expect(best.evaluation.metrics.critical.value).toBeCloseTo(0.1);
    // Baseline uses the entered values: 3 levels = 6%.
    expect(out.comparison.current!.metrics.critical.value).toBeCloseTo(0.06);
  });

  it('separates entered levels, equipment additions and totals', () => {
    const r = custom(gokuEntry.defaults());
    const e = gokuEntry.evaluator.evaluate(
      {
        choices: {},
        equips: {
          bronze: ORB_IDS.attack,
          silver: ORB_IDS.additional,
          gold: null,
        },
      },
      r,
      gokuEntry,
    );
    const b = sourceBreakdown(e);
    expect(b.skills.fixed).toEqual({ additional: 7, critical: 3, evasion: 0 });
    expect(b.skills.chosen).toEqual({ additional: 0, critical: 0, evasion: 0 });
    expect(b.skills.equipment).toEqual({
      additional: 2,
      critical: 0,
      evasion: 0,
    });
    expect(b.skills.total).toEqual({ additional: 9, critical: 3, evasion: 0 });
    // ATK: card 11,111 + entered 3,500 + bronze 500 = 15,111.
    expect(b.stats.card.attack).toBe(11111);
    expect(b.stats.potential.attack).toBe(3500);
    expect(b.stats.equipment.attack).toBe(500);
    expect(b.stats.total.attack).toBe(15111);
    expect(e.trace.skills[0]!.label).toContain(
      'board requirements not checked',
    );
  });

  it('starts from the current documented allocation so nothing changes on switch', () => {
    expect(customFromCurrent(gokuEntry.defaults(), gokuEntry)).toEqual({
      skills: { additional: 5, critical: 0, evasion: 0 },
      stats: { hp: 2800, attack: 2800, defense: 2800 },
    });
    const { entry, request } = graph();
    // Fixed 1/2/3, A evasion +2, B additional +1.
    expect(customFromCurrent(request, entry).skills).toEqual({
      additional: 2,
      critical: 2,
      evasion: 5,
    });
  });

  it('rejects out-of-range or malformed values and unsupported evaluators', () => {
    const r = custom(gokuEntry.defaults());
    expect(
      customPotentialErrors({
        skills: { additional: 41, critical: -1, evasion: 1.5 },
        stats: { hp: 50_001, attack: 0, defense: Number.NaN },
      }),
    ).toHaveLength(5);
    const nodes = {
      ...r,
      progression: { ...r.progression, activatedNodes: ['x'] },
    };
    expect(requestErrors(nodes, gokuEntry).join(' ')).toContain(
      'none can be activated separately',
    );
    const profile = {
      ...r,
      progression: { ...r.progression, profileId: gokuEntry.model.profile.id },
    };
    expect(requestErrors(profile, gokuEntry).join(' ')).toContain(
      'need the custom progression',
    );
    const stats = custom(fixtureStatsEntry.defaults());
    expect(requestErrors(stats, fixtureStatsEntry).join(' ')).toContain(
      'cannot use your own potential values',
    );
  });
});

describe('saved settings with and without entered values', () => {
  it('keeps the original exact shape and round-trips entered values', () => {
    const plain = gokuEntry.defaults();
    expect(JSON.stringify(parseBuildRequest(structuredClone(plain)))).toBe(
      JSON.stringify(plain),
    );
    const withCustom = custom(plain);
    expect(parseBuildRequest(JSON.parse(JSON.stringify(withCustom)))).toEqual(
      withCustom,
    );
    const extra = JSON.parse(JSON.stringify(withCustom));
    extra.customPotential.skills.speed = 1;
    expect(parseBuildRequest(extra)).toBe(null);
    const text = JSON.parse(JSON.stringify(withCustom));
    text.customPotential.stats.hp = '3000';
    expect(parseBuildRequest(text)).toBe(null);
  });
});
