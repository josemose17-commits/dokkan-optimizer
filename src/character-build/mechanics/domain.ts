import type {
  Ability,
  Condition,
  Effect,
  SnapshotContext,
} from '../../character-definitions/domain';
import type { Skills } from '../domain';

// This contract describes an explicit event/probability model. It does not
// supply a damage formula, a board template, or a game-verification claim.
export const SEQUENCE_VERSION = 1 as const;
export const EVENTS = [
  'appearance-start',
  'start-of-turn',
  'before-attack',
  'attack-activation',
  'super-activation',
  'damage-calculation',
  'after-attack',
  'before-hit',
  'after-hit',
  'after-evade',
  'turn-end',
] as const;
export type Event = (typeof EVENTS)[number];
export type SuperKind = '12-ki' | '18-ki' | 'unspecified-super';
export type AttackKind = 'normal' | SuperKind;
export type AttackSource = 'initial' | 'native' | 'potential';
export const SEQUENCE_METRICS = [
  'expectedAttacks',
  'expectedSupers',
  'criticalAttacks',
  'evadedAttacks',
  'effectiveAttacks',
  'attackRaise',
  'defenseRaise',
] as const;
export type SequenceMetric = (typeof SEQUENCE_METRICS)[number];

export interface Rule {
  effectId: string;
  event: Event;
  // Explicit filter: an 18-Ki initial Super does not make additional Supers
  // 18-Ki, and an initial-only effect never applies to an additional attack.
  attack: { sources: AttackSource[]; kinds: AttackKind[] } | null;
  operation:
    | {
        kind: 'additional';
        chance: number;
        superChance: number;
        superKind: SuperKind;
      }
    | {
        kind: 'critical' | 'evasion';
        combine: 'independent' | 'additive' | 'maximum';
      }
    | { kind: 'effective' }
    | { kind: 'raise'; group: string };
  // Attempts and activations differ: failing a once-per-turn roll does not
  // grant unlimited later retries. Conditions are evaluated before attempting.
  maxAttemptsPerTurn: number;
  maxActivations: number | null;
}
export interface EffectCoverage {
  effectId: string;
  affects: SequenceMetric[];
  // An unmodeled effect is never silently discarded. A documented scope may
  // establish that it cannot activate in this particular scenario.
  exclusion: {
    scenarioIds: string[];
    scenarioSignatures: Record<string, string>;
    reason: string;
  } | null;
  reason: string;
}
export interface SequenceModel {
  schemaVersion: 1;
  id: string;
  revision: string;
  cardId: string;
  stateId: string;
  dataRevision: string;
  abilities: Ability[];
  rules: Rule[];
  coverage: EffectCoverage[];
  potential: {
    // Each completed non-potential attack supplies one independent trial;
    // at most one additional attack is released after the native chain.
    additional: 'independent-per-attack-once' | 'disabled' | 'unknown';
    superChance: number;
    superKind: SuperKind;
    critical: 'independent' | 'disabled' | 'unknown';
    evasion: 'independent' | 'disabled' | 'unknown';
    evidenceIds: string[];
  };
  assumptions: string[];
  evidence: {
    id: string;
    reference: string;
    reviewedAt: string;
    sourceRevision: string | null;
    independentConfirmation: string | null;
    note: string;
  }[];
}

export type Action =
  | { kind: 'attack'; attack: AttackKind; ki: number; enemySurvives: boolean }
  // Damage is a supplied resolved amount, never calculated from DEF. A null
  // amount keeps death-dependent subsequent actions unavailable.
  | {
      kind: 'incoming';
      evadable: boolean;
      damageOnHit: number | null;
      guarded: boolean;
    }
  | {
      kind: 'advance';
      battleTurn: number;
      appearance: number;
      values: SnapshotContext['values'];
    };
export interface Scenario {
  id: string;
  label: string;
  initial: SnapshotContext;
  hp: number | null;
  maxHp: number | null;
  actions: Action[];
  assumptions: string[];
}
export interface SequenceInput {
  schemaVersion: 1;
  modelRevision: string;
  scenario: Scenario;
  skills: Skills;
  evasionAllowed: boolean;
  // Technical bounds, independent of undocumented game maximums.
  maxBranches: number;
  maxEvents: number;
}
export interface Buff {
  effectId: string;
  family: Effect['family'];
  stat: Effect['stat'];
  amount: number;
  group: string;
  combine: 'independent' | 'additive' | 'maximum';
  stacking: Effect['stacking'];
  expiresAfterTurn: number | null;
  expiresAfterAppearance: number | null;
}
export interface Counters {
  attacksPerformed: number;
  supersPerformed: number;
  attacksReceived: number;
  evasions: number;
}
export interface Attack {
  source: AttackSource;
  kind: AttackKind;
  ki: number | null;
  enemySurvives: boolean;
}
export interface EventTrace {
  index: number;
  event: Event;
  turn: number;
  appearance: number;
  attack: { source: AttackSource; kind: AttackKind } | null;
  effectIds: string[];
  note: string;
  probability: number;
  // Modelled effect factors, deliberately separate from card/battle stats.
  attackFactor: number;
  defenseFactor: number;
  counters: Counters;
}
export interface Branch {
  probability: number;
  alive: boolean;
  enemyAlive: boolean;
  hp: number | null;
  hpPercent: number | null;
  turn: number;
  appearance: number;
  counters: Counters;
  totals: {
    attacks: number;
    supers: number;
    critical: number;
    evaded: number;
    effective: number;
  };
  buffs: Buff[];
  attempts: Record<string, number>;
  activations: Record<string, number>;
  // Activation flags are local to this branch and reset each turn. They can
  // name another effect or a supported event (e.g. event:guard).
  activated: string[];
  potentialMiss: number;
  potentialReleased: boolean;
  pending: Attack[];
  trace: EventTrace[];
}
export type SequenceResult =
  | {
      status: 'unavailable';
      reasons: string[];
      metrics: Record<SequenceMetric, null>;
      branches: [];
      probabilityMass: null;
    }
  | {
      status: 'evaluated';
      reasons: [];
      metrics: Record<SequenceMetric, number | null>;
      branches: Branch[];
      probabilityMass: number;
    };

export const allEffects = (model: SequenceModel) =>
  model.abilities.flatMap((a) => a.effects);
export interface MechanicSupport {
  recorded: true;
  structured: boolean;
  implemented: boolean;
  supported: boolean;
  reasons: string[];
}
export type SequenceCondition = Condition;
