import { fromAdmittedRecord } from '../../character-data/admitted-record-adapter.ts';
import { validateCatalog } from '../../character-data/validation.ts';
import { baseState, baseStateSource } from './catalog-states/1003211-base.ts';
import { CATALOG_CARD_ID, characterCatalog } from './character-build/goku.ts';
import {
  gohanCard,
  gohanSource,
  gohanState,
} from './catalog-states/1020091-eza.ts';
import { mnCatalog, MN_SOURCE } from './mnprojects/catalog.ts';

// The pinned factual import is build-time data; there is no runtime provider
// request. Test fixtures never enter this module. Reviewed Goku/Gohan state
// identities and evaluator bindings remain separate from historical records.
const admitted = fromAdmittedRecord(characterCatalog, CATALOG_CARD_ID);
export const reviewedCatalogSnapshot = {
  ...admitted,
  revision: 'admitted-catalog-2026-10-19.3',
  sources: [...admitted.sources, baseStateSource, gohanSource],
  cards: [...admitted.cards, gohanCard],
  states: [...admitted.states, baseState(CATALOG_CARD_ID), gohanState],
};
const result = validateCatalog({
  ...admitted,
  revision: 'ur-lr-reference-catalog-2026-10-19.1',
  coverage: {
    ...admitted.coverage,
    scope: `Two reviewed card identities plus ${mnCatalog.report.importedCards} historical UR/LR source identities from MNprojects/DokkanAPI (last repository commit 2023-01-22). ${mnCatalog.report.sourceRows} source rows reconciled: ${mnCatalog.report.acceptedRows} accepted, ${mnCatalog.report.excludedRows.length} excluded. ${mnCatalog.report.embeddedFormsNotMapped} embedded forms lack complete mappings and are not counted as additional cards. Descriptive source states are not all fully identified; region/level/form ambiguities remain explicit. Source IDs are not automatically merged with the reviewed cards. Not a complete current-game roster.`,
    excluded: [...admitted.coverage.excluded, ...mnCatalog.exclusions],
  },
  sources: [...admitted.sources, baseStateSource, gohanSource, MN_SOURCE],
  cards: [...admitted.cards, gohanCard, ...mnCatalog.cards],
  states: [
    ...admitted.states,
    baseState(CATALOG_CARD_ID),
    gohanState,
    ...mnCatalog.states,
  ],
});
if (!result.ok)
  throw new Error(`Invalid bundled catalog: ${result.errors.join('; ')}`);
export const catalogSnapshot = result.snapshot;
