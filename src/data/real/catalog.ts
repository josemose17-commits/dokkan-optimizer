import { fromAdmittedRecord } from '../../character-data/admitted-record-adapter.ts';
import { validateCatalog } from '../../character-data/validation.ts';
import {
  BASE_STATE_ID,
  baseState,
  baseStateSource,
} from './catalog-states/1003211-base.ts';
import { CATALOG_CARD_ID, characterCatalog } from './character-build/goku.ts';

// No provider adapter or fetch is connected. Test fixtures never enter this
// module. States: the admitted EZA record (migrated) and one individually
// recorded pre-EZA base state of the same card.
const admitted = fromAdmittedRecord(characterCatalog, CATALOG_CARD_ID);
const result = validateCatalog({
  ...admitted,
  revision: 'admitted-catalog-2026-10-19.2',
  coverage: {
    ...admitted.coverage,
    scope: `One card form (1003211) with two exact states: the admitted Global English EZA step 7 state, and an individually recorded pre-EZA base state (${BASE_STATE_ID}; region unknown, single source, no evaluator). No provider catalog imported or reconciled; other states and forms are not admitted.`,
  },
  sources: [...admitted.sources, baseStateSource],
  states: [...admitted.states, baseState(CATALOG_CARD_ID)],
});
if (!result.ok)
  throw new Error(`Invalid bundled catalog: ${result.errors.join('; ')}`);
export const catalogSnapshot = result.snapshot;
