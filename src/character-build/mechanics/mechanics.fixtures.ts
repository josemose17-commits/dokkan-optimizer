// Test-only arithmetic contracts. Never import into production data or UI.
import { newEffect, type Effect } from '../../character-definitions/domain';
import type { Rule, Scenario, SequenceInput, SequenceModel } from './domain';
export const STATE = 'test-only:mechanics:state';
export const effect = (id: string, values: Partial<Effect> = {}): Effect => ({
  ...newEffect(id),
  label: `TEST ONLY ${id}`,
  timing: 'after-attack',
  amount: 1,
  family: 'additional-super',
  stat: null,
  unit: 'count',
  ...values,
});
export const rule = (id: string, values: Partial<Rule> = {}): Rule => ({
  effectId: id,
  event: 'after-attack',
  attack: null,
  operation: {
    kind: 'additional',
    chance: 1,
    superChance: 1,
    superKind: '12-ki',
  },
  maxAttemptsPerTurn: 1,
  maxActivations: null,
  ...values,
});
export function model(
  effects: Effect[] = [],
  rules: Rule[] = [],
): SequenceModel {
  return {
    schemaVersion: 1,
    id: 'test-only:event-model',
    revision: 'test-only:events:1',
    cardId: 'test-only:mechanics:card',
    stateId: STATE,
    dataRevision: 'test-only:data:1',
    abilities: [
      {
        id: 'test-only:ability',
        name: 'TEST ONLY',
        kind: 'passive',
        wording: 'TEST ONLY arithmetic, no game facts.',
        effects,
      },
    ],
    rules,
    coverage: effects.map((e) => ({
      effectId: e.id,
      affects: [
        'expectedAttacks',
        'expectedSupers',
        'criticalAttacks',
        'evadedAttacks',
        'effectiveAttacks',
        'attackRaise',
        'defenseRaise',
      ],
      exclusion: null,
      reason: 'TEST ONLY unmodeled effect.',
    })),
    potential: {
      additional: 'independent-per-attack-once',
      superChance: 0.5,
      superKind: '12-ki',
      critical: 'independent',
      evasion: 'independent',
      evidenceIds: ['test-only:convention'],
    },
    assumptions: [
      'TEST ONLY model conventions; no combat or board verification.',
    ],
    evidence: [
      {
        id: 'test-only:convention',
        reference: 'test-only:hand-arithmetic',
        reviewedAt: '2026-10-20',
        sourceRevision: null,
        independentConfirmation: null,
        note: 'TEST ONLY',
      },
    ],
  };
}
export function scenario(values: Partial<Scenario> = {}): Scenario {
  return {
    id: 'test-only:scenario',
    label: 'TEST ONLY supplied sequence',
    hp: 100,
    maxHp: 100,
    initial: {
      provenance: 'manual',
      state: STATE,
      phase: 'before-attack',
      allies: [],
      values: {
        battleTurn: 1,
        appearance: 1,
        hpPercent: 100,
        attacksPerformed: 0,
        supersPerformed: 0,
        attacksReceived: 0,
        evasions: 0,
      },
    },
    actions: [{ kind: 'attack', attack: '12-ki', ki: 12, enemySurvives: true }],
    assumptions: [],
    ...values,
  };
}
export const input = (
  m: SequenceModel,
  values: Partial<SequenceInput> = {},
): SequenceInput => ({
  schemaVersion: 1,
  modelRevision: m.revision,
  scenario: scenario(),
  skills: { additional: 0, critical: 0, evasion: 0 },
  evasionAllowed: true,
  maxBranches: 4096,
  maxEvents: 50000,
  ...values,
});
