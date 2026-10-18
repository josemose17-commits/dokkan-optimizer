export type Ratings = { pressure: number; sustain: number; utility: number };

export interface Provenance {
  kind: 'synthetic' | 'verified';
  sourceId: string;
  sourceUrl: string | null;
  reuseTerms: string;
  reviewedAt: string;
  verifiedAt: string | null;
}

export interface Mechanic {
  id: string;
  status: 'supported' | 'unsupported';
  scope: 'eligibility' | 'scoring';
  description: string;
}

export interface RecordMetadata {
  id: string;
  provenance: Provenance;
  mechanics: Mechanic[];
}

// A deliberately small, explicit rule language. Unknown rules fail closed.
export type Rule =
  | { kind: 'always' }
  | { kind: 'category'; categoryId: string }
  | { kind: 'all' | 'any'; rules: Rule[] }
  | { kind: 'teamCategoryAtLeast'; categoryId: string; count: number }
  | { kind: 'partnerCategory'; categoryId: string }
  | { kind: 'turnAtLeast'; turn: number }
  | { kind: 'hpAtMost'; percent: number }
  | { kind: 'unsupported'; description: string };

export interface ConditionalEffect {
  id: string;
  label: string;
  condition: Rule;
  syntheticBonus: Partial<Ratings>;
}

export interface Unit extends RecordMetadata {
  name: string;
  awakeningState: 'base' | 'awakened' | 'enhanced';
  categories: string[];
  linkIds: string[];
  leaderSkill: { label: string; rule: Rule } | null;
  eligibilityRules: Rule[];
  syntheticRatings: Ratings;
  effects: ConditionalEffect[];
}

export interface Link extends RecordMetadata {
  name: string;
  syntheticWeight: number;
}

export interface Scenario extends RecordMetadata {
  name: string;
  description: string;
  ratingWeights: Ratings;
  turn: number;
  hpPercent: number;
}

export interface OwnedInstance {
  id: string;
  unitId: string;
}
export interface Catalog {
  units: Unit[];
  links: Link[];
}
export interface Participant {
  id: string;
  origin: 'owned' | 'friend';
  unit: Unit;
}
export type Status = 'met' | 'unmet' | 'unsupported';
export interface RuleResult {
  status: Status;
  reasons: string[];
}
export interface CoverageRow {
  participant: Participant;
  leader: RuleResult;
  friendLeader: RuleResult;
}
export interface RotationLayout {
  pairs: [[string, string], [string, string]];
  floaters: [string, string, string];
}
export interface EffectResult {
  participantId: string;
  effectId: string;
  label: string;
  outcome: RuleResult;
}
export interface ScoreComponents {
  leaderCoverage: number;
  links: number;
  conditions: number;
  scenario: number;
}
export interface Evaluation {
  key: string;
  ownedIds: string[];
  participants: Participant[];
  eligible: boolean;
  reasons: string[];
  warnings: string[];
  coverage: CoverageRow[];
  layout: RotationLayout | null;
  components: ScoreComponents | null;
  total: number | null;
  effects: EffectResult[];
  explanations: { participantId: string; text: string }[];
  weaknesses: string[];
}
export interface OptimizationRequest {
  catalog: Catalog;
  owned: OwnedInstance[];
  leaderInstanceId: string;
  friendUnitId: string;
  scenario: Scenario;
  maxCandidates: number;
  resultLimit: number;
}
export interface Replacement {
  outId: string;
  inId: string;
  alternativeKey: string;
  total: number;
  delta: number;
  componentDeltas: ScoreComponents;
}
export interface RankedTeam extends Evaluation {
  replacements: Replacement[];
}
export interface OptimizationResult {
  teams: RankedTeam[];
  errors: string[];
  warnings: string[];
  rejectedExamples: Evaluation[];
  rejectionCounts: Record<string, number>;
  search: {
    possible: number;
    evaluated: number;
    eligible: number;
    rejected: number;
    limit: number;
    truncated: boolean;
    summary: string;
  };
}
