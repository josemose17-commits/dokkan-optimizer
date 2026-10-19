import { fromAdmittedRecord } from '../../character-data/admitted-record-adapter.ts';
import { validateCatalog } from '../../character-data/validation.ts';
import { CATALOG_CARD_ID, characterCatalog } from './character-build/goku.ts';

// No provider adapter or fetch is connected. Test fixtures never enter this module.
const result = validateCatalog(
  fromAdmittedRecord(characterCatalog, CATALOG_CARD_ID),
);
if (!result.ok)
  throw new Error(`Invalid bundled catalog: ${result.errors.join('; ')}`);
export const catalogSnapshot = result.snapshot;
