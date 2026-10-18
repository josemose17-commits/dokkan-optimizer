import { describe, expect, it } from 'vitest';
import type {
  OptimizationRequest,
  Participant,
  Provenance,
  RotationLayout,
  Rule,
  Unit,
} from '../domain/types';
import { evaluateCandidate } from './evaluation';
import { combinationCount, generateCandidates } from './generation';
import { optimize } from './optimizer';
import { enumerateRotations } from './rotations';
import { evaluateRule } from './rules';
import { scoreLayout } from './scoring';

const provenance: Provenance = {
  kind: 'synthetic',
  sourceId: 'test:independent-example',
  sourceUrl: null,
  reuseTerms: 'Original test example.',
  reviewedAt: '2026-10-18',
  verifiedAt: null,
};
function unit(id: string, pressure: number): Unit {
  return {
    id: `card-${id}`,
    name: id,
    provenance,
    awakeningState: 'base',
    categories: ['A'],
    linkIds: [],
    leaderSkill: {
      label: 'Category A',
      rule: { kind: 'category', categoryId: 'A' },
    },
    eligibilityRules: [],
    mechanics: [],
    effects: [],
    syntheticRatings: { pressure, sustain: 0, utility: 0 },
  };
}
function example(): OptimizationRequest {
  const names = ['lead', 'b', 'c', 'd', 'e', 'f', 'g', 'friend'];
  return {
    catalog: {
      units: names.map((id, index) => unit(id, (index + 1) * 10)),
      links: [],
    },
    owned: names.slice(0, 7).map((id) => ({ id, unitId: `card-${id}` })),
    leaderInstanceId: 'lead',
    friendUnitId: 'card-friend',
    scenario: {
      id: 'test:scenario',
      name: 'Pressure only',
      description: 'Independent arithmetic example.',
      provenance,
      mechanics: [],
      ratingWeights: { pressure: 1, sustain: 0, utility: 0 },
      turn: 1,
      hpPercent: 100,
    },
    maxCandidates: 10,
    resultLimit: 10,
  };
}
const sixOwned = ['lead', 'b', 'c', 'd', 'e', 'f'];
// Independently listed: six choices of five from [b,c,d,e,f,g], with lead fixed.
const expectedCandidates = [
  ['lead', 'b', 'c', 'd', 'e', 'f'],
  ['lead', 'b', 'c', 'd', 'e', 'g'],
  ['lead', 'b', 'c', 'd', 'f', 'g'],
  ['lead', 'b', 'c', 'e', 'f', 'g'],
  ['lead', 'b', 'd', 'e', 'f', 'g'],
  ['lead', 'c', 'd', 'e', 'f', 'g'],
];

describe('independent candidate and score examples', () => {
  it('enumerates exactly the six manually listed candidates without duplicate owned instances', () => {
    const request = example();
    const generated = generateCandidates(request.owned, 'lead', 10);
    expect(generated).toEqual({
      candidates: expectedCandidates,
      possible: 6,
      truncated: false,
    });
    for (const ids of generated.candidates) {
      expect(new Set(ids).size).toBe(6);
      expect(ids).toContain('lead');
    }
  });
  it('ranks the six teams according to manually summed ratings and documented weights', () => {
    const result = optimize(example());
    expect(result.errors).toEqual([]);
    expect(result.teams.map((team) => team.ownedIds)).toEqual(
      [...expectedCandidates].reverse(),
    );
    // Owned totals are 210..260; friend adds 80. Coverage=100, links=0, no conditions=100.
    const manualSumsDescending = [340, 330, 320, 310, 300, 290];
    result.teams.forEach((team, index) => {
      expect(team.components).toMatchObject({
        leaderCoverage: 100,
        links: 0,
        conditions: 100,
      });
      expect(team.components!.scenario).toBeCloseTo(
        manualSumsDescending[index]! / 7,
        10,
      );
      expect(team.total).toBeCloseTo(
        20 + 25 + (0.4 * manualSumsDescending[index]!) / 7,
        10,
      );
    });
  });
  it('includes a selected leader even when it is last in collection input order', () => {
    const request = example();
    request.owned.reverse();
    expect(optimize(request).teams.map((team) => team.ownedIds)).toEqual(
      [...expectedCandidates].reverse(),
    );
  });
  it('produces one team from exactly six owned instances and never selects the friend as owned', () => {
    const request = example();
    request.owned = request.owned.slice(0, 6);
    const result = optimize(request);
    expect(result.search).toMatchObject({
      possible: 1,
      evaluated: 1,
      eligible: 1,
      truncated: false,
    });
    expect(result.teams[0]!.participants.map((p) => p.id)).toEqual([
      'owned:lead',
      'owned:b',
      'owned:c',
      'owned:d',
      'owned:e',
      'owned:f',
      'friend',
    ]);
    expect(
      result.teams[0]!.participants.filter((p) => p.origin === 'friend'),
    ).toHaveLength(1);
  });
  it('keeps the friend separate when the friend has the same card ID as an owned leader', () => {
    const request = example();
    request.friendUnitId = 'card-lead';
    const result = optimize(request);
    const team = result.teams[0]!;
    expect(team.participants).toHaveLength(7);
    expect(new Set(team.participants.map((p) => p.id)).size).toBe(7);
    expect(
      team.participants.filter((p) => p.unit.id === 'card-lead'),
    ).toHaveLength(2);
    expect(team.coverage).toHaveLength(7);
  });
  it('rejects duplicate instance IDs in both a collection and an individual candidate', () => {
    const request = example();
    expect(
      evaluateCandidate(['lead', 'b', 'b', 'd', 'e', 'f'], request).reasons,
    ).toContain('Duplicate owned instance selected.');
    request.owned[1]!.id = 'lead';
    expect(optimize(request).errors).toContain(
      'Duplicate owned instance IDs in collection.',
    );
    expect(() => generateCandidates(request.owned, 'lead', 10)).toThrow(
      'Duplicate owned',
    );
  });
  it('rejects a candidate missing the selected leader', () => {
    expect(
      evaluateCandidate(['b', 'c', 'd', 'e', 'f', 'g'], example()).eligible,
    ).toBe(false);
  });
  it('does not mutate the request or fixture records', () => {
    const request = example(),
      before = JSON.stringify(request);
    optimize(request);
    expect(JSON.stringify(request)).toBe(before);
  });
});

describe('strict eligibility and two separate leader checks', () => {
  it('checks both leaders for all seven participants, without rating-based overrides', () => {
    const request = example();
    request.catalog.units.forEach((u) => {
      u.categories = ['A', 'B'];
    });
    request.catalog.units[1]!.categories = ['A'];
    request.catalog.units[2]!.categories = ['B'];
    request.catalog.units[7]!.leaderSkill = {
      label: 'Category B',
      rule: { kind: 'category', categoryId: 'B' },
    };
    request.catalog.units[1]!.syntheticRatings.pressure = 100;
    const evaluated = evaluateCandidate(sixOwned, request);
    expect(evaluated.eligible).toBe(false);
    expect(evaluated.total).toBeNull();
    expect(evaluated.components).toBeNull();
    expect(evaluated.layout).toBeNull();
    expect(
      evaluated.coverage.map((row) => [
        row.leader.status,
        row.friendLeader.status,
      ]),
    ).toEqual([
      ['met', 'met'],
      ['met', 'unmet'],
      ['unmet', 'met'],
      ['met', 'met'],
      ['met', 'met'],
      ['met', 'met'],
      ['met', 'met'],
    ]);
  });
  it('requires the friend participant itself to be covered by the owned leader', () => {
    const request = example();
    request.catalog.units[7]!.categories = ['B'];
    request.catalog.units[7]!.leaderSkill = {
      label: 'Everyone',
      rule: { kind: 'always' },
    };
    const evaluated = evaluateCandidate(sixOwned, request);
    expect(evaluated.coverage[6]!.participant.origin).toBe('friend');
    expect(evaluated.coverage[6]!.leader.status).toBe('unmet');
    expect(evaluated.coverage[6]!.friendLeader.status).toBe('met');
    expect(evaluated.eligible).toBe(false);
  });
  it('requires the owned leader to be covered by the friend leader', () => {
    const request = example();
    request.catalog.units[7]!.leaderSkill = {
      label: 'B',
      rule: { kind: 'category', categoryId: 'B' },
    };
    expect(
      evaluateCandidate(sixOwned, request).coverage[0]!.friendLeader.status,
    ).toBe('unmet');
  });
  it.each([
    'unit rule',
    'unit declaration',
    'nested OR',
    'unknown rule',
    'partner eligibility',
  ] as const)('fails closed for unsupported eligibility: %s', (variant) => {
    const request = example(),
      target = request.catalog.units[1]!;
    if (variant === 'unit rule')
      target.eligibilityRules = [
        { kind: 'unsupported', description: 'Unknown entry rule.' },
      ];
    if (variant === 'unit declaration')
      target.mechanics = [
        {
          id: 'unsupported-entry',
          status: 'unsupported',
          scope: 'eligibility',
          description: 'Unknown entry mechanic.',
        },
      ];
    if (variant === 'nested OR')
      target.eligibilityRules = [
        {
          kind: 'any',
          rules: [
            { kind: 'always' },
            { kind: 'unsupported', description: 'Unknown branch.' },
          ],
        },
      ];
    if (variant === 'unknown rule')
      target.eligibilityRules = [{ kind: 'futureRule' } as unknown as Rule];
    if (variant === 'partner eligibility')
      target.eligibilityRules = [
        {
          kind: 'any',
          rules: [
            { kind: 'always' },
            { kind: 'partnerCategory', categoryId: 'A' },
          ],
        },
      ];
    const evaluated = evaluateCandidate(sixOwned, request);
    expect(evaluated.eligible).toBe(false);
    expect(evaluated.total).toBeNull();
    expect(evaluated.reasons.join(' ').toLowerCase()).toContain('unsupported');
  });
  it('reports unsupported leader rules for every participant', () => {
    const request = example();
    request.catalog.units[0]!.leaderSkill!.rule = {
      kind: 'unsupported',
      description: 'Unknown leader rule.',
    };
    const result = evaluateCandidate(sixOwned, request);
    expect(result.coverage.map((row) => row.leader.status)).toEqual(
      Array(7).fill('unsupported'),
    );
    expect(result.eligible).toBe(false);
  });
  it('blocks unsupported scenario eligibility and refuses to rank verified data as synthetic', () => {
    const request = example();
    request.scenario.mechanics = [
      {
        id: 'event-rule',
        status: 'unsupported',
        scope: 'eligibility',
        description: 'Event entry.',
      },
    ];
    expect(optimize(request).errors.join(' ')).toContain(
      'Unsupported scenario eligibility',
    );
    expect(evaluateCandidate(sixOwned, request).eligible).toBe(false);
    request.scenario.mechanics = [];
    request.catalog.units[0]!.provenance = {
      ...provenance,
      kind: 'verified',
      verifiedAt: '2026-10-18',
    };
    expect(optimize(request).errors.join(' ')).toContain(
      'Verified data requires a verified evaluator',
    );
  });
  it('reports no eligible team when a restriction excludes every candidate', () => {
    const request = example();
    request.catalog.units[0]!.eligibilityRules = [
      { kind: 'category', categoryId: 'absent' },
    ];
    const result = optimize(request);
    expect(result.teams).toEqual([]);
    expect(result.search).toMatchObject({
      evaluated: 6,
      eligible: 0,
      rejected: 6,
    });
    expect(result.rejectedExamples).toHaveLength(3);
  });
});

describe('conditional fixture effects', () => {
  it.each([
    { turn: 3, hp: 50, active: true },
    { turn: 2, hp: 50, active: false },
    { turn: 3, hp: 51, active: false },
  ])(
    'activates a bonus only when BOTH conditions hold ($turn, $hp)',
    ({ turn, hp, active }) => {
      const request = example();
      request.owned = request.owned.slice(0, 6);
      request.scenario.turn = turn;
      request.scenario.hpPercent = hp;
      request.catalog.units[1]!.effects = [
        {
          id: 'test-effect',
          label: 'Conditional +30',
          condition: {
            kind: 'all',
            rules: [
              { kind: 'turnAtLeast', turn: 3 },
              { kind: 'hpAtMost', percent: 50 },
            ],
          },
          syntheticBonus: { pressure: 30 },
        },
      ];
      const team = optimize(request).teams[0]!;
      expect(team.effects[0]!.outcome.status).toBe(active ? 'met' : 'unmet');
      expect(team.components!.conditions).toBe(active ? 100 : 0);
      expect(team.components!.scenario).toBeCloseTo(
        (active ? 320 : 290) / 7,
        10,
      );
      expect(team.total).toBeCloseTo(
        20 + (active ? 25 : 0) + (0.4 * (active ? 320 : 290)) / 7,
        10,
      );
    },
  );
  it('evaluates a friend effect and pairs the friend to satisfy its fixed-partner condition', () => {
    const request = example();
    request.catalog.units[1]!.categories.push('partner');
    request.catalog.units[7]!.effects = [
      {
        id: 'friend-effect',
        label: 'Friend partner',
        condition: { kind: 'partnerCategory', categoryId: 'partner' },
        syntheticBonus: { pressure: 10 },
      },
    ];
    const evaluated = evaluateCandidate(sixOwned, request);
    expect(evaluated.effects[0]!.participantId).toBe('friend');
    expect(evaluated.effects[0]!.outcome.status).toBe('met');
    expect(
      evaluated.layout!.pairs.some(
        (pair) => pair.includes('friend') && pair.includes('owned:b'),
      ),
    ).toBe(true);
  });
  it('does not assume a fixed partner for a floater', () => {
    const request = example();
    request.catalog.units[1]!.effects = [
      {
        id: 'partner-effect',
        label: 'Partner effect',
        condition: { kind: 'partnerCategory', categoryId: 'A' },
        syntheticBonus: { pressure: 30 },
      },
    ];
    const evaluated = evaluateCandidate(sixOwned, request);
    const layout: RotationLayout = {
      pairs: [
        ['owned:lead', 'owned:c'],
        ['owned:d', 'owned:e'],
      ],
      floaters: ['owned:b', 'owned:f', 'friend'],
    };
    const scored = scoreLayout(
      evaluated.participants,
      evaluated.coverage,
      layout,
      request.catalog,
      request.scenario,
    );
    expect(scored.effects[0]!.outcome.status).toBe('unmet');
    expect(scored.components.scenario).toBeCloseTo(290 / 7);
  });
  it('counts self and friend in team-category conditions, as the rule specifies', () => {
    const request = example();
    const participants: Participant[] = [
      { id: 'self', origin: 'owned', unit: request.catalog.units[0]! },
      { id: 'friend', origin: 'friend', unit: request.catalog.units[7]! },
    ];
    const context = {
      self: participants[0]!,
      participants,
      scenario: request.scenario,
    };
    expect(
      evaluateRule(
        { kind: 'teamCategoryAtLeast', categoryId: 'A', count: 2 },
        context,
      ).status,
    ).toBe('met');
    expect(
      evaluateRule(
        { kind: 'teamCategoryAtLeast', categoryId: 'A', count: 3 },
        context,
      ).status,
    ).toBe('unmet');
  });
  it('gives no bonus for an unsupported scoring declaration, even if its condition is always true', () => {
    const request = example();
    request.catalog.units[1]!.effects = [
      {
        id: 'shift',
        label: 'Unmodeled shift',
        condition: { kind: 'always' },
        syntheticBonus: { pressure: 1000 },
      },
    ];
    request.catalog.units[1]!.mechanics = [
      {
        id: 'shift',
        status: 'unsupported',
        scope: 'scoring',
        description: 'Shift model absent.',
      },
    ];
    const evaluated = evaluateCandidate(sixOwned, request);
    expect(evaluated.eligible).toBe(true);
    expect(evaluated.effects[0]!.outcome.status).toBe('unsupported');
    expect(evaluated.components!.scenario).toBeCloseTo(290 / 7);
    expect(evaluated.warnings.join(' ')).toContain('No benefit assumed');
  });
  it('gives no bonus for an unsupported condition and clamps supported fixture bonuses', () => {
    const request = example();
    request.catalog.units[1]!.effects = [
      {
        id: 'unknown',
        label: 'Unknown',
        condition: { kind: 'unsupported', description: 'Unknown trigger.' },
        syntheticBonus: { pressure: 1000 },
      },
    ];
    expect(
      evaluateCandidate(sixOwned, request).components!.scenario,
    ).toBeCloseTo(290 / 7);
    request.catalog.units[1]!.effects[0]!.condition = { kind: 'always' };
    expect(
      evaluateCandidate(sixOwned, request).components!.scenario,
    ).toBeCloseTo(370 / 7); // b changes 20 -> 100, not 1020.
  });
});

describe('independent rotation enumeration', () => {
  const signature = (layout: RotationLayout) =>
    JSON.stringify({
      pairs: layout.pairs.map((pair) => [...pair].sort().join('/')).sort(),
      floaters: [...layout.floaters].sort(),
    });
  it('matches 35 choices of four fixed participants × three pairings, independently enumerated', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'friend'];
    const expected: string[] = [];
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 5; j++)
        for (let k = j + 1; k < 6; k++)
          for (let l = k + 1; l < 7; l++) {
            const a = ids[i]!,
              b = ids[j]!,
              c = ids[k]!,
              d = ids[l]!;
            const floaters = ids.filter((id) => ![a, b, c, d].includes(id)) as [
              string,
              string,
              string,
            ];
            for (const pairs of [
              [
                [a, b],
                [c, d],
              ],
              [
                [a, c],
                [b, d],
              ],
              [
                [a, d],
                [b, c],
              ],
            ] as RotationLayout['pairs'][])
              expected.push(signature({ pairs, floaters }));
          }
    const layouts = enumerateRotations(ids);
    expect(layouts.map(signature).sort()).toEqual(expected.sort());
    expect(layouts).toHaveLength(105);
    expect(new Set(layouts.map(signature)).size).toBe(105);
    layouts.forEach((layout) =>
      expect([...layout.pairs.flat(), ...layout.floaters].sort()).toEqual(ids),
    );
    expect(
      layouts.filter((layout) => layout.pairs.flat().includes('friend')),
    ).toHaveLength(60);
    expect(
      layouts.filter((layout) => layout.floaters.includes('friend')),
    ).toHaveLength(45);
  });
  it('rejects layouts with missing or duplicate participant IDs', () => {
    expect(() => enumerateRotations(['a', 'b'])).toThrow('seven distinct');
    expect(() =>
      enumerateRotations(['a', 'b', 'c', 'd', 'e', 'f', 'a']),
    ).toThrow('seven distinct');
  });
  it('uses weighted main-pair affinity rather than raw shared-link count or floater links', () => {
    const request = example();
    request.catalog.links = [
      {
        id: 'heavy',
        name: 'Heavy fixture',
        syntheticWeight: 4,
        provenance,
        mechanics: [],
      },
      {
        id: 'light',
        name: 'Light fixture',
        syntheticWeight: 1,
        provenance,
        mechanics: [],
      },
    ];
    request.catalog.units[0]!.linkIds = ['heavy'];
    request.catalog.units[1]!.linkIds = ['heavy'];
    request.catalog.units[2]!.linkIds = ['light'];
    request.catalog.units[3]!.linkIds = ['light'];
    request.catalog.units[4]!.linkIds = ['heavy', 'light'];
    request.catalog.units[5]!.linkIds = ['heavy', 'light'];
    const evaluated = evaluateCandidate(sixOwned, request);
    const layout: RotationLayout = {
      pairs: [
        ['owned:lead', 'owned:b'],
        ['owned:c', 'owned:d'],
      ],
      floaters: ['owned:e', 'owned:f', 'friend'],
    };
    const score = scoreLayout(
      evaluated.participants,
      evaluated.coverage,
      layout,
      request.catalog,
      request.scenario,
    );
    expect(score.components.links).toBe(50); // (4 + 1) / (2 × (4 + 1)) × 100.
    expect(score.total).toBeCloseTo(20 + 25 + 7.5 + (0.4 * 290) / 7);
  });
});

describe('search disclosure, replacements, and input boundaries', () => {
  it('discloses truncation, counts only evaluated teams, and makes no global optimum claim', () => {
    const request = example();
    request.maxCandidates = 3;
    const result = optimize(request);
    expect(result.search).toMatchObject({
      possible: 6,
      evaluated: 3,
      eligible: 3,
      rejected: 0,
      limit: 3,
      truncated: true,
    });
    expect(result.search.summary).toContain(
      'Best among evaluated candidates only',
    );
    expect(result.search.summary).toContain(
      'global optimum is not established',
    );
    expect(result.warnings).toContain(result.search.summary);
    expect(result.teams[0]!.ownedIds).toEqual(expectedCandidates[2]);
  });
  it('does not report truncation when the limit is exactly the full search size', () => {
    const request = example();
    request.maxCandidates = 6;
    expect(optimize(request).search.truncated).toBe(false);
  });
  it('provides the independently expected top three eligible single-swap replacements', () => {
    const team = optimize(example()).teams[0]!;
    expect(team.replacements.map((swap) => [swap.outId, swap.inId])).toEqual([
      ['c', 'b'],
      ['d', 'b'],
      ['e', 'b'],
    ]);
    team.replacements.forEach((swap, index) => {
      expect(swap.delta).toBeCloseTo((-0.4 * (index + 1) * 10) / 7, 10);
      expect(swap.outId).not.toBe('lead');
      expect(swap.componentDeltas.leaderCoverage).toBe(0);
    });
  });
  it('does not suggest uncovered replacements', () => {
    const request = example();
    request.catalog.units[1]!.categories = ['uncovered'];
    const result = optimize(request);
    expect(result.search.eligible).toBe(1);
    expect(result.teams[0]!.replacements).toEqual([]);
  });
  it.each([0, -1, 1.5, 2001, Infinity])(
    'rejects invalid candidate limit %s',
    (limit) => {
      const request = example();
      request.maxCandidates = limit;
      const result = optimize(request);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.search.evaluated).toBe(0);
    },
  );
  it('reports collection, leader, friend, context, and rating errors', () => {
    const request = example();
    request.owned = request.owned.slice(0, 5);
    request.leaderInstanceId = 'absent';
    request.friendUnitId = 'absent';
    request.scenario.hpPercent = 101;
    request.catalog.units[0]!.syntheticRatings.pressure = NaN;
    const text = optimize(request).errors.join(' ');
    expect(text).toContain('at least six');
    expect(text).toContain('owned leader');
    expect(text).toContain('friend');
    expect(text).toContain('HP from 0 to 100');
    expect(text).toContain('invalid synthetic ratings');
  });
  it('handles combination boundaries without accidental enumeration', () => {
    expect(combinationCount(5, 5)).toBe(1);
    expect(combinationCount(4, 5)).toBe(0);
    expect(combinationCount(6, 5)).toBe(6);
    expect(() => generateCandidates(example().owned, 'absent', 10)).toThrow(
      'must be owned',
    );
  });
});
