import {
  newEffect,
  type Ability,
  type Effect,
} from '../../../character-definitions/domain';
import type { ReviewedKit } from '../../../character-build/kit';

export const UI_GOKU_CARD_ID = 'admitted-card:1020311';
export const UI_GOKU_STATE_ID = 'unknown-region:1020311:eza:lv150:sa25';
export const UI_GOKU_PAGE = 'https://dokkan.fyi/characters/1020311';
export const UI_GOKU_REVISION = 'ui-goku-eza-events-2026-10-20.1';
const fx = (id: string, label: string, values: Partial<Effect>): Effect => ({
  ...newEffect(id),
  label,
  description: label,
  source: {
    field: id,
    status: 'source-documented',
    reference: UI_GOKU_PAGE,
    note: 'Individual EZA fact read 2026-10-20. Source revision and independent game confirmation are unavailable.',
  },
  ...values,
});
export const uiGokuAbilities: Ability[] = [
  {
    id: 'ui-eza-passive',
    name: 'Power From Friends',
    kind: 'passive',
    // Selected original wording, 15 words total; other effects are original
    // short factual summaries, not a copied page or compiled dataset.
    wording:
      "77% chance of launching an additional Super Attack; 77% chance of evading enemy's attack",
    effects: [
      fx('ui-native-additional', 'Native additional Super, 77% activation', {
        family: 'additional-super',
        stat: null,
        unit: 'count',
        amount: 1,
        timing: 'after-attack',
        description:
          'The native-only model counts one 77% opportunity. Native/Hidden Potential execution/check ordering and the additional-Super variant remain unresolved.',
      }),
      fx('ui-native-evasion', 'Native evasion probability 77%', {
        family: 'evasion',
        stat: null,
        unit: 'probability',
        amount: 0.77,
        timing: 'appearance-start',
        duration: { kind: 'permanent', count: null },
      }),
      fx('ui-entry-evasion', 'Entry-turn evasion guarantee', {
        family: 'evasion',
        stat: null,
        unit: 'probability',
        amount: 1,
        timing: 'before-hit',
        condition: {
          kind: 'threshold',
          field: 'appearance',
          operator: '=',
          value: 1,
        },
        duration: { kind: 'turns', count: 1 },
      }),
      fx(
        'ui-evasion-buildup',
        'Each evasion adds 7 percentage points within the turn',
        {
          family: 'evasion',
          stat: null,
          unit: 'probability',
          amount: 0.07,
          timing: 'after-evade',
          stacking: 'additive',
          duration: { kind: 'turns', count: 1 },
          description:
            'The increment is source-documented. Later overlap/cap conventions need review before a multi-hit numerical evasion result.',
        },
      ),
      fx(
        'ui-defense-buildup',
        'Each evasion adds permanent DEF30%, up to DEF150%',
        {
          family: 'percent-stat',
          stat: 'defense',
          unit: 'percent',
          amount: 30,
          timing: 'after-evade',
          stacking: 'additive',
          cap: 150,
          duration: { kind: 'permanent', count: null },
        },
      ),
      fx('ui-ki24-critical', 'Guaranteed critical at 24 Ki', {
        family: 'critical',
        stat: null,
        unit: 'probability',
        amount: 1,
        timing: 'attack-activation',
        condition: { kind: 'threshold', field: 'ki', operator: '=', value: 24 },
        duration: { kind: 'turns', count: 1 },
        description:
          'The source also lists Active Skill activation as a trigger. This structured subset covers only the explicit 24-Ki condition.',
      }),
      fx(
        'ui-revival',
        'Revival-dependent Ki/stats and a later-turn evasion guarantee',
        {
          family: 'revival',
          representation: 'recorded-only',
          stat: null,
          amount: null,
          unit: 'unknown',
          timing: 'other',
          condition: {
            kind: 'other',
            description:
              'Prior own or ally revival and the next attacking-turn window are not represented in this preview.',
          },
        },
      ),
      fx(
        'ui-other-passive',
        'Other ATK/DEF/Ki, HP, Active Skill and revival conditions',
        {
          family: 'other',
          representation: 'recorded-only',
          stat: null,
          amount: null,
          unit: 'unknown',
          timing: 'other',
          description:
            'Other offensive/stat contributions are not executable. Raw HiPo display totals are not treated as raw card stats.',
        },
      ),
    ],
  },
  ...(['12-ki', '18-ki'] as const).map((kind): Ability => ({
    id: `ui-super-${kind}`,
    name:
      kind === '12-ki'
        ? 'Perfect Instinct (Extreme)'
        : 'Supreme Kamehameha (Extreme)',
    kind: 'super',
    wording: `${kind} source effects: ATK ${kind === '12-ki' ? 50 : 100}% for one turn; self critical 50%; team critical 7% for ${kind === '12-ki' ? 'one turn' : 'two turns'}.`,
    effects: [
      fx(`ui-${kind}-attack`, `${kind} ATK raise`, {
        family: 'percent-stat',
        stat: 'attack',
        unit: 'percent',
        amount: kind === '12-ki' ? 50 : 100,
        timing: 'super-activation',
        stacking: 'additive',
        duration: { kind: 'turns', count: 1 },
      }),
      fx(`ui-${kind}-critical`, `${kind} self critical 50% for one turn`, {
        family: 'critical',
        stat: null,
        unit: 'probability',
        amount: 0.5,
        timing: 'super-activation',
        duration: { kind: 'turns', count: 1 },
      }),
      fx(`ui-${kind}-team-critical`, `${kind} team critical support`, {
        family: 'support',
        representation: 'recorded-only',
        target: 'allies-including-self',
        stat: null,
        unit: 'probability',
        amount: 0.07,
        timing: 'super-activation',
        duration: { kind: 'turns', count: kind === '12-ki' ? 1 : 2 },
        description:
          'Self inclusion and repeated Super critical overlap require an admitted convention before critical-count comparisons.',
      }),
    ],
  })),
];
export const uiGokuKit: ReviewedKit = {
  cardId: UI_GOKU_CARD_ID,
  stateId: UI_GOKU_STATE_ID,
  revision: UI_GOKU_REVISION,
  policy: 'conditional-evasion-v1',
  identity: {
    type: 'AGL',
    rarity: 'LR',
    level: 150,
    sa: 25,
    awakening: 'eza',
    step: null,
    region: null,
    gameVersion: null,
  },
  abilities: uiGokuAbilities,
  references: [
    {
      id: 'ui-eza-fyi',
      label: 'DOKKAN.FYI — exact EZA identity and selected individual effects',
      url: UI_GOKU_PAGE,
      reviewedAt: '2026-10-20',
      independentConfirmation: null,
    },
  ],
  notes: [
    'Source-documented individual facts; no independent game confirmation, raw page hash or bulk-reuse grant.',
    '12-Ki and 18-Ki raises are distinct. Additional-Super variant/check mapping is unresolved.',
    'Region, numeric EZA step, raw stats, links and categories are not inferred.',
    'The native-event previews cover one entry incoming attack or a native-only Super count, with no prior revival. They do not establish later protection, a full build comparison, damage or survival.',
  ],
  buildGaps: [
    'No complete attainable potential allocation set or shared-board mapping is admitted.',
    'No exact compatible equipment catalog is bound to this state.',
    'Native/Hidden Potential chain ordering, additional-Super variant, critical support overlap, and later evasion buildup/cap rules require evidence.',
    'Revival, Active Skill, full passive stat stages and damage are not modeled.',
  ],
  context: {
    provenance: 'manual',
    phase: 'before-attack',
    state: UI_GOKU_STATE_ID,
    allies: [],
    values: {
      battleTurn: 1,
      appearance: 1,
      ki: 12,
      attacksPerformed: 0,
      supersPerformed: 0,
      attacksReceived: 0,
      evasions: 0,
    },
  },
  contextDescription:
    'Entry turn, first appearance, before attacking; no prior own or ally revival. The entry guarantee is conditional on an evadable incoming attack.',
};
