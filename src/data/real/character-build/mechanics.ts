import type { Effect } from '../../../character-definitions/domain';
import type { MechanicsRecord } from '../../../character-build/mechanics/registry';
import {
  SEQUENCE_METRICS,
  type EffectCoverage,
  type Rule,
  type Scenario,
  type SequenceMetric,
  type SequenceModel,
} from '../../../character-build/mechanics/domain';
import { scenarioSignature } from '../../../character-build/mechanics/support';
import { gohanKit } from './gohan-kit';
import {
  UI_GOKU_CARD_ID,
  UI_GOKU_STATE_ID,
  UI_GOKU_PAGE,
  UI_GOKU_REVISION,
  uiGokuAbilities,
} from './ui-goku-kit';

const turnOne = (state: string): Scenario['initial'] => ({
  provenance: 'manual',
  phase: 'before-attack',
  state,
  allies: [],
  values: {
    battleTurn: 1,
    appearance: 1,
    hpPercent: 100,
    ki: 12,
    attacksPerformed: 0,
    supersPerformed: 0,
    attacksReceived: 0,
    evasions: 0,
  },
});
const rule = (
  effectId: string,
  event: Rule['event'],
  operation: Rule['operation'],
  values: Partial<Rule> = {},
): Rule => ({
  effectId,
  event,
  operation,
  attack: null,
  maxAttemptsPerTurn: 16,
  maxActivations: null,
  ...values,
});
const coverage = (
  effectId: string,
  affects: SequenceMetric[],
  reason = 'No complete event binding is admitted.',
): EffectCoverage => ({ effectId, affects, exclusion: null, reason });
const noPotential: SequenceModel['potential'] = {
  additional: 'unknown',
  superChance: 0.5,
  superKind: '12-ki',
  critical: 'unknown',
  evasion: 'disabled',
  evidenceIds: [],
};

const uiEntry: Scenario = {
  id: 'ui-eza:entry-one-incoming',
  label: 'Entry turn · first evadable incoming attack · native effects only',
  initial: turnOne(UI_GOKU_STATE_ID),
  hp: null,
  maxHp: null,
  actions: [
    { kind: 'incoming', evadable: true, damageOnHit: 0, guarded: false },
  ],
  assumptions: [
    'No prior own or ally revival. Entry occurs on supplied battle turn 1.',
    'Only the first incoming attack is evaluated; later evasion buildup does not retroactively change it.',
    'Hidden Potential, equipment and external effects are excluded from this native-effect preview.',
    'Incoming damage is supplied as zero to isolate activation timing. This is not a survival prediction.',
  ],
};
const uiNativeAttacks: Scenario = {
  id: 'ui-eza:native-super-count',
  label: 'One initial 18-Ki Super · native additional only',
  initial: {
    ...turnOne(UI_GOKU_STATE_ID),
    values: { ...turnOne(UI_GOKU_STATE_ID).values, ki: 18 },
  },
  hp: null,
  maxHp: null,
  actions: [{ kind: 'attack', attack: '18-ki', ki: 18, enemySurvives: true }],
  assumptions: [
    'One initial 18-Ki Super is supplied. The enemy survives every attack.',
    'One native additional-Super opportunity has the source-reported 77% activation probability.',
    'Hidden Potential, equipment, Active Skill, prior revival and incoming attacks are excluded.',
    'The additional Super variant stays unknown. Super count is independent of that variant; ATK/critical-effect objectives stay gated.',
  ],
};
const uiEffects = uiGokuAbilities.flatMap((a) => a.effects);
const uiCoverage = uiEffects.map((e): EffectCoverage => {
  if (e.id === 'ui-native-additional')
    return coverage(
      e.id,
      [
        'expectedAttacks',
        'expectedSupers',
        'criticalAttacks',
        'attackRaise',
        'effectiveAttacks',
      ],
      'Native additional check ordering and additional-Super variant are unresolved.',
    );
  if (
    ['ui-native-evasion', 'ui-entry-evasion', 'ui-evasion-buildup'].includes(
      e.id,
    )
  ) {
    const c = coverage(
      e.id,
      ['evadedAttacks', 'defenseRaise'],
      'Later native evasion overlap/cap is unresolved.',
    );
    if (e.id === 'ui-evasion-buildup')
      c.exclusion = {
        scenarioIds: [uiEntry.id],
        scenarioSignatures: { [uiEntry.id]: scenarioSignature(uiEntry) },
        reason:
          'An increment after the first evasion cannot change whether that already-resolved first attack was evaded.',
      };
    return c;
  }
  if (e.id === 'ui-defense-buildup') return coverage(e.id, ['defenseRaise']);
  if (e.id === 'ui-revival')
    return {
      ...coverage(
        e.id,
        [...SEQUENCE_METRICS],
        'Prior revival history is unmodeled.',
      ),
      exclusion: {
        scenarioIds: [uiEntry.id, uiNativeAttacks.id],
        scenarioSignatures: {
          [uiEntry.id]: scenarioSignature(uiEntry),
          [uiNativeAttacks.id]: scenarioSignature(uiNativeAttacks),
        },
        reason:
          'This scenario explicitly supplies no prior revival and no lethal incoming damage.',
      },
    };
  if (e.id === 'ui-other-passive')
    return coverage(
      e.id,
      ['attackRaise', 'defenseRaise', 'criticalAttacks'],
      'Full passive stat/Ki/HP/Active Skill semantics are not implemented.',
    );
  if (e.family === 'critical' || e.family === 'support')
    return coverage(
      e.id,
      ['criticalAttacks'],
      'Repeated self/team critical overlap and self inclusion require evidence.',
    );
  return coverage(e.id, ['attackRaise']);
});
const uiRules: Rule[] = [
  rule(
    'ui-native-additional',
    'after-attack',
    {
      kind: 'additional',
      chance: 0.77,
      superChance: 1,
      superKind: 'unspecified-super',
    },
    { maxAttemptsPerTurn: 1 },
  ),
  rule(
    'ui-native-evasion',
    'appearance-start',
    { kind: 'evasion', combine: 'independent' },
    { maxAttemptsPerTurn: 1 },
  ),
  rule(
    'ui-entry-evasion',
    'before-hit',
    { kind: 'evasion', combine: 'maximum' },
    { maxAttemptsPerTurn: 1 },
  ),
  rule('ui-defense-buildup', 'after-evade', {
    kind: 'raise',
    group: 'passive-evasion',
  }),
  rule(
    'ui-ki24-critical',
    'attack-activation',
    { kind: 'critical', combine: 'maximum' },
    { maxAttemptsPerTurn: 1 },
  ),
  ...(['12-ki', '18-ki'] as const).flatMap((kind) => [
    rule(
      `ui-${kind}-attack`,
      'super-activation',
      { kind: 'raise', group: 'super' },
      {
        attack: { sources: ['initial', 'native', 'potential'], kinds: [kind] },
      },
    ),
    rule(
      `ui-${kind}-critical`,
      'super-activation',
      { kind: 'critical', combine: 'maximum' },
      {
        attack: { sources: ['initial', 'native', 'potential'], kinds: [kind] },
      },
    ),
  ]),
];
const uiModel: SequenceModel = {
  schemaVersion: 1,
  id: 'ui-goku-eza-native-event-model-v1',
  revision: UI_GOKU_REVISION,
  cardId: UI_GOKU_CARD_ID,
  stateId: UI_GOKU_STATE_ID,
  dataRevision: UI_GOKU_REVISION,
  abilities: uiGokuAbilities,
  rules: uiRules,
  coverage: uiCoverage,
  potential: { ...noPotential, additional: 'disabled', critical: 'disabled' },
  evidence: [
    {
      id: 'ui-eza-individual-facts',
      reference: UI_GOKU_PAGE,
      reviewedAt: '2026-10-20',
      sourceRevision: null,
      independentConfirmation: null,
      note: 'One individually read reference; selected original wording and field-level factual summaries. Native guarantees do not establish later overlap or game verification.',
    },
  ],
  assumptions: [
    'Experimental event-factor contract, not a verified Dokkan battle formula.',
    'Only explicitly admitted per-objective contexts are evaluated. Unmodeled effects remain visible and block affected metrics.',
  ],
};
export const uiGokuMechanics: MechanicsRecord = {
  id: uiModel.id,
  revision: UI_GOKU_REVISION,
  cardId: UI_GOKU_CARD_ID,
  stateId: UI_GOKU_STATE_ID,
  identity: {
    type: 'AGL',
    rarity: 'LR',
    level: 150,
    sa: 25,
    region: null,
    awakening: 'eza',
    step: null,
  },
  model: uiModel,
  scenarios: [
    {
      scenario: uiEntry,
      objectives: [
        'evadedAttacks',
        'criticalAttacks',
        'attackRaise',
        'defenseRaise',
      ],
    },
    {
      scenario: uiNativeAttacks,
      objectives: [
        'expectedAttacks',
        'expectedSupers',
        'criticalAttacks',
        'attackRaise',
        'defenseRaise',
      ],
    },
  ],
  notes: [
    'The first-incoming native entry guarantee and a native-only Super-count preview are executable. Hidden Potential is explicitly excluded, so native/Hidden Potential chaining is not claimed.',
    'Critical-count and full ATK/DEF-raise objectives remain gated on the additional variant, overlap and remaining passive semantics.',
    'This record has no admitted potential profile or compatible equipment mapping and cannot authorize build recommendations.',
  ],
};

const gohanRevision = 'gohan-eza-event-record-2026-10-20.1';
const gohanEffects: Effect[] = gohanKit.abilities
  .flatMap((a) => a.effects)
  .map((e) =>
    e.id === 'gohan-super-defense'
      ? {
          ...e,
          timing: 'super-activation',
          description: `${e.description} The event contract places the raise at Super activation; a numerical battle-DEF interpretation remains unverified.`,
        }
      : e,
  );
const superDefense = gohanEffects.find((e) => e.id === 'gohan-super-defense')!;
gohanEffects.push({
  ...superDefense,
  id: 'gohan-super-attack',
  label: 'Lasting ATK50% from a qualifying Super',
  stat: 'attack',
  source: { ...superDefense.source, field: 'gohan-super-attack' },
  description:
    'The selected EZA source table records an ATK50% raise for 99 turns. No damage-stage or Super multiplier formula is inferred.',
});
const gohanAbilities = gohanKit.abilities.map((a) => ({
  ...a,
  wording:
    a.kind === 'super'
      ? 'Selected original Super wording: “Greatly raises ATK & DEF”. The source also lists an enemy ATK reduction.'
      : a.wording,
  effects: gohanEffects.filter(
    (e) =>
      a.effects.some((original) => original.id === e.id) ||
      (a.kind === 'super' && e.id === 'gohan-super-attack'),
  ),
}));
const gohanScenario: Scenario = {
  id: 'gohan-eza:one-appearance',
  label: 'Early untransformed buildup · one initial Super',
  initial: {
    ...turnOne(gohanKit.stateId),
    values: {
      ...turnOne(gohanKit.stateId).values,
      battleTurn: 3,
      appearance: 2,
    },
  },
  hp: null,
  maxHp: null,
  actions: [{ kind: 'attack', attack: '12-ki', ki: 12, enemySurvives: true }],
  assumptions: [
    'Untransformed second appearance on turn 3. No guard/hit history is inferred.',
  ],
};
const gohanModel: SequenceModel = {
  schemaVersion: 1,
  id: 'gohan-eza-event-model-v1',
  revision: gohanRevision,
  cardId: gohanKit.cardId,
  stateId: gohanKit.stateId,
  dataRevision: gohanRevision,
  abilities: gohanAbilities,
  rules: ['gohan-super-defense', 'gohan-super-attack'].map((id) =>
    rule(
      id,
      'super-activation',
      { kind: 'raise', group: 'super' },
      {
        attack: {
          sources: ['initial', 'native', 'potential'],
          kinds: ['12-ki'],
        },
      },
    ),
  ),
  coverage: gohanEffects.map((e) =>
    coverage(
      e.id,
      e.family === 'additional-attack'
        ? [
            'expectedAttacks',
            'expectedSupers',
            'criticalAttacks',
            'attackRaise',
            'defenseRaise',
            'effectiveAttacks',
          ]
        : e.stat === 'attack'
          ? ['attackRaise']
          : e.stat === 'defense'
            ? ['defenseRaise']
            : ['attackRaise', 'defenseRaise'],
      e.description,
    ),
  ),
  potential: { ...noPotential, evasion: 'unknown' },
  evidence: [
    {
      id: 'gohan-individual-eza-facts',
      reference: 'https://dokkan.fyi/characters/1020091',
      reviewedAt: '2026-10-20',
      sourceRevision: null,
      independentConfirmation: null,
      note: 'Selected facts reread individually. The 99-turn/infinite disagreement and event-counter/guard ordering remain unresolved.',
    },
  ],
  assumptions: [
    '99-turn interpretation is retained from FYI; another reviewed source says infinite. No late-duration game claim is made.',
    'Stat raises are represented for event algebra, with no battle-stage formula.',
    'Unknown native chain and guard/hit semantics block full numerical recommendations.',
  ],
};
export const gohanMechanics: MechanicsRecord = {
  id: gohanModel.id,
  revision: gohanRevision,
  cardId: gohanKit.cardId,
  stateId: gohanKit.stateId,
  identity: {
    type: 'TEQ',
    rarity: 'UR',
    level: 140,
    sa: 15,
    region: null,
    awakening: 'eza',
    step: null,
  },
  model: gohanModel,
  scenarios: [
    {
      scenario: gohanScenario,
      objectives: ['expectedSupers', 'attackRaise', 'defenseRaise'],
    },
  ],
  notes: [
    'The event implementation exists for selected Super raises. Required native additional/guard timing is not admitted, so affected numerical objectives remain unavailable.',
    'The reviewed kit policy remains qualitative. This record neither replaces it nor borrows the Goku evaluator.',
  ],
};
export const realMechanics = [gohanMechanics, uiGokuMechanics] as const;
