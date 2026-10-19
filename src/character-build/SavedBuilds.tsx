import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { browserStorage } from '../storage/browser';
import ConfirmDialog from './ConfirmDialog';
import { download } from './download';
import { SLOTS, type BuildRequest, type EvaluatorEntry } from './domain';
import { itemLabel } from './explanation';
import { requestErrors } from './legality';
import { entryForState } from './registry';
import {
  buildStatus,
  createSavedBuild,
  exportBundle,
  loadLibrary,
  MAX_IMPORT_BYTES,
  MAX_NAME_LENGTH,
  mergeImported,
  parseImport,
  planImport,
  saveLibrary,
  type BuildStatus,
  type ImportAction,
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

const statusLabel: Record<BuildStatus['kind'], string> = {
  ready: 'Ready',
  stale: 'Stale',
  invalid: 'Invalid settings',
  unsupported: 'No evaluator here',
};
const actionLabel: Record<ImportAction, string> = {
  add: 'will be added',
  'add-new-id':
    'will be added with a new ID (its ID matches a different saved build)',
  'skip-duplicate': 'skipped: exact duplicate of a saved build',
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function SavedBuilds({
  entry,
  available,
  request,
  describe,
  inputIssues,
  onReplace,
  onOpen,
  refuse,
}: {
  // The open evaluator; `available` lists every evaluator this app can open.
  entry: EvaluatorEntry;
  available: readonly EvaluatorEntry[];
  request: BuildRequest;
  describe: (request: BuildRequest) => string;
  // Field errors not yet reflected in `request` (e.g. an invalid limit draft).
  inputIssues: number;
  onReplace: (request: BuildRequest, message: string) => void;
  // Opens settings in the workbench of their own exact state.
  onOpen: (
    target: EvaluatorEntry,
    request: BuildRequest,
    message: string,
  ) => void;
  // A page that cannot show some valid settings (e.g. entered potential
  // values) names the reason instead of loading them partially.
  refuse?: (request: BuildRequest) => string | null;
}) {
  // Applies settings to the evaluator bound to their exact state, never to
  // whichever workbench happens to be open.
  function apply(settings: BuildRequest, message: string) {
    const target = entryForState(available, settings.cardStateId);
    if (!target) return;
    if (target.id === entry.id) onReplace(settings, message);
    else onOpen(target, settings, message);
  }
  // Builds of other states are described with their own entry's labels.
  function describeBuild(settings: BuildRequest) {
    const target = entryForState(available, settings.cardStateId);
    if (target?.id === entry.id) return describe(settings);
    const equips = SLOTS.filter((s) => settings.current.equips[s] !== null)
      .map((s) =>
        target
          ? itemLabel(target, settings.current.equips[s])
          : `item ${settings.current.equips[s]}`,
      )
      .join(' / ');
    return `${target ? `${target.model.card.name} (${target.stateId})` : settings.cardStateId} · ${equips || 'No equips'}`;
  }
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
  const headingRef = useRef<HTMLHeadingElement>(null);

  const report = (text: string, error = false) => setMessage({ text, error });
  // Optimistic concurrency: if another tab changed the stored builds since
  // they were loaded here, reload instead of overwriting that change.
  function changedElsewhere() {
    const current = loadLibrary(browserStorage());
    if (current.raw === library.raw) return false;
    setLibrary(current);
    report(
      'Saved builds changed in another tab or window. The latest list was loaded and nothing was changed; repeat the action if you still want it.',
      true,
    );
    return true;
  }
  function persist(builds: SavedBuild[], success: string): boolean {
    if (changedElsewhere()) return false;
    const failure = saveLibrary(browserStorage(), builds);
    if (failure) {
      report(failure, true);
      return false;
    }
    setLibrary(loadLibrary(browserStorage()));
    report(success);
    return true;
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
      entry,
    });
    if (!created.build) {
      setNameError(created.error);
      return;
    }
    setNameError(null);
    // Keep the typed name when the write is refused, so a retry is one click.
    if (
      persist(
        [...library.builds, created.build],
        `Saved “${created.build.name}”.`,
      )
    )
      setName('');
  }

  function exportAll() {
    // A pending field error means the stored settings differ from what is
    // shown; never export that hidden value.
    const valid = !inputIssues && !requestErrors(request, entry).length;
    download(
      `dokkan-character-builds-${new Date().toISOString().slice(0, 10)}.json`,
      exportBundle({
        working: valid ? request : null,
        builds: library.builds,
        entry,
        now: new Date(),
      }),
    );
    report(
      `Exported ${library.builds.length} saved build${library.builds.length === 1 ? '' : 's'}${valid ? ' and the working settings' : '; working settings were omitted because the highlighted inputs are invalid'}. The file includes inventory quantities.`,
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
    const parsed = parseImport(text, available);
    if (!parsed.ok) return report(parsed.error, true);
    setReplaceWorking(false);
    setPreview({ ...parsed, fileName: file.name.slice(0, 120) });
  }

  function applyImport() {
    if (!preview) return;
    const incoming = preview.builds.map((b) => b.build);
    let summary = 'No saved builds were added.';
    if (incoming.length && changedElsewhere()) return setPreview(null);
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
      summary = `Added ${plural(merged.added, 'build')}; skipped ${plural(merged.duplicates, 'exact duplicate')}; ${merged.reassigned} received a new ID because of an ID conflict.`;
    }
    if (
      replaceWorking &&
      preview.working?.status.kind === 'ready' &&
      !refuse?.(preview.working.request)
    ) {
      apply(
        preview.working.request,
        `${summary} Working settings replaced from ${preview.fileName}.`,
      );
    }
    report(summary);
    setPreview(null);
  }

  const readyWorking =
    preview?.working?.status.kind === 'ready' &&
    !refuse?.(preview.working.request);
  // The preview shows the same plan that the merge applies.
  const plan = preview
    ? planImport(
        library.builds,
        preview.builds.map((b) => b.build),
      )
    : null;
  const notLoadable = preview
    ? preview.builds.filter(
        (b, i) =>
          plan!.actions[i] !== 'skip-duplicate' && b.status.kind !== 'ready',
      ).length
    : 0;
  return (
    <section className="cb-card cb-library" aria-labelledby="library-title">
      <div className="cb-library-head">
        <div>
          <p className="cb-eyebrow">SAVED BUILDS & BACKUP</p>
          <h2 id="library-title" tabIndex={-1} ref={headingRef}>
            Your saved builds
          </h2>
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
            const status = buildStatus(build, available);
            const refusal =
              status.kind === 'ready'
                ? (refuse?.(build.request) ?? null)
                : null;
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
                    {status.kind === 'stale' || status.kind === 'unsupported'
                      ? status.reason
                      : describeBuild(build.request)}
                  </p>
                  {status.kind === 'invalid' && (
                    <p className="cb-muted">{status.reason}</p>
                  )}
                  {refusal && <p className="cb-muted">{refusal}</p>}
                </div>
                <div className="cb-button-row">
                  <button
                    type="button"
                    className="cb-secondary"
                    disabled={status.kind !== 'ready' || refusal !== null}
                    aria-label={`Load ${build.name}`}
                    onClick={() =>
                      confirm({
                        title: `Load “${build.name}”?`,
                        body: (
                          <p>
                            {build.request.cardStateId === entry.stateId
                              ? 'This replaces the workbench settings'
                              : `This opens ${describeBuild(build.request).split(' · ')[0]} and replaces that state's working settings`}{' '}
                            (current equips, inventory quantities, context,
                            objective and limit). Save the current settings
                            first if you need them.
                          </p>
                        ),
                        confirmLabel: 'Load build',
                        onConfirm: () =>
                          apply(
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
                onReplace(
                  entry.defaults(),
                  'Working settings reset to defaults.',
                ),
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
        fallbackFocus={headingRef}
        onConfirm={() => confirmation?.onConfirm()}
        onCancel={() => setConfirmation(null)}
      >
        {confirmation?.body}
      </ConfirmDialog>
      <ConfirmDialog
        open={preview !== null}
        title="Review import"
        confirmLabel={
          plan?.added
            ? `Import ${plural(plan.added, 'build')}`
            : 'Replace working settings'
        }
        confirmDisabled={
          !plan || plan.exceedsLimit || (!plan.added && !replaceWorking)
        }
        fallbackFocus={headingRef}
        onConfirm={applyImport}
        onCancel={() => setPreview(null)}
      >
        {preview && plan && (
          <>
            <p>
              <strong>{preview.fileName}</strong> · exported{' '}
              {preview.exportedAt.slice(0, 16).replace('T', ' ')} UTC · catalog{' '}
              <code>{preview.catalogRevision}</code>
            </p>
            <p>
              {plural(plan.added, 'build')} will be added
              {plan.reassigned > 0 &&
                ` (${plan.reassigned} with a new ID)`};{' '}
              {plural(plan.duplicates, 'exact duplicate')} skipped
              {preview.rejected > 0 &&
                `; ${plural(preview.rejected, 'malformed entry')} rejected`}
              .
              {notLoadable > 0 &&
                ` ${notLoadable} of the added builds cannot be loaded (stale or invalid) but will be kept.`}
            </p>
            {plan.exceedsLimit && (
              <p className="cb-field-error" role="alert">
                This import would bring the library to {plan.total} builds,
                above the limit of 100. Delete builds first; nothing will be
                added.
              </p>
            )}
            {preview.builds.length > 0 && (
              <ul className="cb-import-list">
                {preview.builds.map(({ build, status }, i) => (
                  <li key={i}>
                    <strong>{build.name}</strong> —{' '}
                    {actionLabel[plan.actions[i]!]} · {statusLabel[status.kind]}
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
