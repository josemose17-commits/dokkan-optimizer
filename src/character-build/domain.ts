export const SLOTS = ['bronze', 'silver', 'gold'] as const;
export type Slot = (typeof SLOTS)[number];
export const SKILLS = ['additional', 'critical', 'evasion'] as const;
export type Skill = (typeof SKILLS)[number];
export type Stats = { hp: number; attack: number; defense: number };
export type Skills = Record<Skill, number>;
export type Route = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export interface Evidence {
  id: string;
  field: string;
  statement: string;
  status: 'documented' | 'independently-corroborated' | 'unresolved';
  sources: { label: string; url: string; access: 'page' | 'search-index' }[];
  independentConfirmation: string | null;
  reviewedAt: string;
  verifiedAt: string | null;
  limitation: string;
}

export interface Metadata {
  id: string;
  evidenceIds: string[];
  reviewedAt: string;
  verifiedAt: string | null;
  support: 'supported' | 'unsupported';
}

export interface CardState extends Metadata {
  name: string;
  title: string;
  region: 'global-en';
  type: string;
  rarity: 'UR' | 'LR';
  awakening: 'eza-step-7';
  level: number;
  superAttackLevel: number;
  gameBuild: string | null;
  sourceAliases: { source: string; id: string }[];
  baseStats: Stats;
  categories: string[];
  excludedMechanics: string[];
}

// These model supplied, reviewed choice nodes. The released real profile has none.
// Test-only graphs never populate the real catalog.
export interface ChoiceNode extends Metadata {
  route: Route;
  levels: number;
  options: Skill[];
  prerequisites: string[];
  minSuperAttackLevel: number;
}

export interface PotentialProfile extends Metadata {
  label: string;
  cardStateId: string;
  routes: Route[];
  statBonus: Stats;
  fixedSkills: Skills;
  nodes: ChoiceNode[];
}

export type Restriction =
  | { kind: 'type'; value: string }
  | { kind: 'category'; value: string }
  | { kind: 'cardState'; value: string }
  | { kind: 'unsupported'; description: string };

export interface Orb extends Metadata {
  label: string;
  slots: Slot[];
  minSuperAttackLevel: number;
  minRoutes: number;
  restrictions: Restriction[];
  stats: Partial<Stats>;
  skills: Partial<Skills>;
  reusable: boolean;
  // Internal signature IDs are not invented game item IDs.
  gameItemId: string | null;
}

export interface CharacterCatalog {
  revision: string;
  card: CardState;
  profile: PotentialProfile;
  orbs: Orb[];
  evidence: Evidence[];
}

export interface Build {
  choices: Record<string, Skill>;
  equips: Record<Slot, string | null>;
}

export interface Context {
  id: 'initial-check-v1';
  battleTurn: 1;
  appearance: 1;
  initialAttack: 'super';
  externalEffects: 'none';
  evasionAllowed: boolean;
}

export const AVAILABLE_METRICS = [
  'attack',
  'defense',
  'hp',
  'additionalSuper',
  'critical',
  'evasion',
] as const;
export type AvailableMetric = (typeof AVAILABLE_METRICS)[number];
export type MetricKey =
  AvailableMetric | 'additionalTrigger' | 'damage' | 'battleDefense';
export interface Metric {
  value: number | null;
  unit: 'stat' | 'probability' | 'damage';
  evidenceIds: string[];
  reason: string;
}
export type Metrics = Record<MetricKey, Metric>;

export interface BuildRequest {
  cardStateId: string;
  level: number;
  superAttackLevel: number;
  progression: {
    profileId: string;
    systemUnlocked: boolean;
    routes: Route[];
    activatedNodes: string[];
  };
  current: Build;
  // Counts are unequipped copies. Current equips remain available to retain.
  inventory: Record<string, number>;
  mode: 'inventory' | 'catalog';
  context: Context;
  objective: AvailableMetric;
  frontierMetrics: AvailableMetric[];
  maxCandidates: number;
}

export interface Evaluation {
  comparisonKey: string;
  metrics: Metrics;
  skills: Skills;
  stats: Stats;
}
export interface Alternative {
  build: Build;
  changes: string[];
  missingInventory: Record<string, number>;
  isCurrent: boolean;
}
export interface BuildGroup {
  id: string;
  rank: number;
  evaluation: Evaluation;
  alternatives: Alternative[];
  deltas: Record<MetricKey, number | null>;
  frontier: boolean;
}
export interface ComparisonResult {
  errors: string[];
  current: Evaluation | null;
  groups: BuildGroup[];
  frontier: {
    metricsUsed: MetricKey[];
    omittedMetrics: MetricKey[];
    comparable: boolean;
    reason: string;
  };
  search: {
    evaluated: number;
    unique: number;
    totalLegal: number | null;
    limit: number;
    truncated: boolean;
  };
}
