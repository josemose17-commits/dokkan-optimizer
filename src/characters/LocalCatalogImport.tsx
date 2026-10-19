import { useRef, useState, type ChangeEvent } from 'react';
import { assessCatalogUpdate, catalogCounts } from '../character-data/catalog';
import type { CatalogSnapshot } from '../character-data/domain';
import { validateCatalog } from '../character-data/validation';

// Same bound as scripts/catalog.mjs. Checked before the file is read.
export const MAX_LOCAL_CATALOG_BYTES = 20 * 1024 * 1024;
const MAX_LISTED_ERRORS = 20;
const MAX_MESSAGE_LENGTH = 200;

// File-derived text is rendered as plain React text only, after truncation.
export const clip = (value: string, max = MAX_MESSAGE_LENGTH) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

type Inspection =
  | { status: 'idle' }
  | { status: 'reading'; fileName: string }
  | {
      status: 'rejected';
      fileName: string;
      reason: string;
      errors: string[];
      errorCount: number;
    }
  | {
      status: 'valid';
      fileName: string;
      snapshot: CatalogSnapshot;
      counts: ReturnType<typeof catalogCounts>;
      update: ReturnType<typeof assessCatalogUpdate>;
    };

export default function LocalCatalogImport({
  bundled,
  browsingFileName,
  onBrowse,
}: {
  bundled: CatalogSnapshot;
  browsingFileName: string | null;
  onBrowse: (fileName: string, snapshot: CatalogSnapshot) => void;
}) {
  const [inspection, setInspection] = useState<Inspection>({ status: 'idle' });
  // Ignore results from an earlier file if another file was chosen meanwhile.
  const request = useRef(0);

  async function inspect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const token = ++request.current;
    if (!file) {
      setInspection({ status: 'idle' });
      return;
    }
    const fileName = clip(file.name, 120);
    const reject = (reason: string, errors: string[] = []) => {
      if (token === request.current)
        setInspection({
          status: 'rejected',
          fileName,
          reason,
          errors: errors.slice(0, MAX_LISTED_ERRORS).map((e) => clip(e)),
          errorCount: errors.length,
        });
    };
    if (file.size > MAX_LOCAL_CATALOG_BYTES) {
      reject('The file exceeds the 20 MiB limit and was not read.');
      return;
    }
    setInspection({ status: 'reading', fileName });
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      // Parser messages can quote file content; they are not echoed.
      reject('The file could not be read as JSON.');
      return;
    }
    let inspected: Extract<Inspection, { status: 'valid' }>;
    try {
      // Default validation: test-fixture snapshots are rejected here.
      const result = validateCatalog(parsed);
      if (!result.ok) {
        reject(
          'The file does not match the normalized catalog schema. Nothing was loaded.',
          result.errors,
        );
        return;
      }
      inspected = {
        status: 'valid',
        fileName,
        snapshot: result.snapshot,
        counts: catalogCounts(result.snapshot),
        update: assessCatalogUpdate(bundled, result.snapshot),
      };
    } catch {
      // A pathological file must never leave the panel stuck "validating".
      reject('The file could not be validated. Nothing was loaded.');
      return;
    }
    if (token === request.current) setInspection(inspected);
  }

  return (
    <details className="catalog-panel catalog-import">
      <summary>Inspect a local normalized catalog file</summary>
      <p>
        Choose a JSON file in the documented normalized catalog format. It is
        validated in this browser tab only: nothing is uploaded, stored or
        merged into the bundled admitted catalog. Passing validation checks
        structure; it is not a source review, permission grant or game
        verification. Test-fixture snapshots are rejected.
      </p>
      <label className="catalog-file">
        Normalized catalog JSON (20 MiB maximum)
        <input type="file" accept="application/json,.json" onChange={inspect} />
      </label>
      <div aria-live="polite">
        {inspection.status === 'reading' && (
          <p>Validating {inspection.fileName}…</p>
        )}
        {inspection.status === 'valid' && (
          <ValidFile
            inspection={inspection}
            bundled={bundled}
            browsing={browsingFileName !== null}
            onBrowse={() => onBrowse(inspection.fileName, inspection.snapshot)}
          />
        )}
      </div>
      {inspection.status === 'rejected' && (
        <div className="catalog-import-errors" role="alert">
          <strong>Rejected: {inspection.fileName}</strong>
          <p>{inspection.reason}</p>
          {inspection.errorCount > 0 && (
            <>
              <p>
                {inspection.errorCount} validation error
                {inspection.errorCount === 1 ? '' : 's'}
                {inspection.errorCount > inspection.errors.length
                  ? `; the first ${inspection.errors.length} are listed`
                  : ''}
                .
              </p>
              <ul>
                {inspection.errors.map((error, i) => (
                  <li key={i}>
                    <code>{error}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </details>
  );
}

function ValidFile({
  inspection,
  bundled,
  browsing,
  onBrowse,
}: {
  inspection: Extract<Inspection, { status: 'valid' }>;
  bundled: CatalogSnapshot;
  browsing: boolean;
  onBrowse: () => void;
}) {
  const { counts, update, snapshot } = inspection;
  const listed = update.issues.slice(0, MAX_LISTED_ERRORS);
  return (
    <div className="catalog-import-result">
      <strong>Schema-valid: {inspection.fileName}</strong>
      <p>
        Snapshot <code>{clip(snapshot.id)}</code> · revision{' '}
        <code>{clip(snapshot.revision)}</code> · declared origin{' '}
        {snapshot.origin}
      </p>
      <p>
        {counts.cards} card form{counts.cards === 1 ? '' : 's'} ·{' '}
        {counts.states} state{counts.states === 1 ? '' : 's'} (
        {counts.baseStates} base · {counts.ezaStates} EZA · {counts.sezaStates}{' '}
        SEZA · {counts.unknownStates} unknown) · {counts.excluded} explicitly
        excluded · declared source total{' '}
        {counts.sourceCardCount ?? 'unknown / not reconciled'}
      </p>
      <p>
        Compared with bundled revision <code>{bundled.revision}</code>:{' '}
        <strong>
          {update.compatible
            ? 'keeps every bundled ID and alias'
            : `${update.issues.length} identity issue${update.issues.length === 1 ? '' : 's'}`}
        </strong>{' '}
        · {update.addedCards.length} added / {update.removedCards.length}{' '}
        removed cards · {update.addedStates.length} added /{' '}
        {update.removedStates.length} removed states · {update.changes.length}{' '}
        changed state{update.changes.length === 1 ? '' : 's'}
      </p>
      {!!listed.length && (
        <ul>
          {listed.map((issue, i) => (
            <li key={i}>
              <code>{clip(issue)}</code>
            </li>
          ))}
          {update.issues.length > listed.length && (
            <li>{update.issues.length - listed.length} more not listed.</li>
          )}
        </ul>
      )}
      <p className="subtle">
        Identity issues mean saved builds referring to bundled IDs would not
        resolve against this file. This report does not change the bundled
        catalog.
      </p>
      <button type="button" className="catalog-button" onClick={onBrowse}>
        {browsing
          ? 'Browse this file instead'
          : 'Browse this file for this session'}
      </button>
    </div>
  );
}
