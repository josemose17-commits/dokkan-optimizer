import type { CatalogSnapshot, Provenance } from '../character-data/domain';
import {
  emptyConfiguration,
  newDocument,
  type DefinitionDocument,
} from './domain';

/** A detached user copy, never an overwrite or an evaluator binding. */
export function copyCatalogState(
  snapshot: CatalogSnapshot,
  stateId: string,
  ids: { state: string; card: string; build: string },
): DefinitionDocument | null {
  const state = snapshot.states.find((s) => s.id === stateId);
  if (!state) return null;
  const card = snapshot.cards.find((c) => c.id === state.cardId);
  if (!card) return null;
  const doc = newDocument(ids.state, ids.card, ids.build),
    d = doc.definition;
  d.name = card.name.value ?? card.id;
  d.title = card.title.value ?? '';
  d.type = state.fields.type.value;
  d.rarity = state.fields.rarity.value;
  d.level = state.fields.level.value;
  d.superAttackLevel = state.fields.superAttackLevel.value;
  d.awakening = structuredClone(state.awakening);
  d.region = state.region ?? '';
  d.gameVersion = state.gameVersion ?? '';
  if (state.fields.rawStats.value)
    d.rawStats = { ...state.fields.rawStats.value };
  d.links = structuredClone(state.fields.links.value);
  d.categories = structuredClone(state.fields.categories.value);
  d.sourceBinding = {
    cardId: card.id,
    stateId: state.id,
    catalogRevision: snapshot.revision,
  };
  d.notes =
    'Detached user-authored copy of catalog facts. Source notes describe the original snapshot; subsequent edits are user assertions. No executable mechanics were inferred.';
  d.sourceNotes = Object.entries(state.fields).map(([field, fact]) => ({
    field,
    status: fact.value === null ? 'user-entered' : 'source-documented',
    reference: fact.provenance
      .map((p: Provenance) => `${p.sourceId}: ${p.locator}`)
      .join('; '),
    note: `${fact.completeness}. ${fact.note ?? ''}`,
  }));
  for (const key of ['leaderSkill', 'passive', 'superAttack'] as const) {
    const fact = state.fields[key];
    if (fact.value !== null)
      d.abilities.push({
        id: `${ids.state}.${key}`,
        name:
          key === 'leaderSkill'
            ? 'Leader skill'
            : key === 'passive'
              ? 'Passive'
              : 'Super Attack',
        kind:
          key === 'leaderSkill'
            ? 'leader'
            : key === 'passive'
              ? 'passive'
              : 'super',
        wording: fact.value,
        effects: [],
      });
  }
  // No board, probability model or equipment is inferred from descriptive data.
  doc.configurations = [emptyConfiguration(ids.build, 'Current custom build')];
  return doc;
}
