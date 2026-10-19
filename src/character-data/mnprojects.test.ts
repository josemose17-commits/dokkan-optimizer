import { describe, expect, it } from 'vitest';
import type { Provenance } from './domain';
import sourceRows from '../data/real/mnprojects/facts.json' with { type: 'json' };
import manifest from '../data/real/mnprojects/manifest.json' with { type: 'json' };
import { MN_BLOB, MN_SOURCE, mnCatalog } from '../data/real/mnprojects/catalog';
import { catalogSnapshot, reviewedCatalogSnapshot } from '../data/real/catalog';
import { importMNProjects } from './mnprojects-adapter';
import { validateCatalog } from './validation';
import {
  assessCatalogUpdate,
  catalogCounts,
  searchCatalog,
  statLayers,
} from './catalog';
import {
  gokuEntry,
  productionRegistry,
} from '../data/real/character-build/registry';
import { loadCharacterState } from '../character-build/storage';
import { resolveEvaluator } from '../character-build/registry';

const metadata = {
  source: MN_SOURCE,
  revision: `git-blob:${MN_BLOB}`,
  retrievedAt: '2026-10-19',
};
const selected = (...ids: string[]) =>
  sourceRows.filter((r) => ids.includes(r.id));

describe('representative real-source mapping before expanding the same pipeline', () => {
  it('imports one ordinary LR and an EZA-bearing LR without blending state or stat scopes', () => {
    // Independently listed expected values from published rows, not generated
    // by the adapter: LR Broly trio and LR STR Vegito Blue.
    const x = importMNProjects(selected('11900', '11168'), metadata);
    expect(x.cards.map((c) => [c.aliases[0]!.recordId, c.name.value])).toEqual([
      ['11900', 'Broly & Cheelai & Lemo'],
      ['11168', 'Super Saiyan God SS Vegito'],
    ]);
    expect(
      x.states.map((s) => [
        s.cardId,
        s.awakening.kind,
        s.fields.level.value,
        s.fields.superAttackLevel.value,
      ]),
    ).toEqual([
      ['mnprojects:card:11900', 'base', 150, 20],
      ['mnprojects:card:11168', 'base', null, null],
      ['mnprojects:card:11168', 'eza', null, null],
    ]);
    const b = x.states[0]!;
    expect(b.fields.rawStats.value).toEqual({
      hp: 21575,
      attack: 15275,
      defense: 7744,
    });
    expect(
      b.reportedStats!.find((p) => p.id.startsWith('free-dupe'))!.totals.value,
    ).toEqual({ hp: 23575, attack: 17275, defense: 9744 });
    expect(
      b.reportedStats!.find((p) => p.id.startsWith('rainbow'))!.totals.value,
    ).toEqual({ hp: 26975, attack: 20275, defense: 12344 });
    expect(
      b.reportedStats!.map((p) => [p.potentialPercent, p.dupeRoutes]),
    ).toEqual([
      [null, null],
      [null, null],
      [null, null],
      [null, null],
    ]);
    expect(x.states[1]!.fields.rawStats.value).toBeNull();
    expect(x.states[2]!.reportedStats).toBeUndefined();
    expect(
      x.states.every(
        (s) =>
          s.optimization.evaluatorId === null &&
          s.potentialProfiles.length === 0 &&
          s.fields.passive.value === null,
      ),
    ).toBe(true);
  });
  it('retains the mixed-level historical Goku row as reported data, not current raw EZA stats', () => {
    const x = importMNProjects(selected('1321'), metadata);
    expect(x.states.map((s) => s.awakening.kind)).toEqual(['base', 'eza']);
    expect(
      x.states.every(
        (s) =>
          s.fields.rawStats.value === null && s.fields.level.value === null,
      ),
    ).toBe(true);
    expect(x.states[0]!.reportedStats![1]!.totals.value).toEqual({
      hp: 9500,
      attack: 8672,
      defense: 4623,
    });
    expect(x.states[0]!.reportedStats![1]!.level).toBeNull();
    expect(gokuEntry.model.card.baseStats).toEqual({
      hp: 12527,
      attack: 11111,
      defense: 5796,
    });
  });
  it('does not guess conflicting IDs or discard characters just because some fields are missing', () => {
    const x = importMNProjects(
      selected('12521', '11148', '12060', '11378'),
      metadata,
    );
    expect(x.cards.map((c) => c.aliases[0]!.recordId).sort()).toEqual([
      '11378',
      '12060',
    ]);
    expect(x.exclusions.map((e) => e.recordId)).toEqual([
      '11148@row-788',
      '12521@row-344',
      '12521@row-605',
    ]);
    expect(
      x.states.find((s) => s.cardId.endsWith('12060'))!.fields.type.value,
    ).toBeNull();
    expect(
      x.states.find((s) => s.cardId.endsWith('11378'))!.fields.superAttackLevel
        .value,
    ).toBeNull();
  });
  it('groups an identical source identity while exposing conflicting row fields and stat alternatives', () => {
    const x = importMNProjects(selected('11066'), metadata);
    expect(x.cards).toHaveLength(1);
    expect(x.states).toHaveLength(2);
    expect(x.states[0]!.fields.categories.value).toBeNull();
    expect(x.states[0]!.fields.categories.note).toContain('rows disagree');
    expect(x.states[0]!.reportedStats).toHaveLength(8);
    expect(x.report.duplicateRowGroups[0]!.rows).toEqual([199, 519]);
  });
});

describe('full pinned UR/LR reconciliation and compatibility', () => {
  it('reconciles source rows, catalog identities and awakening revisions separately', () => {
    expect(mnCatalog.report).toMatchObject({
      sourceRows: 796,
      acceptedRows: 793,
      importedCards: 792,
      importedStates: 1106,
      baseStates: 792,
      ezaStates: 314,
      sezaStates: 0,
      excludedRows: [344, 605, 788],
      embeddedFormsNotMapped: 125,
    });
    expect(
      mnCatalog.cards.filter((c) =>
        mnCatalog.states.some(
          (s) => s.cardId === c.id && s.fields.rarity.value === 'LR',
        ),
      ),
    ).toHaveLength(113);
    expect(manifest).toMatchObject(mnCatalog.report);
    expect(manifest.sourceGitBlob).toBe(MN_BLOB);
    expect(manifest.exclusions).toEqual(mnCatalog.exclusions);
    expect(new Set(mnCatalog.cards.map((c) => c.id)).size).toBe(792);
    expect(new Set(mnCatalog.states.map((s) => s.id)).size).toBe(1106);
    expect(
      mnCatalog.states.every((s) =>
        ['UR', 'LR'].includes(s.fields.rarity.value!),
      ),
    ).toBe(true);
    expect(validateCatalog(catalogSnapshot).ok).toBe(true);
    expect(catalogCounts(catalogSnapshot)).toMatchObject({
      cards: 794,
      states: 1109,
      baseStates: 793,
      ezaStates: 316,
      sezaStates: 0,
      excluded: 3,
    });
  });
  it('searches the full source catalog by name, type, rarity, category and awakening', () => {
    const rows = searchCatalog(catalogSnapshot, {
      query: 'Broly Cheelai',
      rarity: 'LR',
      type: 'PHY',
      category: 'Joined Forces',
      awakening: 'base',
    });
    expect(rows.map((r) => r.card.id)).toEqual(['mnprojects:card:11900']);
    expect(searchCatalog(catalogSnapshot, { rarity: 'SSR' })).toEqual([]);
    expect(searchCatalog(catalogSnapshot, { awakening: 'seza' })).toEqual([]);
    expect(
      searchCatalog(catalogSnapshot, { query: 'Vegito', awakening: 'eza' })
        .length,
    ).toBeGreaterThan(0);
  });
  it('preserves reviewed exact IDs/evaluators, saved settings and update compatibility byte-for-byte', () => {
    const before = JSON.stringify(reviewedCatalogSnapshot.states);
    for (const old of reviewedCatalogSnapshot.states)
      expect(catalogSnapshot.states.find((s) => s.id === old.id)).toEqual(old);
    expect(JSON.stringify(reviewedCatalogSnapshot.states)).toBe(before);
    expect(
      assessCatalogUpdate(reviewedCatalogSnapshot, catalogSnapshot),
    ).toMatchObject({
      compatible: true,
      issues: [],
      changes: [],
      cardChanges: [],
      sourceChanges: [],
    });
    const raw = JSON.stringify({
      version: 1,
      catalogRevision: gokuEntry.model.revision,
      request: gokuEntry.defaults(),
    });
    const store = {
      getItem: () => raw,
      setItem: () => {
        throw new Error('Must not write');
      },
    };
    expect(loadCharacterState(store, gokuEntry)).toMatchObject({
      state: gokuEntry.defaults(),
      warning: null,
    });
    expect(
      resolveEvaluator(productionRegistry, catalogSnapshot, gokuEntry.stateId)
        .ok,
    ).toBe(true);
    for (const s of mnCatalog.states)
      expect(
        resolveEvaluator(productionRegistry, catalogSnapshot, s.id).ok,
      ).toBe(false);
  });
  it('does not add reported totals into raw/potential/equipment/battle layers or executable choices', () => {
    const s = mnCatalog.states.find(
      (s) => s.cardId === 'mnprojects:card:11900',
    )!;
    expect(statLayers(s, null, { hp: 0, attack: 0, defense: 0 })).toMatchObject(
      {
        raw: { hp: 21575, attack: 15275, defense: 7744 },
        potential: { hp: 0, attack: 0, defense: 0 },
        battle: null,
      },
    );
    const serialized = JSON.stringify(mnCatalog);
    for (const forbidden of [
      'imageURL',
      'nocookie.net',
      '<script',
      'ezaPassive',
      'ATK & DEF +15% per Ki',
    ])
      expect(serialized).not.toContain(forbidden);
    expect(
      mnCatalog.states.every((s) =>
        Object.values(s.fields).every((f) =>
          f.provenance.every(
            (p: Provenance) => p.independentConfirmation === null,
          ),
        ),
      ),
    ).toBe(true);
  });
  it('reports stat-table updates and rejects invalid/unknown profile fields', () => {
    const next = structuredClone(catalogSnapshot),
      s = next.states.find((s) => s.reportedStats)!;
    s.reportedStats![0]!.totals.note = 'Reviewed scope correction';
    expect(assessCatalogUpdate(catalogSnapshot, next).changes).toContainEqual({
      stateId: s.id,
      fields: ['reportedStats'],
    });
    for (const mutation of [
      (p: Record<string, unknown>) => {
        p.potentialPercent = 101;
      },
      (p: Record<string, unknown>) => {
        p.dupeRoutes = 5;
      },
      (p: Record<string, unknown>) => {
        p.formula = 'invented';
      },
    ]) {
      const bad = structuredClone(catalogSnapshot);
      mutation(
        bad.states.find((s) => s.reportedStats)!
          .reportedStats![0]! as unknown as Record<string, unknown>,
      );
      expect(validateCatalog(bad).ok).toBe(false);
    }
  });
  it('rejects unknown projection fields and duplicate row addresses, and excludes lower rarities explicitly', () => {
    const row = structuredClone(sourceRows[0]!);
    expect(() =>
      importMNProjects([{ ...row, privateEndpoint: 'ignored?' }], metadata),
    ).toThrow();
    expect(() => importMNProjects([row, row], metadata)).toThrow();
    const lower = importMNProjects([{ ...row, rarity: 'SSR' }], metadata);
    expect(lower.cards).toEqual([]);
    expect(lower.exclusions).toHaveLength(1);
  });
});
