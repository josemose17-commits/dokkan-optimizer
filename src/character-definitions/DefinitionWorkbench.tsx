import { useEffect, useMemo, useRef, useState } from 'react';
import { AWAKENINGS, RARITIES, TYPES } from '../character-data/domain';
import { catalogSnapshot } from '../data/real/catalog';
import ConfirmDialog from '../character-build/ConfirmDialog';
import { download } from '../character-build/download';
import {
  newDocument,
  userSource,
  type CharacterDefinition,
  type DefinitionDocument,
  type DefinitionLibrary,
} from './domain';
import {
  appendRevision,
  duplicateDocument,
  latestDocuments,
  loadDefinitions,
  planImport,
  writeDefinitions,
} from './library';
import { LIMITS, parseLibrary, validateLibrary } from './validation';
import { copyCatalogState } from './catalog-copy';
import AbilityEditor, { newId } from './AbilityEditor';
import BuildEditor from './BuildEditor';
import ContextEditor from './ContextEditor';
import EvaluationPanel from './EvaluationPanel';
import { NumberField, SourceFields, StatFields } from './fields';
import './definitions.css';

const store = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) =>
    window.localStorage.setItem(key, value),
};
export default function DefinitionWorkbench() {
  const [loaded, setLoaded] = useState(() => loadDefinitions(store));
  const [draft, setDraft] = useState<DefinitionDocument | null>(null);
  const [clean, setClean] = useState('');
  const [notice, setNotice] = useState(loaded.problem ?? '');
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [evaluated, setEvaluated] = useState<DefinitionDocument | null>(null);
  const [incoming, setIncoming] = useState<DefinitionLibrary | null>(null);
  const [conflicts, setConflicts] = useState<'skip' | 'copy'>('skip');
  const [selectedSource, setSelectedSource] = useState(
    catalogSnapshot.states[0]?.id ?? '',
  );
  const [filter, setFilter] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const approvedNavigation = useRef(false);
  const dirty = draft !== null && JSON.stringify(draft) !== clean;
  const validation = useMemo(
    () =>
      draft ? validateLibrary(appendRevision(loaded.library, draft)) : null,
    [draft, loaded.library],
  );
  const importPlan = useMemo(
    () =>
      incoming ? planImport(loaded.library, incoming, conflicts, newId) : null,
    [loaded.library, incoming, conflicts],
  );
  const latest = latestDocuments(loaded.library);
  const edit = (next: DefinitionDocument) => {
    setDraft(next);
    setEvaluated(null);
  };
  const open = (doc: DefinitionDocument, saved = false) => {
    setDraft(structuredClone(doc));
    setClean(saved ? JSON.stringify(doc) : '');
    setEvaluated(null);
    setNotice(loaded.problem ?? '');
  };
  const guard = (action: () => void) => {
    if (dirty) setPending(() => action);
    else action();
  };
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (!approvedNavigation.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (
        anchor instanceof HTMLAnchorElement &&
        !anchor.download &&
        !event.defaultPrevented &&
        event.button === 0
      ) {
        event.preventDefault();
        setPending(() => () => {
          approvedNavigation.current = true;
          window.location.assign(anchor.href);
        });
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigate);
    };
  }, [dirty]);
  const persist = (library: DefinitionLibrary): boolean => {
    if (!loaded.writable) {
      setNotice(loaded.problem ?? 'Storage unavailable; export your draft.');
      return false;
    }
    const result = writeDefinitions(store, loaded.raw, library);
    if (!result.ok) {
      setNotice(result.problem);
      return false;
    }
    setLoaded({ library, raw: result.raw, problem: null, writable: true });
    return true;
  };
  const save = () => {
    if (!draft) return;
    const next = appendRevision(loaded.library, draft),
      checked = validateLibrary(next);
    if (!checked.ok) {
      setNotice(checked.errors.join(' '));
      return;
    }
    if (persist(checked.library)) {
      const saved = checked.library.documents.at(-1)!;
      setDraft(saved);
      setClean(JSON.stringify(saved));
      setNotice(
        `Saved ${saved.definition.name}, revision ${saved.definition.revision}. Earlier revisions retained.`,
      );
    }
  };
  const exportDraft = () => {
    if (!draft || !validation?.ok) return;
    // Include linked definitions, so exported relationship references stay valid.
    download(
      'dokkan-character-definitions.json',
      JSON.stringify(validation.library, null, 2),
    );
    setNotice(
      'Exported the draft as a new revision with the local library and relationship targets. No storage was changed.',
    );
  };
  const setDefinition = (patch: Partial<CharacterDefinition>) => {
    if (draft)
      edit({ ...draft, definition: { ...draft.definition, ...patch } });
  };
  return (
    <main className="definition-workbench">
      <header className="definition-hero">
        <p className="eyebrow">CHARACTER DEFINITION LAB</p>
        <h1 ref={heading} tabIndex={-1}>
          Describe a character.
          <br />
          Inspect a build.
        </h1>
        <p>
          Author reusable definitions, keep multiple custom builds, and inspect
          exactly what this evaluator can calculate. Your records stay local. No
          catalog acquisition or artwork is involved.
        </p>
        <div className="definition-tags">
          <span>User-authored data</span>
          <span>Explicit unknowns</span>
          <span>Snapshot arithmetic</span>
        </div>
      </header>
      {notice && (
        <p className="definition-notice" role="status">
          {notice}
        </p>
      )}
      <div className="definition-layout">
        <aside className="definition-library">
          <h2>Your definitions</h2>
          <div className="definition-actions">
            <button
              type="button"
              className="definition-primary"
              onClick={() =>
                guard(() => open(newDocument(newId(), newId(), newId())))
              }
            >
              New character
            </button>
            <button
              type="button"
              disabled={!loaded.library.documents.length}
              onClick={() =>
                download(
                  'dokkan-definition-library.json',
                  JSON.stringify(loaded.library, null, 2),
                )
              }
            >
              Export saved library
            </button>
          </div>
          <label>
            Search saved definitions
            <input
              aria-label="Search saved definitions"
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <p>
            {latest.length} authored states ·{' '}
            {new Set(latest.map((d) => d.definition.cardId)).size} card/form IDs
            · {loaded.library.documents.length} stored revisions
          </p>
          {latest
            .filter((d) =>
              `${d.definition.name} ${d.definition.title}`
                .toLowerCase()
                .includes(filter.toLowerCase()),
            )
            .map((doc) => (
              <div className="definition-library-item" key={doc.definition.id}>
                <button
                  type="button"
                  onClick={() => guard(() => open(doc, true))}
                >
                  {doc.definition.name} · {doc.definition.awakening.kind} · r
                  {doc.definition.revision}
                </button>
                <details>
                  <summary>Revision history</summary>
                  {loaded.library.documents
                    .filter((d) => d.definition.id === doc.definition.id)
                    .map((d) => (
                      <button
                        type="button"
                        key={d.definition.revision}
                        onClick={() => guard(() => open(d, true))}
                      >
                        Open revision {d.definition.revision}
                      </button>
                    ))}
                </details>
              </div>
            ))}
          <details>
            <summary>Start from an admitted catalog state</summary>
            <p>
              This creates a detached user copy. Original wording is recorded;
              no executable effects or board choices are inferred.
            </p>
            <label>
              Catalog state
              <select
                aria-label="Catalog state"
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
              >
                {catalogSnapshot.states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {catalogSnapshot.cards.find((c) => c.id === s.cardId)?.name
                      .value ?? s.cardId}{' '}
                    · {s.awakening.kind} · Lv.{s.fields.level.value ?? '?'}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() =>
                guard(() => {
                  const doc = copyCatalogState(
                    catalogSnapshot,
                    selectedSource,
                    { state: newId(), card: newId(), build: newId() },
                  );
                  if (doc) open(doc);
                })
              }
            >
              Copy selected state
            </button>
          </details>
          <label className="definition-file">
            Import definition library (JSON, ≤1 MiB)
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (file.size > LIMITS.bytes) {
                  setNotice('File exceeds the 1 MiB limit; not read.');
                  return;
                }
                try {
                  const result = parseLibrary(await file.text());
                  if (!result.ok) setNotice(result.errors.join(' '));
                  else {
                    setIncoming(result.library);
                    setConflicts('skip');
                  }
                } catch {
                  setNotice('File could not be read; no records changed.');
                }
              }}
            />
          </label>
          {!loaded.writable && loaded.raw !== null && (
            <button
              type="button"
              onClick={() =>
                download('unreadable-character-definitions.json', loaded.raw!)
              }
            >
              Export original storage recovery copy
            </button>
          )}
          <p className="definition-muted">
            A separate versioned library. Existing Goku settings, named builds
            and the legacy collection are preserved. Imports never silently
            replace matching IDs.
          </p>
        </aside>
        <div className="definition-content">
          {!draft ? (
            <section className="definition-empty">
              <h2>Start with a definition you control</h2>
              <p>
                Create a character or copy an admitted state. Enter known
                values, leave the rest unknown, then add abilities and custom
                configurations. No fictional characters are bundled as real
                data.
              </p>
              <ol>
                <li>Record identity and raw stats.</li>
                <li>
                  Add a flat stat effect, optionally with an explicit condition.
                </li>
                <li>Enter custom potential additions and equipment.</li>
                <li>
                  Set the required context and compare with a calculation trace.
                </li>
              </ol>
              <p>
                The existing Goku 55% regression example is available under
                Source build examples. It is not the universal model.
              </p>
            </section>
          ) : (
            <>
              <div className="definition-toolbar">
                <div>
                  <strong>{draft.definition.name}</strong>
                  <small>
                    {draft.definition.origin} ·{' '}
                    {draft.definition.awakening.kind} · revision{' '}
                    {draft.definition.revision} ·{' '}
                    {dirty ? 'Unsaved changes' : 'Saved snapshot'}
                  </small>
                </div>
                <div className="definition-actions">
                  <button
                    type="button"
                    className="definition-primary"
                    disabled={!validation?.ok || !loaded.writable}
                    onClick={save}
                  >
                    Save as new revision
                  </button>
                  <button
                    type="button"
                    disabled={!validation?.ok}
                    onClick={exportDraft}
                  >
                    Export draft + library
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      guard(() =>
                        open(duplicateDocument(draft, newId(), newId())),
                      )
                    }
                  >
                    Duplicate character
                  </button>
                  <button
                    type="button"
                    disabled={!dirty}
                    onClick={() =>
                      guard(() => {
                        if (clean)
                          open(JSON.parse(clean) as DefinitionDocument, true);
                        else {
                          setDraft(null);
                          setEvaluated(null);
                        }
                      })
                    }
                  >
                    Discard draft changes
                  </button>
                </div>
              </div>
              {validation && !validation.ok && (
                <div className="definition-errors" role="alert">
                  <strong>
                    Fix these fields before saving, export or comparison:
                  </strong>
                  <ul>
                    {validation.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              <section>
                <h2>Basic character information</h2>
                <div className="definition-grid">
                  <label>
                    Character name
                    <input
                      aria-label="Character name"
                      required
                      maxLength={300}
                      value={draft.definition.name}
                      aria-invalid={!draft.definition.name.trim() || undefined}
                      onChange={(e) => setDefinition({ name: e.target.value })}
                    />
                  </label>
                  <label>
                    Card title
                    <input
                      aria-label="Card title"
                      maxLength={300}
                      value={draft.definition.title}
                      onChange={(e) => setDefinition({ title: e.target.value })}
                    />
                  </label>
                  <label>
                    Type
                    <select
                      aria-label="Type"
                      value={draft.definition.type ?? ''}
                      onChange={(e) =>
                        setDefinition({
                          type: (e.target.value ||
                            null) as CharacterDefinition['type'],
                        })
                      }
                    >
                      <option value="">Unknown</option>
                      {TYPES.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Rarity
                    <select
                      aria-label="Rarity"
                      value={draft.definition.rarity ?? ''}
                      onChange={(e) =>
                        setDefinition({
                          rarity: (e.target.value ||
                            null) as CharacterDefinition['rarity'],
                        })
                      }
                    >
                      <option value="">Unknown</option>
                      {RARITIES.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <NumberField
                    label="Applicable level"
                    value={draft.definition.level}
                    min={1}
                    onChange={(level) => setDefinition({ level })}
                  />
                  <NumberField
                    label="Super Attack level"
                    value={draft.definition.superAttackLevel}
                    min={1}
                    onChange={(superAttackLevel) =>
                      setDefinition({ superAttackLevel })
                    }
                  />
                  <label>
                    Awakening state
                    <select
                      aria-label="Awakening state"
                      value={draft.definition.awakening.kind}
                      onChange={(e) =>
                        setDefinition({
                          awakening: {
                            ...draft.definition.awakening,
                            kind: e.target
                              .value as CharacterDefinition['awakening']['kind'],
                          },
                        })
                      }
                    >
                      {AWAKENINGS.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <NumberField
                    label="EZA/SEZA step (if known)"
                    value={draft.definition.awakening.step}
                    onChange={(step) =>
                      setDefinition({
                        awakening: { ...draft.definition.awakening, step },
                      })
                    }
                  />
                  <label>
                    Region
                    <input
                      aria-label="Region"
                      value={draft.definition.region}
                      placeholder="Unknown"
                      onChange={(e) =>
                        setDefinition({ region: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Game version / applicability
                    <input
                      aria-label="Game version / applicability"
                      value={draft.definition.gameVersion}
                      placeholder="Unknown"
                      onChange={(e) =>
                        setDefinition({ gameVersion: e.target.value })
                      }
                    />
                  </label>
                </div>
                <StatFields
                  label="Raw card stats"
                  value={draft.definition.rawStats}
                  onChange={(rawStats) => setDefinition({ rawStats })}
                />
                <p className="definition-muted">
                  Raw card values exclude Hidden Potential, equips and battle
                  modifiers. Blank means unknown; 0 is an explicit value.
                </p>
                <details>
                  <summary>Links, categories, forms and identity</summary>
                  {(['links', 'categories'] as const).map((key) => (
                    <div key={key}>
                      <label>
                        {key} (one per line)
                        <textarea
                          disabled={draft.definition[key] === null}
                          value={draft.definition[key]?.join('\n') ?? ''}
                          onChange={(e) =>
                            setDefinition({
                              [key]: e.target.value
                                .split('\n')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={draft.definition[key] === null}
                          onChange={(e) =>
                            setDefinition({
                              [key]: e.target.checked ? null : [],
                            })
                          }
                        />
                        {key} unknown
                      </label>
                    </div>
                  ))}
                  <label>
                    Stable exact-state ID
                    <input
                      aria-label="Stable exact-state ID"
                      readOnly
                      value={draft.definition.id}
                    />
                  </label>
                  <label>
                    Card/form ID (shared by its EZA/SEZA states)
                    <input
                      aria-label="Card/form ID (shared only for revisions of this card’s
                    state)"
                      value={draft.definition.cardId}
                      onChange={(e) =>
                        setDefinition({ cardId: e.target.value })
                      }
                    />
                  </label>
                  <p>
                    EZA/SEZA definitions may share a card/form ID. Separate
                    ordinary forms have separate card IDs. Names never establish
                    identity.
                  </p>
                  {draft.definition.relations.map((r, i) => (
                    <div className="definition-grid" key={i}>
                      <label>
                        Form relationship
                        <select
                          aria-label="Form relationship"
                          value={r.kind}
                          onChange={(e) =>
                            setDefinition({
                              relations: draft.definition.relations.map(
                                (x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        kind: e.target.value as typeof r.kind,
                                      }
                                    : x,
                              ),
                            })
                          }
                        >
                          {[
                            'awakens-from',
                            'transforms-to',
                            'exchanges-with',
                            'alternate',
                          ].map((k) => (
                            <option key={k}>{k}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Related authored state
                        <select
                          aria-label="Related authored state"
                          value={r.targetId}
                          onChange={(e) =>
                            setDefinition({
                              relations: draft.definition.relations.map(
                                (x, j) =>
                                  j === i
                                    ? { ...x, targetId: e.target.value }
                                    : x,
                              ),
                            })
                          }
                        >
                          {latest
                            .filter(
                              (d) => d.definition.id !== draft.definition.id,
                            )
                            .map((d) => (
                              <option
                                key={d.definition.id}
                                value={d.definition.id}
                              >
                                {d.definition.name} ·{' '}
                                {d.definition.awakening.kind}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Relationship note
                        <input
                          aria-label="Relationship note"
                          value={r.note}
                          onChange={(e) =>
                            setDefinition({
                              relations: draft.definition.relations.map(
                                (x, j) =>
                                  j === i ? { ...x, note: e.target.value } : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setDefinition({
                            relations: draft.definition.relations.filter(
                              (_, j) => j !== i,
                            ),
                          })
                        }
                      >
                        Remove relationship
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={
                      !latest.some(
                        (d) => d.definition.id !== draft.definition.id,
                      )
                    }
                    onClick={() =>
                      setDefinition({
                        relations: [
                          ...draft.definition.relations,
                          {
                            kind: 'alternate',
                            targetId: latest.find(
                              (d) => d.definition.id !== draft.definition.id,
                            )!.definition.id,
                            note: '',
                          },
                        ],
                      })
                    }
                  >
                    Add form relationship
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      guard(() => {
                        const next = duplicateDocument(
                          draft,
                          newId(),
                          draft.definition.cardId,
                        );
                        next.definition.name = draft.definition.name;
                        next.definition.awakening = {
                          kind: 'unknown',
                          step: null,
                        };
                        next.definition.sourceBinding = null;
                        open(next);
                      })
                    }
                  >
                    Duplicate as another state (same card)
                  </button>
                </details>
              </section>
              <AbilityEditor
                value={draft.definition.abilities}
                context={draft.context}
                onChange={(abilities) => setDefinition({ abilities })}
              />
              <BuildEditor document={draft} onChange={edit} />
              <ContextEditor
                document={draft}
                onChange={(context) => edit({ ...draft, context })}
              />
              <section>
                <h2>Sources and review notes</h2>
                <p>
                  All definitions here are user records. A source-documented
                  label records your citation; it does not mean independently
                  confirmed. Catalog-copy references describe the original
                  snapshot and do not validate later edits.
                </p>
                <label>
                  Definition notes
                  <textarea
                    aria-label="Definition notes"
                    value={draft.definition.notes}
                    onChange={(e) => setDefinition({ notes: e.target.value })}
                  />
                </label>
                {draft.definition.sourceNotes.map((s, i) => (
                  <details key={i}>
                    <summary>
                      {s.field || 'General note'} · {s.status}
                    </summary>
                    <label>
                      Field / path
                      <input
                        aria-label="Field / path"
                        value={s.field}
                        onChange={(e) =>
                          setDefinition({
                            sourceNotes: draft.definition.sourceNotes.map(
                              (v, j) =>
                                j === i ? { ...v, field: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <SourceFields
                      value={s}
                      onChange={(value) =>
                        setDefinition({
                          sourceNotes: draft.definition.sourceNotes.map(
                            (v, j) => (j === i ? value : v),
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDefinition({
                          sourceNotes: draft.definition.sourceNotes.filter(
                            (_, j) => j !== i,
                          ),
                        })
                      }
                    >
                      Remove source note
                    </button>
                  </details>
                ))}
                <button
                  type="button"
                  disabled={draft.definition.sourceNotes.length >= 100}
                  onClick={() =>
                    setDefinition({
                      sourceNotes: [
                        ...draft.definition.sourceNotes,
                        userSource(),
                      ],
                    })
                  }
                >
                  Add source note
                </button>
                <details>
                  <summary>Advanced JSON view (optional, read-only)</summary>
                  <pre>{JSON.stringify(draft, null, 2)}</pre>
                </details>
              </section>
              <button
                type="button"
                className="definition-primary"
                disabled={!validation?.ok}
                onClick={() => {
                  if (validation?.ok) setEvaluated(structuredClone(draft));
                }}
              >
                Compare supported metrics
              </button>
              {evaluated && (
                <EvaluationPanel
                  key={`${evaluated.definition.id}:${evaluated.definition.revision}`}
                  document={evaluated}
                />
              )}
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={pending !== null}
        title="Discard unsaved changes?"
        confirmLabel="Continue and discard changes"
        fallbackFocus={heading}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const action = pending;
          setPending(null);
          action?.();
        }}
      >
        <p>
          Your unsaved draft changes will be discarded. Cancel to save a
          revision or export first.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={incoming !== null}
        title="Preview definition import"
        confirmLabel="Import listed records"
        confirmDisabled={
          !loaded.writable ||
          !importPlan ||
          importPlan.errors.length > 0 ||
          importPlan.added.length === 0
        }
        fallbackFocus={heading}
        onCancel={() => setIncoming(null)}
        onConfirm={() => {
          if (
            importPlan &&
            !importPlan.errors.length &&
            persist(importPlan.library)
          ) {
            setNotice(
              `Imported ${importPlan.added.length} revisions; ${importPlan.skipped.length} skipped. Existing revisions were preserved.`,
            );
            setIncoming(null);
          }
        }}
      >
        <p>
          Import contains {incoming?.documents.length ?? 0} revisions. Matching
          IDs are never overwritten.
        </p>
        <label>
          Conflicting state IDs
          <select
            aria-label="Conflicting state IDs"
            value={conflicts}
            onChange={(e) => setConflicts(e.target.value as typeof conflicts)}
          >
            <option value="skip">Skip conflicting characters</option>
            <option value="copy">
              Copy conflicting characters under new IDs
            </option>
          </select>
        </label>
        {importPlan && (
          <>
            <h3>Add ({importPlan.added.length})</h3>
            <ul>
              {importPlan.added.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
            <h3>Skip ({importPlan.skipped.length})</h3>
            <ul>
              {importPlan.skipped.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
            {importPlan.copied.length > 0 && (
              <>
                <h3>New identity mappings</h3>
                <ul>
                  {importPlan.copied.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </>
            )}
            {importPlan.errors.length > 0 && (
              <ul role="alert">
                {importPlan.errors.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </ConfirmDialog>
    </main>
  );
}
