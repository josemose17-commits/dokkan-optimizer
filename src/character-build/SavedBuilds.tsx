import { useState, type ChangeEvent, type ReactNode } from 'react';
import { browserStorage } from '../storage/collection';
import ConfirmDialog from './ConfirmDialog';
import type { BuildRequest, CharacterCatalog } from './domain';
import { requestErrors } from './legality';
import {
  buildStatus,
  createSavedBuild,
  exportBundle,
  loadLibrary,
  MAX_IMPORT_BYTES,
  MAX_NAME_LENGTH,
  mergeImported,
  parseImport,
  saveLibrary,
  type BuildStatus,
  type ImportPreview,
  type LibraryState,
  type SavedBuild,
} from './library';

type Confirmation = {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `build-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function download(fileName: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const statusLabel: Record<BuildStatus['kind'], string> = {
  ready: 'Ready',
  stale: 'Stale revision',
  invalid: 'Invalid settings',
};

export default function SavedBuilds({
  catalog,
  request,
  defaults,
  describe,
  inputIssues,
  onReplace,
}: {
  catalog: CharacterCatalog;
  request: BuildRequest;
  defaults: () => BuildRequest;
  describe: (request: BuildRequest) => string;
  // Field errors not yet reflected in `request` (e.g. an invalid limit draft).
  inputIssues: number;
  onReplace: (request: BuildRequest, message: string) => void;
}) {
  const [library, setLibrary] = useState<LibraryState>(() =>
    loadLibrary(browserStorage()),
  );
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [preview, setPreview] = useState<
    (ImportPreview & { ok: true; fileName: string }) | null
  >(null);
  const [replaceWorking, setReplaceWorking] = useState(false);

  const report = (text: string, error = false) => setMessage({ text, error });
  function persist(builds: SavedBuild[], success: string) {
    const failure = saveLibrary(browserStorage(), builds);
    if (failure) return report(failure, true);
    setLibrary(loadLibrary(browserStorage()));
    report(success);
  }
  function confirm(next: Confirmation) {
    setConfirmation({
      ...next,
      onConfirm: () => {
        setConfirmation(null);
        next.onConfirm();
      },
    });
  }

  function save() {
    if (inputIssues) {
      setNameError(
        'Only valid settings can be saved. Fix the highlighted inputs.',
      );
      return;
    }
    const created = createSavedBuild({
      id: newId(),
      name,
      now: new Date(),
      request,
      catalog,
    });
    if (!created.build) {
      setNameError(created.error);
      return;
    }
    setNameError(null);
    setName('');
    persist(
      [...library.builds, created.build],
      `Saved “${created.build.name}”.`,
    );
  }

  function exportAll() {
    const valid = !requestErrors(request, catalog).length;
    download(
      `dokkan-character-builds-${new Date().toISOString().slice(0, 10)}.json`,
      exportBundle({
        working: valid ? request : null,
        builds: library.builds,
        catalog,
        now: new Date(),
      }),
    );
    report(
      `Exported ${library.builds.length} saved build${library.builds.length === 1 ? '' : 's'}${valid ? ' and the working settings' : '; working settings were omitted because they are invalid'}. The file includes inventory quantities.`,
    );
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES)
      return report('File exceeds the 1 MiB import limit.', true);
    let text: string;
    try {
      text = await file.text();
    } catch {
      return report('The file could not be read.', true);
    }
    const parsed = parseImport(text, catalog);
    if (!parsed.ok) return report(parsed.error, true);
    setReplaceWorking(false);
    setPreview({ ...parsed, fileName: file.name.slice(0, 120) });
  }

  function applyImport() {
    if (!preview) return;
    const incoming = preview.builds.map((b) => b.build);
    let summary = 'No saved builds were added.';
    if (incoming.length) {
      const merged = mergeImported(library.builds, incoming, newId);
      if (!merged.ok) {
        setPreview(null);
        return report(merged.error, true);
      }
      const failure = saveLibrary(browserStorage(), merged.builds);
      if (failure) {
        setPreview(null);
        return report(failure, true);
      }
      setLibrary(loadLibrary(browserStorage()));
      summary = `Added ${merged.added} build${merged.added === 1 ? '' : 's'}; skipped ${merged.duplicates} exact duplicate${merged.duplicates === 1 ? '' : 's'}; ${merged.reassigned} received a new ID because of an ID conflict.`;
    }
    if (replaceWorking && preview.working?.status.kind === 'ready') {
      onReplace(
        preview.working.request,
        `${summary} Working settings replaced from ${preview.fileName}.`,
      );
    }
    report(summary);
    setPreview(null);
  }

  const readyWorking = preview?.working?.status.kind === 'ready';
  return (
    <section className="cb-card cb-library" aria-labelledby="library-title">
      <div className="cb-library-head">
        <div>
          <p className="cb-eyebrow">SAVED BUILDS & BACKUP</p>
          <h2 id="library-title">Your saved builds</h2>
        </div>
        <p className="cb-muted">
          {library.builds.length} saved · stored in this browser only. Saved
          builds keep inputs, not results; they are re-evaluated when compared.
        </p>
      </div>
      {library.warning && (
        <div className="cb-error" role="alert">
          <p>{library.warning}</p>
          {library.raw !== null && (
            <div className="cb-button-row">
              <button
                type="button"
                className="cb-secondary"
                onClick={() =>
                  download(
                    'dokkan-character-library-unreadable.json',
                    library.raw!,
                  )
                }
              >
                Download stored copy
              </button>
              <button
                type="button"
                className="cb-danger"
                onClick={() =>
                  confirm({
                    title: 'Replace unreadable saved builds?',
                    body: (
                      <p>
                        The stored data will be replaced with an empty library.
                        Download a copy first if you may need it. This cannot be
                        undone.
                      </p>
                    ),
                    confirmLabel: 'Replace with empty library',
                    destructive: true,
                    onConfirm: () => persist([], 'Saved builds were reset.'),
                  })
                }
              >
                Replace with empty library
              </button>
            </div>
          )}
        </div>
      )}
      <form
        className="cb-save-row"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label className="cb-field">
          Name for the current settings
          <input
            type="text"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'save-name-error' : undefined}
            disabled={!library.writable}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Crit silver, inventory"
          />
        </label>
        <button
          type="submit"
          className="cb-secondary"
          disabled={!library.writable}
        >
          Save build
        </button>
      </form>
      {nameError && (
        <p className="cb-field-error" id="save-name-error">
          {nameError}
        </p>
      )}
      {library.builds.length > 0 && (
        <ul className="cb-saved-list">
          {library.builds.map((build) => {
            const status = buildStatus(build, catalog);
            return (
              <li key={build.id}>
                <div>
                  <strong>{build.name}</strong>
                  <span
                    className={`cb-status cb-status-${status.kind}`}
                    title={status.reason ?? undefined}
                  >
                    {statusLabel[status.kind]}
                  </span>
                  <p className="cb-muted">
                    Saved {build.savedAt.slice(0, 16).replace('T', ' ')} UTC ·{' '}
                    {status.kind === 'stale'
                      ? status.reason
                      : describe(build.request)}
                  </p>
                  {status.kind === 'invalid' && (
                    <p className="cb-muted">{status.reason}</p>
                  )}
                </div>
                <div className="cb-button-row">
                  <button
                    type="button"
                    className="cb-secondary"
                    disabled={status.kind !== 'ready'}
                    aria-label={`Load ${build.name}`}
                    onClick={() =>
                      confirm({
                        title: `Load “${build.name}”?`,
                        body: (
                          <p>
                            This replaces the workbench settings (current
                            equips, inventory quantities, context, objective and
                            limit). Save the current settings first if you need
                            them.
                          </p>
                        ),
                        confirmLabel: 'Load build',
                        onConfirm: () =>
                          onReplace(
                            structuredClone(build.request),
                            `Loaded “${build.name}”. Compare to see results.`,
                          ),
                      })
                    }
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    className="cb-secondary"
                    disabled={!library.writable}
                    aria-label={`Delete ${build.name}`}
                    onClick={() =>
                      confirm({
                        title: `Delete “${build.name}”?`,
                        body: <p>This saved build will be removed.</p>,
                        confirmLabel: 'Delete build',
                        destructive: true,
                        onConfirm: () =>
                          persist(
                            library.builds.filter((b) => b.id !== build.id),
                            `Deleted “${build.name}”.`,
                          ),
                      })
                    }
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="cb-button-row cb-backup-row">
        <button type="button" className="cb-secondary" onClick={exportAll}>
          Export JSON
        </button>
        <label
          className={`cb-secondary cb-file${library.writable ? '' : ' cb-disabled'}`}
        >
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            disabled={!library.writable}
            onChange={chooseFile}
          />
        </label>
        <button
          type="button"
          className="cb-secondary"
          onClick={() =>
            confirm({
              title: 'Reset working settings?',
              body: (
                <p>
                  Current equips, inventory quantities, context, objective and
                  limit return to defaults. Saved builds are not affected.
                </p>
              ),
              confirmLabel: 'Reset settings',
              destructive: true,
              onConfirm: () =>
                onReplace(defaults(), 'Working settings reset to defaults.'),
            })
          }
        >
          Reset working settings
        </button>
      </div>
      <p className="cb-muted">
        Imports are validated as data and never replace existing saved builds.
        Builds from another catalog revision are kept but marked stale.
      </p>
      <p
        className={message?.error ? 'cb-field-error' : 'cb-muted'}
        role="status"
      >
        {message?.text}
      </p>
      <ConfirmDialog
        open={confirmation !== null}
        title={confirmation?.title ?? ''}
        confirmLabel={confirmation?.confirmLabel ?? 'Confirm'}
        destructive={confirmation?.destructive ?? false}
        onConfirm={() => confirmation?.onConfirm()}
        onCancel={() => setConfirmation(null)}
      >
        {confirmation?.body}
      </ConfirmDialog>
      <ConfirmDialog
        open={preview !== null}
        title="Review import"
        confirmLabel="Import"
        confirmDisabled={!preview?.builds.length && !replaceWorking}
        onConfirm={applyImport}
        onCancel={() => setPreview(null)}
      >
        {preview && (
          <>
            <p>
              <strong>{preview.fileName}</strong> · exported{' '}
              {preview.exportedAt.slice(0, 16).replace('T', ' ')} UTC · catalog{' '}
              <code>{preview.catalogRevision}</code>
            </p>
            <p>
              {preview.builds.length} saved build
              {preview.builds.length === 1 ? '' : 's'} will be added (exact
              duplicates are skipped).
              {preview.rejected > 0 &&
                ` ${preview.rejected} malformed entr${preview.rejected === 1 ? 'y was' : 'ies were'} rejected.`}
            </p>
            {preview.builds.length > 0 && (
              <ul className="cb-import-list">
                {preview.builds.map(({ build, status }, i) => (
                  <li key={i}>
                    {build.name} — {statusLabel[status.kind]}
                    {status.reason && (
                      <span className="cb-muted"> · {status.reason}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {preview.working ? (
              <label className="cb-check">
                <input
                  type="checkbox"
                  checked={replaceWorking}
                  disabled={!readyWorking}
                  onChange={(event) => setReplaceWorking(event.target.checked)}
                />
                Also replace my working settings with the exported ones
                {!readyWorking &&
                  ` (unavailable: ${preview.working.status.reason})`}
              </label>
            ) : (
              <p className="cb-muted">The file has no working settings.</p>
            )}
          </>
        )}
      </ConfirmDialog>
    </section>
  );
}
