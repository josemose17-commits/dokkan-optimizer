// TEST ONLY — fictional records for contract/search tests; never imported by the app.
import type { CatalogSnapshot, CatalogState, Fact } from './domain';

export function fixtureFact<T>(value: T): Fact<T> {
  return {
    value,
    completeness: 'complete',
    note: null,
    provenance: [
      {
        sourceId: 'test-only-source',
        locator: 'TEST ONLY — invented contract value',
        sourceRevision: 'fixture-v1',
        retrievedAt: '2026-10-19',
        reviewedAt: null,
        status: 'source-documented',
        independentConfirmation: null,
      },
    ],
  };
}
export function fixtureSnapshot(): CatalogSnapshot {
  const f = fixtureFact;
  const state = (
    id: string,
    cardId: string,
    kind: 'base' | 'eza' | 'seza',
    category: string,
  ): CatalogState => ({
    id,
    cardId,
    awakening: { kind, step: kind === 'base' ? null : kind === 'eza' ? 7 : 8 },
    region: 'fixture-region',
    gameVersion: 'fixture-build',
    fields: {
      type: f('AGL'),
      class: f('Super'),
      rarity: f('UR'),
      level: f(kind === 'base' ? 120 : 140),
      superAttackLevel: f(kind === 'base' ? 10 : 15),
      rawStats: f({ hp: 100, attack: 200, defense: 300 }),
      leaderSkill: f('TEST ONLY — fictional leader'),
      passive: f(`TEST ONLY — ${kind} passive`),
      superAttack: f('TEST ONLY — fictional effect'),
      links: f(['Fixture Link']),
      categories: f([category]),
    },
    potentialProfiles: [],
    optimization: {
      status: 'unavailable',
      evaluatorId: null,
      reason: 'TEST ONLY — descriptive record, no evaluator',
    },
  });
  const base = state(
    'fixture-seed-base',
    'fixture-seed',
    'base',
    'Fixture Green',
  );
  base.fields.rarity = f('SSR');
  base.fields.type = f('TEQ');
  const duplicateName = state(
    'fixture-other-base',
    'fixture-other',
    'base',
    'Fixture Red',
  );
  duplicateName.fields.rarity = f('LR');
  duplicateName.fields.type = f('INT');
  duplicateName.region = 'other-fixture-region';
  duplicateName.fields.categories = {
    value: null,
    completeness: 'missing',
    provenance: [],
    note: 'TEST ONLY — missing categories',
  };
  return {
    schemaVersion: 1,
    id: 'test-only-catalog',
    revision: 'fixture-v1',
    createdAt: '2026-10-19',
    origin: 'test-fixtures',
    coverage: {
      sourceCardCount: 3,
      scope: 'TEST ONLY — three invented card forms, five states',
      excluded: [],
    },
    sources: [
      {
        id: 'test-only-source',
        label: 'TEST ONLY — fictional catalog source',
        url: null,
        access: 'test-fixture',
        license: null,
        permissionReference: null,
        note: 'No real character data or game verification.',
      },
    ],
    cards: [
      {
        id: 'fixture-seed',
        name: f('TEST ONLY — Echo Seed'),
        title: f('Fixture starting card'),
        form: 'starting',
        fromCardId: null,
        aliases: [
          {
            sourceId: 'test-only-source',
            recordId: 'seed-source-id',
            region: 'fixture-region',
          },
        ],
      },
      {
        id: 'fixture-ranger',
        name: f('TEST ONLY — Écho Ranger'),
        title: f('Fixture awakened card'),
        form: 'awakened',
        fromCardId: 'fixture-seed',
        aliases: [
          {
            sourceId: 'test-only-source',
            recordId: 'ranger-source-id',
            region: 'fixture-region',
          },
        ],
      },
      {
        id: 'fixture-other',
        name: f('TEST ONLY — Écho Ranger'),
        title: f('Fixture same-name different card'),
        form: 'starting',
        fromCardId: null,
        aliases: [],
      },
    ],
    states: [
      base,
      state('fixture-ranger-base', 'fixture-ranger', 'base', 'Fixture Blue'),
      state('fixture-ranger-eza', 'fixture-ranger', 'eza', 'Fixture Red'),
      state('fixture-ranger-seza', 'fixture-ranger', 'seza', 'Fixture Gold'),
      duplicateName,
    ],
    stateAliases: [
      { alias: 'old-fixture-eza-id', stateId: 'fixture-ranger-eza' },
    ],
  };
}
