import type { EvaluatorEntry } from '../../../character-build/domain';
import type {
  Scenario,
  SequenceModel,
} from '../../../character-build/mechanics/domain';
import { sequenceEvaluator } from '../../../character-build/mechanics/evaluator';
import { CARD_STATE_ID, CATALOG_CARD_ID, characterCatalog } from './goku';

// Reuses only admitted facts. This is a new experimental model/context, not
// a change to the saved v1 initial-check evaluator or a new potential board.
const model: SequenceModel = {
  schemaVersion: 1,
  id: 'goku-eza-event-sequence-v1',
  revision: 'goku-eza-sequence-2026-10-20.1',
  cardId: CATALOG_CARD_ID,
  stateId: CARD_STATE_ID,
  dataRevision: characterCatalog.revision,
  abilities: [],
  rules: [],
  coverage: [],
  potential: {
    additional: 'independent-per-attack-once',
    superChance: 0.5,
    superKind: '12-ki',
    critical: 'independent',
    evasion: 'independent',
    evidenceIds: ['aa-initial-check', 'critical-check', 'evasion-check'],
  },
  evidence: characterCatalog.evidence
    .filter((e) =>
      [
        'aa-initial-check',
        'critical-check',
        'evasion-check',
        'eza-kit',
      ].includes(e.id),
    )
    .map((e) => ({
      id: e.id,
      reference: e.sources[0]!.url,
      reviewedAt: e.reviewedAt,
      sourceRevision: null,
      independentConfirmation: e.independentConfirmation,
      note: e.limitation,
    })),
  assumptions: [
    'Experimental source-model arithmetic: independent Hidden Potential checks and a 50% Super conversion; no independent game confirmation.',
    'This exact EZA kit has no native additional, critical or evasion effects in the admitted record.',
    'Enemy survives every attack; supplied incoming damage is zero. These assumptions isolate attack/event counts and do not estimate performance against a boss.',
    'Passive stat bonuses, enemy debuffs, damage and combat modifier stages are excluded because they cannot change these counts under the supplied outcomes.',
  ],
};
const first: Scenario = {
  id: 'goku-sequence:first-appearance',
  label: 'One appearance · one incoming attack and one initial Super',
  hp: null,
  maxHp: null,
  initial: {
    provenance: 'manual',
    phase: 'before-attack',
    state: CARD_STATE_ID,
    allies: [],
    values: {
      battleTurn: 1,
      appearance: 1,
      attacksPerformed: 0,
      supersPerformed: 0,
      attacksReceived: 0,
      evasions: 0,
      ki: 12,
    },
  },
  actions: [
    { kind: 'incoming', evadable: true, damageOnHit: 0, guarded: false },
    { kind: 'attack', attack: '12-ki', ki: 12, enemySurvives: true },
  ],
  assumptions: [
    'Initial attack is a 12-Ki Super. No external effects. No prior attacks, Supers, hits or evasions.',
  ],
};
const later: Scenario = {
  ...first,
  id: 'goku-sequence:two-appearances',
  label: 'Two appearances · battle turns 1 and 3',
  actions: [
    ...first.actions,
    { kind: 'advance', battleTurn: 3, appearance: 2, values: {} },
    ...first.actions,
  ],
  assumptions: [
    ...first.assumptions,
    'Turn 2 passes off rotation. The second initial attack is also a supplied 12-Ki Super.',
  ],
};
const objectives = [
  'expectedAttacks',
  'expectedSupers',
  'criticalAttacks',
  'evadedAttacks',
] as const;
export const gokuSequence: NonNullable<EvaluatorEntry['sequence']> = {
  model,
  scenarios: [first, later],
  evaluator: sequenceEvaluator,
  objectives: [...objectives],
  recommendationSupport: Object.fromEntries(
    objectives.map((metric) => [
      metric,
      {
        scope: 'event-sequence-model',
        evidenceIds: [
          'eza-kit',
          metric === 'evadedAttacks'
            ? 'evasion-check'
            : metric === 'criticalAttacks'
              ? 'critical-check'
              : 'aa-initial-check',
        ],
        blockers: [],
        excludes: [
          'Damage, battle ATK/DEF and survival',
          'Full attainable allocation search; the original documented profile or explicitly entered totals remain the potential source',
        ],
      },
    ]),
  ),
};
