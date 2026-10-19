import { describe, expect, it } from 'vitest';
import { defaultRequest, ORB_IDS } from '../data/real/character-build/goku';
import { gokuEntry } from '../data/real/character-build/registry';
import { compareBuilds, frontier } from './comparison';
import type { BuildRequest, Evaluation } from './domain';
import { evaluateBuild } from './evaluation';
import { explainGroup } from './explanation';
import { buildKey } from './generation';
import { fixtureStatsEntry, fixtureStatsRequest } from './registry.fixtures';

// Expected values are worked by hand from the admitted Goku record:
// raw 12,527 / 11,111 / 5,796; 55% profile +2,800 each; fixed AA5; bronze
// +500; silver skill +2; AA 2%/level, Super conversion 50%, critical
// 2%/level, evasion 1%/level. These are arithmetic checks, not game proof.
const key = (bronze: string | null, silver: string | null) =>
  buildKey({ choices: {}, equips: { bronze, silver, gold: null } });
function explain(
  request: BuildRequest,
  bronze: string | null,
  silver: string | null,
  alternative?: number,
) {
  const result = compareBuilds(request, gokuEntry);
  const group = result.groups.find((g) =>
    g.alternatives.some((a) => buildKey(a.build) === key(bronze, silver)),
  )!;
  return {
    result,
    group,
    x: explainGroup(result, request, gokuEntry, group.id, alternative)!,
  };
}

describe('calculation trace', () => {
  it('records every stat and skill addition by source', () => {
    const e = evaluateBuild(
      {
        choices: {},
        equips: {
          bronze: ORB_IDS.attack,
          silver: ORB_IDS.additional,
          gold: null,
        },
      },
      defaultRequest(),
      gokuEntry,
    );
    expect(e.trace.stats.map((c) => [c.source, c.slot, c.values])).toEqual([
      ['card', null, { hp: 12527, attack: 11111, defense: 5796 }],
      ['potential', null, { hp: 2800, attack: 2800, defense: 2800 }],
      ['equip', 'bronze', { attack: 500 }],
    ]);
    expect(e.trace.skills.map((c) => [c.source, c.values])).toEqual([
      ['potential', { additional: 5 }],
      ['equip', { additional: 2 }],
    ]);
    const steps = Object.fromEntries(
      e.trace.probabilities.map((p) => [p.metric, p]),
    );
    // 7 levels × 2% = 14%; 14% × 50% = 7%.
    expect(steps.additionalTrigger!.factors.map((f) => f.value)).toEqual([
      7, 0.02,
    ]);
    expect(steps.additionalTrigger!.value).toBeCloseTo(0.14, 12);
    expect(steps.additionalSuper!.factors.map((f) => f.value)).toEqual([
      steps.additionalTrigger!.value,
      0.5,
    ]);
    expect(steps.additionalSuper!.value).toBeCloseTo(0.07, 12);
    // Every step's value is the product of its listed factors.
    for (const step of e.trace.probabilities)
      expect(step.value).toBeCloseTo(
        step.factors.reduce((p, f) => p * f.value, 1),
        12,
      );
  });
  it('fixes evasion at zero by context, with no factors', () => {
    const request = defaultRequest();
    request.context.evasionAllowed = false;
    const e = evaluateBuild(
      {
        choices: {},
        equips: { bronze: null, silver: ORB_IDS.evasion, gold: null },
      },
      request,
      gokuEntry,
    );
    const evasion = e.trace.probabilities.find((p) => p.metric === 'evasion')!;
    expect([evasion.factors, evasion.value]).toEqual([[], 0]);
    expect(evasion.note).toContain('evasion disabled');
  });
});

describe('explanations generated from results', () => {
  it('explains a rank-1 tie above the baseline with exact deltas', () => {
    const { x } = explain(defaultRequest(), ORB_IDS.attack, ORB_IDS.additional);
    expect(x.configuration.slots.filter((s) => s.changed)).toEqual([
      {
        slot: 'bronze',
        current: null,
        proposed: ORB_IDS.attack,
        changed: true,
      },
      {
        slot: 'silver',
        current: null,
        proposed: ORB_IDS.additional,
        changed: true,
      },
    ]);
    const attack = x.stats.find((s) => s.key === 'attack')!;
    expect(attack.parts.map((p) => p.value)).toEqual([11111, 2800, 500]);
    expect([attack.total, attack.baseline]).toEqual([14411, 13911]);
    expect(attack.delta.absolute).toBe(500);
    expect(attack.delta.relative).toBeCloseTo(500 / 13911, 12);
    expect(x.skills.find((s) => s.key === 'additional')).toMatchObject({
      total: 7,
      baseline: 5,
    });
    // Objective: 7% vs 5% → +2 pp, +40% relative; four results share rank 1.
    expect(x.objective).toMatchObject({
      metric: 'additionalSuper',
      relation: 'above',
      rank: 1,
      tiedGroups: 4,
      distinctResults: 16,
    });
    expect(x.objective.value).toBeCloseTo(0.07, 12);
    expect(x.objective.baseline).toBeCloseTo(0.05, 12);
    expect(x.objective.delta.unit).toBe('pp');
    expect(x.objective.delta.absolute).toBeCloseTo(0.02, 12);
    expect(x.objective.delta.relative).toBeCloseTo(0.4, 12);
    expect(x.frontier).toMatchObject({
      status: 'on',
      dominatedBy: null,
      betterOn: [],
      truncated: false,
    });
  });
  it('names the dominating result and the metrics where it is better', () => {
    // Empty bronze + AA silver: ATK 13,911 vs 14,411 with every other metric
    // equal to ATK bronze + AA silver, the first result in rank order.
    const { x } = explain(defaultRequest(), null, ORB_IDS.additional);
    expect(x.frontier.status).toBe('off');
    expect(x.frontier.dominatedBy).toMatchObject({
      kind: 'group',
      rank: 1,
      label:
        'AGL ATK +500 · bronze Lv.5 / Additional Attack +2 · silver / Empty',
    });
    expect(x.frontier.betterOn).toEqual(['attack']);
    expect(x.objective.relation).toBe('above');
  });
  it('reports a tie with the baseline and an undefined relative change from zero', () => {
    const { x } = explain(defaultRequest(), ORB_IDS.attack, ORB_IDS.critical);
    // Initial extra Super is unchanged at 5%: a tie on the objective.
    expect(x.objective.relation).toBe('tie');
    expect(x.objective.delta.absolute).toBe(0);
    // Critical: 0% → 4%: +4 pp, relative change undefined (zero baseline).
    const critical = x.probabilities.find((p) => p.metric === 'critical')!;
    expect(critical.baseline).toBe(0);
    expect(critical.delta!.absolute).toBeCloseTo(0.04, 12);
    expect(critical.delta!.relative).toBeNull();
  });
  it('can be dominated by the baseline when a truncated search misses better targets', () => {
    const request = defaultRequest();
    request.current.equips = {
      bronze: ORB_IDS.attack,
      silver: ORB_IDS.additional,
      gold: null,
    };
    request.maxCandidates = 1; // only the empty build is generated first
    const result = compareBuilds(request, gokuEntry);
    expect(result.search.truncated).toBe(true);
    const x = explainGroup(result, request, gokuEntry, result.groups[0]!.id)!;
    expect(x.objective.relation).toBe('below');
    expect(x.frontier).toMatchObject({
      status: 'off',
      dominatedBy: { kind: 'baseline' },
      truncated: true,
      evaluated: 1,
    });
    expect(x.frontier.betterOn).toEqual(['attack', 'additionalSuper']);
  });
  it('explains the selected equivalent configuration from its own trace', () => {
    // With evasion disabled, empty silver and evasion silver are equivalent.
    const request = defaultRequest();
    request.context.evasionAllowed = false;
    const plain = explain(request, null, null);
    const index = plain.group.alternatives.findIndex(
      (a) => a.build.equips.silver === ORB_IDS.evasion,
    );
    expect(plain.group.alternatives).toHaveLength(2);
    const x = explainGroup(
      plain.result,
      request,
      gokuEntry,
      plain.group.id,
      index,
    )!;
    expect(x.configuration.equivalentConfigurations).toBe(2);
    expect(x.skills.find((s) => s.key === 'evasion')).toMatchObject({
      total: 2,
      baseline: 0,
    });
    const evasion = x.probabilities.find((p) => p.metric === 'evasion')!;
    expect([evasion.value, evasion.factors]).toEqual([0, []]);
    expect(x.model.evasionAllowed).toBe(false);
  });
  it('lists unavailable metrics with reasons and the evidence status of each assumption', () => {
    const { x } = explain(defaultRequest(), ORB_IDS.attack, ORB_IDS.additional);
    expect(x.unavailable.map((u) => u.metric)).toEqual([
      'damage',
      'battleDefense',
    ]);
    expect(x.unavailable[0]!.reason).toContain('Unavailable');
    const ids = x.evidence.map((e) => e.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'card-stats',
        'base-board',
        'bronze-items',
        'silver-items',
        'raw-stat-addition',
        'aa-initial-check',
        'damage-gate',
      ]),
    );
    // Source documentation is labelled as such; nothing claims corroboration.
    expect(
      x.evidence.every(
        (e) => 'status' in e && e.status !== 'independently-corroborated',
      ),
    ).toBe(true);
    expect(x.model).toMatchObject({
      entryId: 'goku-initial-check-v1',
      evaluatorId: 'hidden-potential-initial-check',
      evaluatorVersion: '1',
      dataRevision: 'goku-initial-check-2026-10-18.1',
    });
  });
  it('explains a result whose evaluator computes no probabilities', () => {
    const request = fixtureStatsRequest();
    const result = compareBuilds(request, fixtureStatsEntry);
    const x = explainGroup(
      result,
      request,
      fixtureStatsEntry,
      result.groups[0]!.id,
    )!;
    expect(x.probabilities).toEqual([]);
    expect(x.unavailable.map((u) => u.metric)).toEqual(
      expect.arrayContaining(['critical', 'evasion', 'additionalSuper']),
    );
    expect(x.objective).toMatchObject({ metric: 'hp', relation: 'above' });
    expect(x.frontier.metricsUsed).toEqual(['attack', 'defense', 'hp']);
  });
});

describe('Pareto dominance details', () => {
  const vector = (attack: number, defense: number): Evaluation => {
    const e = evaluateBuild(
      { choices: {}, equips: { bronze: null, silver: null, gold: null } },
      defaultRequest(),
      gokuEntry,
    );
    e.metrics.attack.value = attack;
    e.metrics.defense.value = defense;
    return e;
  };
  it('keeps exact ties on the frontier and reports the first dominator', () => {
    const f = frontier(
      [vector(10, 10), vector(10, 10), vector(9, 10), vector(12, 1)],
      ['attack', 'defense'],
    );
    expect(f.indices).toEqual([0, 1, 3]);
    expect(f.dominators[2]).toEqual({ index: 0, better: ['attack'] });
  });
  it('respects a lower-is-better direction when one is declared', () => {
    const f = frontier(
      [vector(10, 10), vector(9, 10)],
      ['attack', 'defense'],
      (metric) => (metric === 'attack' ? 'lower' : 'higher'),
    );
    expect(f.indices).toEqual([1]);
    expect(f.dominators[0]).toEqual({ index: 1, better: ['attack'] });
  });
});
