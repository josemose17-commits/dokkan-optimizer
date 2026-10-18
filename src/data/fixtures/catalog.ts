import type {
  Catalog,
  OwnedInstance,
  Provenance,
  Rule,
  Scenario,
  Unit,
} from '../../domain/types';

export const SYNTHETIC_NOTICE =
  'Synthetic demonstration — not real Dokkan recommendations.';
const provenance: Provenance = {
  kind: 'synthetic',
  sourceId: 'demo:hand-authored:v1',
  sourceUrl: null,
  reuseTerms:
    'Original synthetic demonstration fixtures; no third-party game data or assets.',
  reviewedAt: '2026-10-18',
  verifiedAt: null,
};
const category = (categoryId: string): Rule => ({
  kind: 'category',
  categoryId,
});
const either = (...ids: string[]): Rule => ({
  kind: 'any',
  rules: ids.map(category),
});
const links = ['relay', 'lattice', 'tempo', 'focus'].map((name, index) => ({
  id: `demo:link:${name}`,
  name: `${name[0]!.toUpperCase()}${name.slice(1)} code`,
  syntheticWeight: [4, 3, 2, 1][index]!,
  provenance,
  mechanics: [
    {
      id: 'demo:weighted-affinity',
      status: 'supported' as const,
      scope: 'scoring' as const,
      description: 'Hand-authored affinity weight, not an in-game link bonus.',
    },
  ],
}));
const makeUnit = (
  id: string,
  name: string,
  categories: string[],
  linkNames: string[],
  ratings: [number, number, number],
  extra: Partial<Unit> = {},
): Unit => ({
  id: `demo:unit:${id}`,
  name,
  provenance,
  awakeningState: 'awakened',
  categories,
  linkIds: linkNames.map((link) => `demo:link:${link}`),
  syntheticRatings: {
    pressure: ratings[0],
    sustain: ratings[1],
    utility: ratings[2],
  },
  leaderSkill: null,
  eligibilityRules: [],
  effects: [],
  mechanics: [
    {
      id: 'demo:category-rules',
      status: 'supported',
      scope: 'eligibility',
      description: 'Synthetic category matching.',
    },
    {
      id: 'demo:fixture-ratings',
      status: 'supported',
      scope: 'scoring',
      description: 'Arbitrary demonstration ratings; not card stats.',
    },
  ],
  ...extra,
});
const ember = 'demo:ember',
  tide = 'demo:tide',
  vanguard = 'demo:vanguard';

export const catalog: Catalog = {
  links,
  units: [
    makeUnit(
      'vector',
      'Vector Captain',
      [ember, vanguard],
      ['relay', 'tempo'],
      [78, 55, 60],
      {
        leaderSkill: {
          label: 'Ember OR Tide (synthetic rule)',
          rule: either(ember, tide),
        },
        effects: [
          {
            id: 'demo:vector-effect',
            label: 'Tide assembly: utility +12',
            condition: {
              kind: 'teamCategoryAtLeast',
              categoryId: tide,
              count: 3,
            },
            syntheticBonus: { utility: 12 },
          },
        ],
      },
    ),
    makeUnit(
      'harbor',
      'Harbor Marshal',
      [tide, vanguard],
      ['lattice', 'focus'],
      [52, 84, 67],
      {
        leaderSkill: {
          label: 'Tide OR Vanguard (synthetic rule)',
          rule: either(tide, vanguard),
        },
        effects: [
          {
            id: 'demo:harbor-effect',
            label: 'Low-context HP: sustain +14',
            condition: { kind: 'hpAtMost', percent: 50 },
            syntheticBonus: { sustain: 14 },
          },
        ],
      },
    ),
    makeUnit(
      'pulse',
      'Pulse Striker',
      [ember, vanguard],
      ['relay', 'tempo'],
      [89, 34, 36],
      {
        effects: [
          {
            id: 'demo:pulse-effect',
            label: 'Vanguard partner: pressure +10',
            condition: { kind: 'partnerCategory', categoryId: vanguard },
            syntheticBonus: { pressure: 10 },
          },
        ],
      },
    ),
    makeUnit(
      'aegis',
      'Aegis Keeper',
      [tide],
      ['lattice', 'focus'],
      [32, 90, 52],
      {
        awakeningState: 'enhanced',
        effects: [
          {
            id: 'demo:aegis-effect',
            label: 'Turn 3 context: sustain +10',
            condition: { kind: 'turnAtLeast', turn: 3 },
            syntheticBonus: { sustain: 10 },
          },
        ],
      },
    ),
    makeUnit(
      'signal',
      'Signal Medic',
      [tide],
      ['relay', 'focus'],
      [36, 70, 88],
      {
        effects: [
          {
            id: 'demo:signal-effect',
            label: 'Tide assembly: utility +10',
            condition: {
              kind: 'teamCategoryAtLeast',
              categoryId: tide,
              count: 3,
            },
            syntheticBonus: { utility: 10 },
          },
        ],
      },
    ),
    makeUnit(
      'orbit',
      'Orbit Scout',
      [ember, vanguard],
      ['tempo', 'focus'],
      [72, 50, 76],
      {
        effects: [
          {
            id: 'demo:orbit-effect',
            label: 'Tide partner: utility +14',
            condition: { kind: 'partnerCategory', categoryId: tide },
            syntheticBonus: { utility: 14 },
          },
        ],
      },
    ),
    makeUnit(
      'echo',
      'Echo Conduit',
      [tide, vanguard],
      ['relay', 'lattice'],
      [60, 62, 81],
      {
        effects: [
          {
            id: 'demo:echo-effect',
            label: 'Late / low-HP context: pressure +18',
            condition: {
              kind: 'all',
              rules: [
                { kind: 'turnAtLeast', turn: 3 },
                { kind: 'hpAtMost', percent: 50 },
              ],
            },
            syntheticBonus: { pressure: 18 },
          },
        ],
      },
    ),
    makeUnit(
      'prism',
      'Prism Anchor',
      [ember, vanguard],
      ['lattice', 'tempo'],
      [68, 81, 42],
      {
        mechanics: [
          {
            id: 'demo:category-rules',
            status: 'supported',
            scope: 'eligibility',
            description: 'Synthetic category matching.',
          },
          {
            id: 'demo:prism-shift',
            status: 'unsupported',
            scope: 'scoring',
            description: 'Prism shift is not modeled.',
          },
        ],
        effects: [
          {
            id: 'demo:prism-shift',
            label: 'Prism shift (unsupported)',
            condition: {
              kind: 'unsupported',
              description: 'No transformation state model.',
            },
            syntheticBonus: { pressure: 100 },
          },
        ],
      },
    ),
    makeUnit(
      'cinder',
      'Cinder Sprinter',
      [ember],
      ['relay', 'tempo'],
      [95, 25, 25],
      {
        awakeningState: 'base',
        effects: [
          {
            id: 'demo:cinder-effect',
            label: 'HP ≤ 30 context: pressure +5',
            condition: { kind: 'hpAtMost', percent: 30 },
            syntheticBonus: { pressure: 5 },
          },
        ],
      },
    ),
    makeUnit('drift', 'Drift Envoy', [tide], ['relay', 'focus'], [51, 66, 82]),
    makeUnit(
      'unknown',
      'Unknown Sentinel',
      [tide, vanguard],
      ['relay', 'lattice'],
      [100, 100, 100],
      {
        mechanics: [
          {
            id: 'demo:unknown-entry',
            status: 'unsupported',
            scope: 'eligibility',
            description:
              'Unknown entry restriction; this participant must be excluded.',
          },
        ],
      },
    ),
    makeUnit(
      'void',
      'Void Soloist',
      ['demo:void'],
      ['tempo', 'focus'],
      [98, 98, 98],
    ),
  ],
};

export const scenarios: Scenario[] = [
  {
    id: 'demo:scenario:pressure',
    name: 'Opening pressure exercise',
    description:
      'Emphasizes a hand-authored pressure rating. No damage is calculated.',
    provenance,
    mechanics: [],
    ratingWeights: { pressure: 0.6, sustain: 0.2, utility: 0.2 },
    turn: 1,
    hpPercent: 100,
  },
  {
    id: 'demo:scenario:stability',
    name: 'Stability exercise',
    description:
      'Emphasizes synthetic sustain and utility. Does not estimate survival.',
    provenance,
    mechanics: [],
    ratingWeights: { pressure: 0.15, sustain: 0.55, utility: 0.3 },
    turn: 5,
    hpPercent: 45,
  },
];
export const instanceId = (unitId: string) => `box/${unitId}`;
export const defaultOwned: OwnedInstance[] = catalog.units
  .slice(0, 9)
  .map((unit) => ({ id: instanceId(unit.id), unitId: unit.id }));
