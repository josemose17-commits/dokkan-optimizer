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

// Evaluation facts for ONE exact card state. Identity is matched against the
// catalog state by the registry; these fields never select a state by name.
export interface CardState extends Metadata {
  name: string;
  title: string;
  region: string;
  type: string;
  rarity: 'UR' | 'LR';
  awakening: string;
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
export const METRIC_KEYS: readonly MetricKey[] = [
  ...AVAILABLE_METRICS,
  'additionalTrigger',
  'damage',
  'battleDefense',
];
export const METRIC_LABELS: Record<MetricKey, string> = {
  attack: 'Card ATK',
  defense: 'Card DEF',
  hp: 'Card HP',
  additionalSuper: 'Initial extra Super',
  additionalTrigger: 'Initial AA trigger',
  critical: 'Critical chance',
  evasion: 'Evasion chance',
  damage: 'Damage',
  battleDefense: 'Battle DEF',
};
// Every currently offered objective is better when higher. Ranking and
// dominance read this map instead of assuming a direction.
export type Direction = 'higher' | 'lower';
export const METRIC_DIRECTION: Record<MetricKey, Direction> = {
  attack: 'higher',
  defense: 'higher',
  hp: 'higher',
  additionalSuper: 'higher',
  additionalTrigger: 'higher',
  critical: 'higher',
  evasion: 'higher',
  damage: 'higher',
  battleDefense: 'higher',
};
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

// A value's provenance inside one evaluation. Explanations are rendered from
// these records, never from separately written prose.
export interface Contribution<T> {
  source: 'card' | 'potential' | 'node' | 'equip';
  label: string;
  slot: Slot | null;
  itemId: string | null;
  nodeId: string | null;
  values: T;
  evidenceIds: string[];
}
export interface ProbabilityStep {
  metric: MetricKey;
  // value = product of factor values; an empty list means a context-fixed value.
  factors: { label: string; value: number; kind: 'level' | 'rate' }[];
  value: number;
  evidenceIds: string[];
  note: string;
}
export interface CalculationTrace {
  stats: Contribution<Partial<Stats>>[];
  skills: Contribution<Partial<Skills>>[];
  probabilities: ProbabilityStep[];
}

export interface Evaluation {
  comparisonKey: string;
  metrics: Metrics;
  skills: Skills;
  stats: Stats;
  trace: CalculationTrace;
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
  // Why a group is off the frontier: the first dominating evaluation in rank
  // order (or the baseline) and the metrics where it is strictly better.
  dominatedBy: { kind: 'group'; id: string } | { kind: 'baseline' } | null;
  dominatedOn: MetricKey[];
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

// ---- Registry contracts -------------------------------------------------

// A supported evaluation context. Values outside these options fail closed.
export interface ContextDefinition {
  id: Context['id'];
  label: string;
  assumptions: string[];
  evasionOptions: boolean[];
}

// An evaluator implementation is independent of any one character: it reads
// the entry's model, contexts and objectives.
export interface EvaluatorImplementation {
  id: string;
  version: string;
  label: string;
  // What has been checked about this implementation. Mathematical tests are
  // not evidence of game behavior.
  verification: string;
  // Implementation-specific requirements on an entry (e.g. rule evidence).
  entryErrors?(entry: EvaluatorEntry): string[];
  evaluate(
    build: Build,
    request: BuildRequest,
    entry: EvaluatorEntry,
  ): Evaluation;
}

// One registered optimization target: an exact catalog state bound to its
// evaluation data and an implementation. Selected only by stable IDs.
export interface EvaluatorEntry {
  // Equals the catalog state's optimization.evaluatorId; recorded with saves.
  id: string;
  catalogCardId: string;
  stateId: string;
  // Exact state facts, progression profile, compatible equipment, evidence.
  model: CharacterCatalog;
  contexts: ContextDefinition[];
  objectives: AvailableMetric[];
  evaluator: EvaluatorImplementation;
  // Working-settings key; the original Goku entry keeps its v1 key.
  storageKey: string;
  defaults(): BuildRequest;
  recommendationSupport?: Partial<
    Record<
      AvailableMetric,
      {
        scope: 'card-stat-only' | 'initial-check-model';
        evidenceIds: string[];
        blockers: string[];
        excludes: string[];
      }
    >
  >;
}
