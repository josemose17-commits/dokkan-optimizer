import { fromAdmittedRecord } from '../../character-data/admitted-record-adapter.ts';
import { validateCatalog } from '../../character-data/validation.ts';
import { characterCatalog } from './character-build/goku.ts';

// No provider adapter or fetch is connected. Test fixtures never enter this module.
const result = validateCatalog(
  fromAdmittedRecord(characterCatalog, 'admitted-card:1003211'),
);
if (!result.ok)
  throw new Error(`Invalid bundled catalog: ${result.errors.join('; ')}`);
export const catalogSnapshot = result.snapshot;
