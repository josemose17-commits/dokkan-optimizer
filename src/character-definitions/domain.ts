// User-authored definitions are inputs, never admitted game facts or executable code.
import type { AWAKENINGS, RARITIES, TYPES } from '../character-data/domain';

export const STATS = ['hp', 'attack', 'defense'] as const;
export type Stat = (typeof STATS)[number];
export type Values = Record<Stat, number | null>;
export const SKILLS = ['additional', 'critical', 'evasion'] as const;
export type SkillValues = Record<(typeof SKILLS)[number], number | null>;
export const ABILITIES = [
  'leader',
  'passive',
  'super',
  'unit-super',
  'active',
  'standby',
  'finish',
  'transformation',
  'exchange',
  'domain',
  'revival',
  'other',
] as const;
export const FAMILIES = [
  'flat-stat',
  'percent-stat',
  'ki',
  'additional-attack',
  'additional-super',
  'critical',
  'evasion',
  'guard',
  'damage-reduction',
  'type-effectiveness',
  'support',
  'healing',
  'debuff',
  'status',
  'counter',
  'nullification',
  'guaranteed-outcome',
  'foresee-attacks',
  'revival',
  'form-change',
  'orb-change',
  'restriction',
  'other',
] as const;
export const PHASES = [
  'snapshot',
  'start-of-turn',
  'before-attack',
  'after-attack',
  'before-hit',
  'after-hit',
  'appearance-start',
  'attack-activation',
  'super-activation',
  'damage-calculation',
  'after-evade',
  'turn-end',
  'other',
] as const;
export type Phase = (typeof PHASES)[number];

// Each key names one manually specified quantity. Turns and appearances, team
// and rotation, and self-included and other-ally counts are deliberately distinct.
export const CONTEXT_FIELDS = {
  hpPercent: { label: 'Current HP (%)', min: 0, max: 100, integer: false },
  battleTurn: {
    label: 'Battle turn',
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
    integer: true,
  },
  appearance: {
    label: 'Character appearance',
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
    integer: true,
  },
  slot: { label: 'Rotation slot', min: 1, max: 3, integer: true },
  attackPosition: {
    label: 'Attack position',
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
    integer: true,
  },
  attacksPerformed: {
    label: 'Attacks performed',
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    integer: true,
  },
  attacksReceived: {
    label: 'Attacks received',
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    integer: true,
  },
  supersPerformed: {
    label: 'Super Attacks performed',
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    integer: true,
  },
  evasions: {
    label: 'Evasion events',
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    integer: true,
  },
  enemies: {
    label: 'Enemy count',
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    integer: true,
  },
  ki: { label: 'Ki', min: 0, max: Number.MAX_SAFE_INTEGER, integer: true },
  collectedOrbs: {
    label: 'Collected orbs',
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    integer: true,
  },
} as const;
export type ContextKey = keyof typeof CONTEXT_FIELDS;
export const OPERATORS = ['>=', '>', '=', '<=', '<'] as const;
export type Condition =
  | { kind: 'always' }
  | { kind: 'all'; children: Condition[] }
  | { kind: 'any'; children: Condition[] }
  | {
      kind: 'threshold';
      field: ContextKey;
      operator: (typeof OPERATORS)[number];
      value: number;
    }
  | {
      kind: 'ally';
      scope: 'team' | 'rotation';
      includeSelf: boolean;
      match: 'name' | 'category' | 'type';
      value: string;
      minimum: number;
    }
  | { kind: 'state'; value: string }
  | { kind: 'other'; description: string };

export interface SourceNote {
  field: string;
  status: 'user-entered' | 'source-documented';
  reference: string;
  note: string;
}
export interface Effect {
  id: string;
  label: string;
  family: (typeof FAMILIES)[number];
  representation: 'recorded-only' | 'structured';
  target: 'self' | 'allies-including-self' | 'other-allies' | 'enemy' | 'other';
  stat: Stat | null;
  amount: number | null;
  unit: 'flat' | 'percent' | 'probability' | 'count' | 'unknown';
  condition: Condition;
  timing: Phase;
  duration: {
    kind: 'snapshot' | 'turns' | 'appearances' | 'permanent' | 'other';
    count: number | null;
  };
  stacking: 'once' | 'additive' | 'multiplicative' | 'unknown';
  cap: number | null;
  reset: string;
  dependencies: string[];
  description: string;
  source: SourceNote;
}
export interface Ability {
  id: string;
  name: string;
  kind: (typeof ABILITIES)[number];
  wording: string;
  effects: Effect[];
}
export interface CharacterDefinition {
  id: string; // Exact authored state; revisions keep this ID.
  cardId: string; // Ordinary card/form identity; EZA/SEZA can share it.
  revision: number;
  origin: 'user';
  name: string;
  title: string;
  type: (typeof TYPES)[number] | null;
  rarity: (typeof RARITIES)[number] | null;
  level: number | null;
  superAttackLevel: number | null;
  awakening: { kind: (typeof AWAKENINGS)[number]; step: number | null };
  region: string;
  gameVersion: string;
  rawStats: Values;
  links: string[] | null;
  categories: string[] | null;
  relations: {
    kind: 'awakens-from' | 'transforms-to' | 'exchanges-with' | 'alternate';
    targetId: string;
    note: string;
  }[];
  sourceBinding: {
    cardId: string;
    stateId: string;
    catalogRevision: string;
  } | null;
  sourceNotes: SourceNote[];
  notes: string;
  abilities: Ability[];
}
export const SLOTS = ['bronze', 'silver', 'gold'] as const;
export type Slot = (typeof SLOTS)[number];
export type Requirement =
  | { kind: 'type' | 'category' | 'state'; value: string }
  | { kind: 'routes'; minimum: number }
  | { kind: 'sa'; minimum: number }
  | { kind: 'other'; description: string };
export interface Equipment {
  id: string;
  name: string;
  slot: Slot;
  stats: Values;
  skills: SkillValues;
  requirements: Requirement[];
  otherEffects: string;
  source: SourceNote;
}
export interface Configuration {
  id: string;
  name: string;
  mode: 'custom';
  potentialStats: Values;
  skills: SkillValues;
  unlockedRoutes: number | null;
  slots: Record<Slot, 'available' | 'unavailable' | 'unknown'>;
  equips: Record<Slot, string | null>;
  notes: string;
}
export interface SnapshotContext {
  provenance: 'manual';
  phase: Phase;
  values: Partial<Record<ContextKey, number | null>>;
  allies: {
    scope: 'team' | 'rotation';
    includeSelf: boolean;
    match: 'name' | 'category' | 'type';
    value: string;
    count: number | null;
  }[];
  state: string | null;
}
export interface DefinitionDocument {
  definition: CharacterDefinition;
  configurations: Configuration[];
  equipment: Equipment[];
  baselineId: string;
  context: SnapshotContext;
}
export interface DefinitionLibrary {
  schemaVersion: 1;
  documents: DefinitionDocument[]; // Immutable (state ID, revision) snapshots.
}

export const emptyValues = (): Values => ({
  hp: null,
  attack: null,
  defense: null,
});
export const emptySkills = (): SkillValues => ({
  additional: null,
  critical: null,
  evasion: null,
});
export const userSource = (field = ''): SourceNote => ({
  field,
  status: 'user-entered',
  reference: '',
  note: '',
});
export const emptyConfiguration = (
  id: string,
  name: string,
): Configuration => ({
  id,
  name,
  mode: 'custom',
  potentialStats: emptyValues(),
  skills: emptySkills(),
  unlockedRoutes: null,
  slots: { bronze: 'unknown', silver: 'unknown', gold: 'unknown' },
  equips: { bronze: null, silver: null, gold: null },
  notes: '',
});
export function newDocument(
  id: string,
  cardId: string,
  buildId: string,
): DefinitionDocument {
  return {
    definition: {
      id,
      cardId,
      revision: 1,
      origin: 'user',
      name: 'Untitled character',
      title: '',
      type: null,
      rarity: null,
      level: null,
      superAttackLevel: null,
      awakening: { kind: 'unknown', step: null },
      region: '',
      gameVersion: '',
      rawStats: emptyValues(),
      links: null,
      categories: null,
      relations: [],
      sourceBinding: null,
      sourceNotes: [],
      notes: '',
      abilities: [],
    },
    configurations: [emptyConfiguration(buildId, 'Current build')],
    equipment: [],
    baselineId: buildId,
    context: {
      provenance: 'manual',
      phase: 'snapshot',
      values: {},
      allies: [],
      state: null,
    },
  };
}
export const newEffect = (id: string): Effect => ({
  id,
  label: 'Stat addition',
  family: 'flat-stat',
  representation: 'structured',
  target: 'self',
  stat: 'attack',
  amount: null,
  unit: 'flat',
  condition: { kind: 'always' },
  timing: 'snapshot',
  duration: { kind: 'snapshot', count: null },
  stacking: 'once',
  cap: null,
  reset: '',
  dependencies: [],
  description: '',
  source: userSource('effect'),
});
