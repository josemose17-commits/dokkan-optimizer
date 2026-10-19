import type { CharacterCatalog } from '../character-build/domain';
import type {
  CatalogSnapshot,
  CatalogSource,
  Fact,
  Provenance,
} from './domain';

/** Migration of ALREADY admitted local facts. This is not a provider acquisition adapter. */
export function fromAdmittedRecord(
  legacy: CharacterCatalog,
  cardId: string,
): CatalogSnapshot {
  if (
    legacy.card.id !== 'global-en:1003211:eza-7:lv140:sa15' ||
    legacy.card.type !== 'AGL' ||
    legacy.card.rarity !== 'UR' ||
    legacy.card.level !== 140 ||
    legacy.card.superAttackLevel !== 15
  )
    throw new Error(
      'This local migration only admits the existing exact EZA Goku record.',
    );
  const sources: CatalogSource[] = [];
  const sourceId = (
    label: string,
    url: string | null,
    access: CatalogSource['access'],
  ) => {
    const id = `reference:${url ?? label}`;
    if (!sources.some((source) => source.id === id))
      sources.push({
        id,
        label,
        url,
        access,
        license: null,
        permissionReference: null,
        note: 'Existing individually admitted record; no new acquisition or bulk redistribution grant. License scope is unassessed.',
      });
    return id;
  };
  const refs = (evidenceIds: string[]): Provenance[] =>
    evidenceIds.flatMap((id) => {
      const evidence = legacy.evidence.find((e) => e.id === id);
      if (!evidence) return [];
      return evidence.sources.map((source) => ({
        sourceId: sourceId(
          source.label,
          source.url,
          source.access === 'page' ? 'public-page' : 'search-index',
        ),
        locator: `${evidence.field} — ${evidence.statement}`,
        sourceRevision: null,
        retrievedAt: null,
        reviewedAt: evidence.reviewedAt,
        // No existing record has a recorded independent confirmation/date.
        status:
          evidence.status === 'unresolved'
            ? ('unresolved' as const)
            : ('source-documented' as const),
        independentConfirmation: null,
      }));
    });
  const present = <T>(
    value: T,
    ids: string[],
    note: string | null = null,
  ): Fact<T> => ({
    value,
    completeness: note ? 'partial' : 'complete',
    provenance: refs(ids),
    note,
  });
  const missing = <T>(note: string): Fact<T> => ({
    value: null,
    completeness: 'missing',
    provenance: [],
    note,
  });
  const identity = ['identity'];
  const card = legacy.card;
  const name = present(card.name, identity);
  const title = present(card.title, identity);
  const aliases = card.sourceAliases.map((alias) => ({
    sourceId: sourceId(alias.source, null, 'existing-record'),
    recordId: alias.id,
    region: card.region,
  }));
  const state: CatalogSnapshot['states'][number] = {
    // Keep the exact existing saved-build ID; catalog revision is separate.
    id: card.id,
    cardId,
    awakening: { kind: 'eza', step: 7 },
    region: card.region,
    gameVersion: card.gameBuild,
    fields: {
      type: present('AGL', identity),
      class: present('Super', identity),
      rarity: present(card.rarity, identity),
      level: present(card.level, identity),
      superAttackLevel: present(card.superAttackLevel, identity),
      rawStats: present({ ...card.baseStats }, ['card-stats']),
      leaderSkill: missing(
        'Leader-skill details are not in the existing admitted record.',
      ),
      passive: present(
        'DEF bonus and a timed ATK bonus; no native additional attack, critical hit or evasion.',
        ['eza-kit'],
        'Summary only. Exact values, expiry interpretation and battle calculation stages were not admitted.',
      ),
      superAttack: present(
        'Enemy DEF debuff.',
        ['eza-kit'],
        'Summary only. The exact Super Attack description and debuff values were not admitted.',
      ),
      links: missing(
        'Link names/effects have not been admitted. Unknown does not mean no links.',
      ),
      // Legacy [] meant "not imported", not an established empty category set.
      categories: missing(
        'Categories have not been admitted. Unknown does not mean no categories.',
      ),
    },
    potentialProfiles: [
      {
        id: legacy.profile.id,
        label: legacy.profile.label,
        assumptions:
          'Filled 55% board, zero duplicate routes; this stat profile does not establish a choice-node topology.',
        statAdditions: present({ ...legacy.profile.statBonus }, ['base-board']),
      },
    ],
    optimization: {
      status: 'limited',
      evaluatorId: 'goku-initial-check-v1',
      reason:
        'Existing 55% equip comparison only. Probability outputs are model assumptions, not independently confirmed game mechanics. Damage, full-turn chains and node respec are unavailable.',
    },
  };
  return {
    schemaVersion: 1,
    id: 'admitted-character-catalog',
    revision: 'catalog-shell-2026-10-19.1',
    createdAt: '2026-10-19',
    origin: 'admitted-records',
    coverage: {
      sourceCardCount: null,
      scope:
        'One existing admitted Goku card form and one exact EZA state. No provider catalog imported or reconciled. Ordinary awakening-form classification and other states are not admitted.',
      excluded: [],
    },
    sources,
    cards: [
      { id: cardId, name, title, aliases, form: 'unknown', fromCardId: null },
    ],
    states: [state],
    stateAliases: [],
  };
}
