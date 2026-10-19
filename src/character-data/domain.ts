// Normalized descriptive data only. No provider requests or executable effects.
export const TYPES = ['AGL', 'TEQ', 'INT', 'STR', 'PHY'] as const;
export const RARITIES = ['N', 'R', 'SR', 'SSR', 'UR', 'LR'] as const;
export const AWAKENINGS = ['base', 'eza', 'seza', 'unknown'] as const;
export type StatBlock = { hp: number; attack: number; defense: number };
export type EvidenceStatus =
  'source-documented' | 'independently-confirmed' | 'unresolved';

export interface Provenance {
  sourceId: string;
  locator: string;
  sourceRevision: string | null;
  retrievedAt: string | null;
  reviewedAt: string | null;
  status: EvidenceStatus;
  independentConfirmation: { reference: string; date: string } | null;
}

export interface Fact<T> {
  value: T | null;
  completeness: 'complete' | 'partial' | 'missing';
  provenance: Provenance[];
  note: string | null;
}

export interface CatalogSource {
  id: string;
  label: string;
  url: string | null;
  access:
    | 'public-page'
    | 'search-index'
    | 'existing-record'
    | 'approved-export'
    | 'test-fixture';
  license: string | null;
  permissionReference: string | null;
  note: string;
}

export interface SourceAlias {
  sourceId: string;
  recordId: string;
  region: string | null;
}

export interface CatalogCard {
  id: string;
  name: Fact<string>;
  title: Fact<string>;
  aliases: SourceAlias[];
  // Ordinary Z/Dokkan awakening forms are cards; EZA/SEZA are states below.
  form: 'starting' | 'awakened' | 'transformation' | 'unknown';
  fromCardId: string | null;
}

export interface DetailFields {
  type: Fact<(typeof TYPES)[number]>;
  class: Fact<'Super' | 'Extreme'>;
  rarity: Fact<(typeof RARITIES)[number]>;
  level: Fact<number>;
  superAttackLevel: Fact<number>;
  rawStats: Fact<StatBlock>;
  leaderSkill: Fact<string>;
  passive: Fact<string>;
  superAttack: Fact<string>;
  links: Fact<string[]>;
  categories: Fact<string[]>;
}

export const DETAIL_LABELS: Record<keyof DetailFields, string> = {
  type: 'Type',
  class: 'Class',
  rarity: 'Rarity',
  level: 'Applicable level',
  superAttackLevel: 'Super Attack level',
  rawStats: 'Raw card stats',
  leaderSkill: 'Leader skill',
  passive: 'Passive',
  superAttack: 'Super Attack effects',
  links: 'Links',
  categories: 'Categories',
};

export interface CatalogState {
  id: string;
  cardId: string;
  awakening: { kind: (typeof AWAKENINGS)[number]; step: number | null };
  region: string | null;
  gameVersion: string | null;
  fields: DetailFields;
  potentialProfiles: {
    id: string;
    label: string;
    assumptions: string;
    statAdditions: Fact<StatBlock>;
  }[];
  // Historical source columns are observations, not executable progression
  // profiles. Never derive route choices or intermediate totals from them.
  reportedStats?: {
    id: string;
    label: string;
    level: number | null;
    potentialPercent: number | null;
    dupeRoutes: number | null;
    note: string;
    totals: Fact<StatBlock>;
  }[];
  optimization: {
    status: 'unavailable' | 'limited';
    evaluatorId: string | null;
    reason: string;
  };
}

export interface CatalogSnapshot {
  schemaVersion: 1;
  id: string;
  revision: string;
  createdAt: string;
  origin: 'admitted-records' | 'normalized-export' | 'test-fixtures';
  coverage: {
    sourceCardCount: number | null;
    scope: string;
    excluded: { sourceId: string; recordId: string; reason: string }[];
  };
  sources: CatalogSource[];
  cards: CatalogCard[];
  states: CatalogState[];
  stateAliases: { alias: string; stateId: string }[];
}

// A future authorized acquisition adapter produces unknown data for validation.
// Implementations live outside this module; this contract grants no access rights.
export interface AcquisitionAdapter {
  providerId: string;
  normalize(sample: unknown): unknown;
}
