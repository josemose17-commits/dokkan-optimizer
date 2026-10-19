import type {
  AcquisitionAdapter,
  CatalogSnapshot,
  CatalogState,
  DetailFields,
  Fact,
  StatBlock,
} from './domain.ts';
import { validateCatalog, type ValidationResult } from './validation.ts';

export function importCatalog(
  adapter: AcquisitionAdapter,
  sample: unknown,
): ValidationResult {
  try {
    return validateCatalog(adapter.normalize(sample));
  } catch {
    return {
      ok: false,
      snapshot: null,
      errors: ['adapter: normalization failed; no catalog was admitted'],
    };
  }
}

export function evidenceStatus(fact: Fact<unknown>) {
  if (
    fact.value === null ||
    !fact.provenance.length ||
    fact.provenance.some((p) => p.status === 'unresolved')
  )
    return 'unresolved';
  return fact.provenance.some(
    (p) =>
      p.status === 'independently-confirmed' &&
      p.reviewedAt &&
      p.independentConfirmation?.reference &&
      p.independentConfirmation.date,
  )
    ? 'independently-confirmed'
    : 'source-documented';
}

export function completeness(fields: DetailFields) {
  const values = Object.values(fields) as Fact<unknown>[];
  return {
    total: values.length,
    complete: values.filter((f) => f.completeness === 'complete').length,
    partial: values.filter((f) => f.completeness === 'partial').length,
    missing: values.filter((f) => f.completeness === 'missing').length,
    independentlyConfirmed: values.filter(
      (f) => evidenceStatus(f) === 'independently-confirmed',
    ).length,
  };
}

export function catalogCounts(snapshot: CatalogSnapshot) {
  return {
    cards: snapshot.cards.length,
    startingForms: snapshot.cards.filter((c) => c.form === 'starting').length,
    awakenedForms: snapshot.cards.filter((c) => c.form === 'awakened').length,
    transformedForms: snapshot.cards.filter((c) => c.form === 'transformation')
      .length,
    unclassifiedForms: snapshot.cards.filter((c) => c.form === 'unknown')
      .length,
    states: snapshot.states.length,
    baseStates: snapshot.states.filter((s) => s.awakening.kind === 'base')
      .length,
    ezaStates: snapshot.states.filter((s) => s.awakening.kind === 'eza').length,
    sezaStates: snapshot.states.filter((s) => s.awakening.kind === 'seza')
      .length,
    unknownStates: snapshot.states.filter((s) => s.awakening.kind === 'unknown')
      .length,
    excluded: snapshot.coverage.excluded.length,
    sourceCardCount: snapshot.coverage.sourceCardCount,
  };
}

export function resolveState(
  snapshot: CatalogSnapshot,
  id: string,
): CatalogState | null {
  const canonical = snapshot.states.find((state) => state.id === id);
  if (canonical) return canonical;
  const alias = snapshot.stateAliases.find((a) => a.alias === id);
  return alias
    ? (snapshot.states.find((state) => state.id === alias.stateId) ?? null)
    : null;
}

export function resolveBuildState(
  snapshot: CatalogSnapshot,
  build: {
    cardStateId: string;
    level: number;
    superAttackLevel: number;
  },
): CatalogState | null {
  const state = resolveState(snapshot, build.cardStateId);
  // An alias is not permission to change the requested awakening, level or SA.
  return state &&
    state.fields.level.value === build.level &&
    state.fields.superAttackLevel.value === build.superAttackLevel
    ? state
    : null;
}

export function inspectSavedBuildIdentity(
  raw: string | null,
  snapshot: CatalogSnapshot,
): {
  status: 'none' | 'resolved' | 'unavailable' | 'invalid';
  stateId: string | null;
  message: string;
} {
  if (raw === null)
    return {
      status: 'none',
      stateId: null,
      message:
        'No saved character build. Browsing does not write build storage.',
    };
  try {
    const saved = JSON.parse(raw);
    if (
      saved?.version !== 1 ||
      typeof saved.catalogRevision !== 'string' ||
      typeof saved.request?.cardStateId !== 'string' ||
      !Number.isSafeInteger(saved.request.level) ||
      !Number.isSafeInteger(saved.request.superAttackLevel)
    )
      throw new Error('Invalid identity');
    const state = resolveBuildState(snapshot, saved.request);
    return state
      ? {
          status: 'resolved',
          stateId: state.id,
          message: `Saved build identity resolves exactly (Lv.${saved.request.level}, SA${saved.request.superAttackLevel}). Its evaluator snapshot ${saved.catalogRevision} is preserved; full build validation occurs in the limited workbench.`,
        }
      : {
          status: 'unavailable',
          stateId: null,
          message:
            'Saved card/state or level assumptions are not in this catalog. The saved build is preserved; no name-based substitution is made.',
        };
  } catch {
    return {
      status: 'invalid',
      stateId: null,
      message:
        'Saved identity could not be read. Browsing leaves the original saved data untouched.',
    };
  }
}

export type SearchFilters = {
  query?: string;
  type?: string;
  rarity?: string;
  category?: string;
  awakening?: string;
  region?: string;
};
const normalize = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en-US');
const matches = (value: string | null, filter: string | undefined) =>
  !filter || (filter === '__missing__' ? value === null : value === filter);

export function searchCatalog(
  snapshot: CatalogSnapshot,
  filters: SearchFilters = {},
) {
  const tokens = normalize(filters.query ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const matchingStates = new Map<string, CatalogState[]>();
  // One pass over states and one over cards; no per-card scan of the full roster.
  for (const state of snapshot.states) {
    if (
      matches(state.fields.type.value, filters.type) &&
      matches(state.fields.rarity.value, filters.rarity) &&
      matches(state.region, filters.region) &&
      (!filters.awakening || state.awakening.kind === filters.awakening) &&
      (!filters.category ||
        (filters.category === '__missing__'
          ? state.fields.categories.value === null
          : state.fields.categories.value?.includes(filters.category)))
    ) {
      const states = matchingStates.get(state.cardId) ?? [];
      states.push(state);
      matchingStates.set(state.cardId, states);
    }
  }
  return snapshot.cards.flatMap((card) => {
    const haystack = normalize(
      [
        card.name.value,
        card.title.value,
        card.id,
        ...card.aliases.map((a) => a.recordId),
      ].join(' '),
    );
    if (!tokens.every((token) => haystack.includes(token))) return [];
    // All state filters must match the SAME state; never combine EZA type with a base category.
    const states = matchingStates.get(card.id) ?? [];
    return states.length ? [{ card, states }] : [];
  });
}

export function statLayers(
  state: CatalogState,
  profileId: string | null,
  equips: StatBlock | null,
) {
  const raw = state.fields.rawStats.value;
  const potential =
    profileId === null
      ? { hp: 0, attack: 0, defense: 0 }
      : (state.potentialProfiles.find((p) => p.id === profileId)?.statAdditions
          .value ?? null);
  const preBattle =
    raw && potential && equips
      ? {
          hp: raw.hp + potential.hp + equips.hp,
          attack: raw.attack + potential.attack + equips.attack,
          defense: raw.defense + potential.defense + equips.defense,
        }
      : null;
  return { raw, potential, equips, preBattle, battle: null };
}

export function assessCatalogUpdate(
  previous: CatalogSnapshot,
  next: CatalogSnapshot,
) {
  const ids = (values: { id: string }[]) => values.map((v) => v.id);
  const oldCards = ids(previous.cards),
    newCards = ids(next.cards);
  const oldStates = ids(previous.states),
    newStates = ids(next.states);
  const oldCardSet = new Set(oldCards),
    newCardSet = new Set(newCards);
  const oldStateSet = new Set(oldStates),
    newStateSet = new Set(newStates);
  const issues: string[] = [];
  const changes: { stateId: string; fields: string[] }[] = [];
  const cardChanges: { cardId: string; fields: string[] }[] = [];
  const nextCardMap = new Map(next.cards.map((card) => [card.id, card]));
  for (const card of previous.cards) {
    const nextCard = nextCardMap.get(card.id);
    if (!nextCard) continue;
    const fields = (
      ['name', 'title', 'form', 'fromCardId', 'aliases'] as const
    ).filter(
      (key) => JSON.stringify(card[key]) !== JSON.stringify(nextCard[key]),
    );
    if (fields.length) cardChanges.push({ cardId: card.id, fields });
  }
  const nextStates = new Map(next.states.map((state) => [state.id, state]));
  for (const old of previous.states) {
    const state = nextStates.get(old.id);
    if (!state) {
      issues.push(`Removed saved-state target: ${old.id}`);
      continue;
    }
    if (
      JSON.stringify([
        state.cardId,
        state.awakening,
        state.region,
        state.fields.level.value,
        state.fields.superAttackLevel.value,
      ]) !==
      JSON.stringify([
        old.cardId,
        old.awakening,
        old.region,
        old.fields.level.value,
        old.fields.superAttackLevel.value,
      ])
    )
      issues.push(`Reassigned exact state: ${old.id}`);
    const fields = (Object.keys(old.fields) as (keyof DetailFields)[]).filter(
      (key) =>
        JSON.stringify(old.fields[key]) !== JSON.stringify(state.fields[key]),
    );
    const changedMetadata = (
      [
        'cardId',
        'awakening',
        'region',
        'gameVersion',
        'potentialProfiles',
        'optimization',
      ] as const
    ).filter((key) => JSON.stringify(old[key]) !== JSON.stringify(state[key]));
    if (fields.length || changedMetadata.length)
      changes.push({
        stateId: old.id,
        fields: [...fields, ...changedMetadata],
      });
  }
  for (const alias of previous.stateAliases) {
    if (resolveState(next, alias.alias)?.id !== alias.stateId)
      issues.push(`Removed or reassigned state alias: ${alias.alias}`);
  }
  const aliasKey = (a: {
    sourceId: string;
    recordId: string;
    region: string | null;
  }) => JSON.stringify([a.sourceId, a.recordId, a.region]);
  const nextAliases = new Map(
    next.cards.flatMap((c) =>
      c.aliases.map((a) => [aliasKey(a), c.id] as const),
    ),
  );
  for (const card of previous.cards) {
    if (!newCardSet.has(card.id)) issues.push(`Removed card: ${card.id}`);
    for (const alias of card.aliases)
      if (nextAliases.get(aliasKey(alias)) !== card.id)
        issues.push(`Removed or reassigned source alias: ${aliasKey(alias)}`);
  }
  const nextSources = new Map(
    next.sources.map((source) => [source.id, source]),
  );
  const sourceChanges = previous.sources
    .filter(
      (source) =>
        JSON.stringify(source) !== JSON.stringify(nextSources.get(source.id)),
    )
    .map((source) => source.id);
  return {
    fromRevision: previous.revision,
    toRevision: next.revision,
    compatible: issues.length === 0,
    issues,
    changes,
    cardChanges,
    sourceChanges,
    addedCards: newCards.filter((id) => !oldCardSet.has(id)),
    removedCards: oldCards.filter((id) => !newCardSet.has(id)),
    addedStates: newStates.filter((id) => !oldStateSet.has(id)),
    removedStates: oldStates.filter((id) => !newStateSet.has(id)),
  };
}
