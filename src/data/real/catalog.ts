import { fromAdmittedRecord } from '../../character-data/admitted-record-adapter.ts';
import { validateCatalog } from '../../character-data/validation.ts';
import { baseState, baseStateSource } from './catalog-states/1003211-base.ts';
import { CATALOG_CARD_ID, characterCatalog } from './character-build/goku.ts';
import {
  gohanCard,
  gohanSource,
  gohanState,
} from './catalog-states/1020091-eza.ts';

// No provider adapter or fetch is connected. Test fixtures never enter this
// module. The existing Goku state identities are retained; the new Gohan
// exact state supplies reviewed kit guidance, not a numerical evaluator.
const admitted = fromAdmittedRecord(characterCatalog, CATALOG_CARD_ID);
const result = validateCatalog({
  ...admitted,
  revision: 'admitted-catalog-2026-10-19.3',
  coverage: {
    ...admitted.coverage,
    scope: `Two card identities, three exact states: the original two Goku states and one individually documented EZA Gohan kit-guidance state. Region/form mappings remain unknown where unstated. No provider catalog imported or reconciled.`,
  },
  sources: [...admitted.sources, baseStateSource, gohanSource],
  cards: [...admitted.cards, gohanCard],
  states: [...admitted.states, baseState(CATALOG_CARD_ID), gohanState],
});
if (!result.ok)
  throw new Error(`Invalid bundled catalog: ${result.errors.join('; ')}`);
export const catalogSnapshot = result.snapshot;
