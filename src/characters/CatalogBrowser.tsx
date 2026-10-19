import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { optimizerHref } from '../character-build/BuildOptimizerPage';
import { resolveEvaluator } from '../character-build/registry';
import { CHARACTER_STORAGE_KEY } from '../character-build/storage';
import { productionRegistry } from '../data/real/character-build/registry';
import { catalogSnapshot as bundled } from '../data/real/catalog';
import {
  catalogCounts,
  completeness,
  evidenceStatus,
  inspectSavedBuildIdentity,
  resolveState,
  searchCatalog,
  statLayers,
  type SearchFilters,
} from '../character-data/catalog';
import {
  AWAKENINGS,
  DETAIL_LABELS,
  RARITIES,
  TYPES,
  type CatalogSnapshot,
  type CatalogState,
  type Fact,
  type StatBlock,
} from '../character-data/domain';
import LocalCatalogImport, { clip } from './LocalCatalogImport';
import './catalog.css';

const PAGE_SIZE = 50;
const fmt = (value: number) => value.toLocaleString('en-US');
const stateLabel = (state: CatalogState) =>
  `${state.awakening.kind === 'base' ? 'Base (no EZA)' : state.awakening.kind.toUpperCase()}${state.awakening.step === null ? '' : ` step ${state.awakening.step}`} · ${state.region ?? 'Region unknown'} · Lv.${state.fields.level.value ?? '?'} / SA${state.fields.superAttackLevel.value ?? '?'}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

type SessionFile = { fileName: string; snapshot: CatalogSnapshot };

function Field({
  label,
  fact,
  snapshot,
}: {
  label: string;
  fact: Fact<unknown>;
  snapshot: CatalogSnapshot;
}) {
  let value = 'Unavailable';
  if (Array.isArray(fact.value))
    value = fact.value.length
      ? fact.value.join(' · ')
      : 'None (documented empty list)';
  else if (fact.value !== null && typeof fact.value === 'object') {
    const stats = fact.value as StatBlock;
    value = `HP ${fmt(stats.hp)} · ATK ${fmt(stats.attack)} · DEF ${fmt(stats.defense)}`;
  } else if (fact.value !== null) value = String(fact.value);
  return (
    <div className="catalog-field">
      <dt>
        {label}
        <span className={`catalog-badge ${fact.completeness}`}>
          {fact.completeness}
        </span>
      </dt>
      <dd>
        <p>{value}</p>
        {fact.note && <p className="subtle">{fact.note}</p>}
        <details>
          <summary>Evidence: {evidenceStatus(fact)}</summary>
          {!fact.provenance.length && (
            <p>No field reference has been admitted.</p>
          )}
          {fact.provenance.map((ref, i) => {
            const source = snapshot.sources.find((s) => s.id === ref.sourceId);
            return (
              <div className="catalog-reference" key={i}>
                <p>
                  {!source ? (
                    `Unknown source (${clip(ref.sourceId, 80)})`
                  ) : source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.label} ↗
                    </a>
                  ) : (
                    source.label
                  )}{' '}
                  · {source?.access ?? 'access unknown'}
                </p>
                <p>{ref.locator}</p>
                <p className="subtle">
                  Retrieved: {ref.retrievedAt ?? 'not recorded'} · Reviewed:{' '}
                  {ref.reviewedAt ?? 'not reviewed'} · Source revision:{' '}
                  {ref.sourceRevision ?? 'not captured'}
                </p>
                <p className="subtle">
                  Independent confirmation:{' '}
                  {ref.independentConfirmation
                    ? `${ref.independentConfirmation.reference} (${ref.independentConfirmation.date})`
                    : 'none recorded'}
                </p>
              </div>
            );
          })}
        </details>
      </dd>
    </div>
  );
}

function CatalogDetails({
  snapshot,
  stateId,
  isBundled,
}: {
  snapshot: CatalogSnapshot;
  stateId: string | null;
  isBundled: boolean;
}) {
  const state = stateId ? resolveState(snapshot, stateId) : null;
  const [profileId, setProfileId] = useState('');
  if (!state)
    return (
      <section className="catalog-panel" aria-label="Character details">
        <h2>State unavailable</h2>
        <p>
          {snapshot.states.length
            ? 'The requested exact state is not in this catalog. Select a catalog result; no substitute state was chosen.'
            : 'This catalog contains no states to display.'}
        </p>
      </section>
    );
  const card = snapshot.cards.find((card) => card.id === state.cardId)!;
  const complete = completeness(state.fields);
  const layers = statLayers(state, profileId || null, {
    hp: 0,
    attack: 0,
    defense: 0,
  });
  const layerRows: [string, StatBlock | null][] = [
    ['Raw card stats', layers.raw],
    ['Hidden Potential additions', layers.potential],
    ['Flat equip additions (explicitly none)', layers.equips],
    ['Pre-battle total', layers.preBattle],
    ['Battle stats after modifiers', layers.battle],
  ];
  // The registry decides from the state's own evaluator ID; session files
  // are never resolved against it.
  const resolution = isBundled
    ? resolveEvaluator(productionRegistry, snapshot, state.id)
    : null;
  return (
    <article
      className="catalog-panel catalog-details"
      aria-labelledby="character-name"
    >
      <p className="eyebrow">EXACT CARD / STATE</p>
      <h2 id="character-name">{card.name.value ?? card.id}</h2>
      <p className="catalog-subtitle">
        {card.title.value ?? 'Title unavailable'}
      </p>
      <p>
        <span className="catalog-type">
          {state.fields.class.value ?? '?'} {state.fields.type.value ?? '?'} ·{' '}
          {state.fields.rarity.value ?? '?'}
        </span>{' '}
        {stateLabel(state)}
      </p>
      <p className="subtle">
        Card ID: <code>{card.id}</code>
        <br />
        State ID: <code>{state.id}</code>
        <br />
        Game version: {state.gameVersion ?? 'not captured'} · Ordinary form
        classification: {card.form}
      </p>
      <div className="catalog-completeness" role="status">
        <strong>
          {complete.complete}/{complete.total} detail fields complete
        </strong>
        <span>
          {complete.partial} partial · {complete.missing} missing ·{' '}
          {complete.independentlyConfirmed} independently confirmed
        </span>
      </div>
      <p className="subtle">
        Completeness counts the {complete.total} detail fields below. It does
        not measure accuracy or optimization support. Only states listed in
        search are in this catalog; other awakenings are not inferred.
      </p>
      <details className="catalog-identity">
        <summary>Identity references and source aliases</summary>
        <dl>
          <Field label="Name" fact={card.name} snapshot={snapshot} />
          <Field label="Title" fact={card.title} snapshot={snapshot} />
        </dl>
        <ul>
          {card.aliases.map((alias) => (
            <li key={`${alias.sourceId}:${alias.recordId}:${alias.region}`}>
              {snapshot.sources.find((s) => s.id === alias.sourceId)?.label}:{' '}
              <code>{alias.recordId}</code> · {alias.region ?? 'region unknown'}
            </li>
          ))}
        </ul>
        <p className="subtle">
          Aliases are provider-specific identifiers, not an inferred conversion
          formula.
        </p>
      </details>
      <section aria-labelledby="stat-layers">
        <h3 id="stat-layers">Keep stat layers separate</h3>
        <label>
          Hidden Potential illustration
          <select
            aria-label="Hidden Potential illustration"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
          >
            <option value="">No Hidden Potential additions applied</option>
            {state.potentialProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <p className="subtle">
          Explicit no-equipment illustration, not your saved current build. Raw
          stats use the selected state’s level. Leader, passive, link, support
          and other battle modifiers are unavailable.
        </p>
        <div className="catalog-table-wrap">
          <table>
            <caption>
              Card stats + potential additions + flat equips; battle stats are
              not calculated.
            </caption>
            <thead>
              <tr>
                <th>Layer</th>
                <th>HP</th>
                <th>ATK</th>
                <th>DEF</th>
              </tr>
            </thead>
            <tbody>
              {layerRows.map(([label, stats]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {(['hp', 'attack', 'defense'] as const).map((key) => (
                    <td key={key}>{stats ? fmt(stats[key]) : 'Unavailable'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!!profileId &&
          state.potentialProfiles
            .filter((p) => p.id === profileId)
            .map((p) => (
              <div key={p.id}>
                <p>{p.assumptions}</p>
                <dl>
                  <Field
                    label="Potential stat additions"
                    fact={p.statAdditions}
                    snapshot={snapshot}
                  />
                </dl>
              </div>
            ))}
      </section>
      <section aria-labelledby="detail-fields">
        <h3 id="detail-fields">Documented details and missing fields</h3>
        <dl>
          {Object.entries(DETAIL_LABELS).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              fact={state.fields[key as keyof typeof state.fields]}
              snapshot={snapshot}
            />
          ))}
        </dl>
      </section>
      <section
        className="catalog-support"
        aria-labelledby="optimization-support"
      >
        <h3 id="optimization-support">
          {isBundled
            ? `Optimization support: ${state.optimization.status}`
            : `Declared by the file: ${state.optimization.status} — not offered in this app`}
        </h3>
        <p>{state.optimization.reason}</p>
        {resolution?.ok && (
          <a className="catalog-action" href={optimizerHref(state.id)}>
            Optimize this character
          </a>
        )}
        {resolution &&
          !resolution.ok &&
          resolution.code !== 'not-supported' && (
            <p className="catalog-unsupported" role="note">
              <strong>Optimization unavailable:</strong> {resolution.reason}
            </p>
          )}
        {!isBundled && (
          <>
            <button
              type="button"
              className="catalog-action"
              disabled
              aria-describedby="session-optimize-note"
            >
              Optimize this character
            </button>
            <p id="session-optimize-note" className="subtle">
              Optimization is only offered for the bundled admitted record.
              States from a session file are browse-only, whatever support
              status the file declares.
            </p>
          </>
        )}
        <p className="subtle">
          Descriptive fields do not execute effects. Full node respec stays
          unavailable; no damage objective or verified optimal-build claim is
          added.
        </p>
      </section>
    </article>
  );
}

const urlStateId = () =>
  new URLSearchParams(window.location.search).get('state');

export default function CatalogBrowser() {
  const [session, setSession] = useState<SessionFile | null>(null);
  const snapshot = session?.snapshot ?? bundled;
  const isBundled = session === null;
  const [filters, setFilters] = useState<SearchFilters>({});
  const [limit, setLimit] = useState(PAGE_SIZE);
  // Distinguishes snapshot switches so detail state never leaks across files.
  const [generation, setGeneration] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => urlStateId() ?? bundled.states[0]?.id ?? null,
  );
  const bannerRef = useRef<HTMLDivElement>(null);
  const searchHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterSwitch = useRef<'banner' | 'search' | null>(null);
  const [saved] = useState(() => {
    try {
      return inspectSavedBuildIdentity(
        window.localStorage.getItem(CHARACTER_STORAGE_KEY),
        bundled,
      );
    } catch {
      return {
        status: 'invalid' as const,
        stateId: null,
        message:
          'Build storage is unavailable. Catalog browsing remains usable and does not write storage.',
      };
    }
  });
  useEffect(() => {
    // The URL only addresses bundled states; a session file is not linkable.
    if (!isBundled) return;
    const pop = () =>
      setSelectedId(urlStateId() ?? bundled.states[0]?.id ?? null);
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [isBundled]);
  useEffect(() => {
    const target = focusAfterSwitch.current;
    focusAfterSwitch.current = null;
    if (target === 'banner') bannerRef.current?.focus();
    if (target === 'search') searchHeadingRef.current?.focus();
  }, [generation]);
  const switchTo = (next: SessionFile | null) => {
    setSession(next);
    setFilters({});
    setLimit(PAGE_SIZE);
    setGeneration((g) => g + 1);
    focusAfterSwitch.current = next ? 'banner' : 'search';
    setSelectedId(
      next
        ? (next.snapshot.states[0]?.id ?? null)
        : (urlStateId() ?? bundled.states[0]?.id ?? null),
    );
  };
  const choose = (id: string) => {
    setSelectedId(id);
    if (!isBundled) return;
    const url = new URL(window.location.href);
    url.searchParams.set('state', id);
    window.history.pushState(null, '', url);
  };
  const counts = useMemo(() => catalogCounts(snapshot), [snapshot]);
  // Typing stays responsive on a large session file; results follow shortly.
  const deferredFilters = useDeferredValue(filters);
  const rows = useMemo(
    () => searchCatalog(snapshot, deferredFilters),
    [snapshot, deferredFilters],
  );
  const matchingStates = useMemo(
    () => rows.reduce((n, row) => n + row.states.length, 0),
    [rows],
  );
  const visible = rows.slice(0, limit);
  const selected = selectedId ? resolveState(snapshot, selectedId) : null;
  const categories = useMemo(
    () =>
      [
        ...new Set(
          snapshot.states.flatMap((s) => s.fields.categories.value ?? []),
        ),
      ].sort(),
    [snapshot],
  );
  const filter = (key: Exclude<keyof SearchFilters, 'sort'>, value: string) => {
    setLimit(PAGE_SIZE);
    setFilters((old) => {
      const next: Record<string, string> = { ...old };
      if (value) next[key] = value;
      else delete next[key];
      return next as SearchFilters;
    });
  };
  const sort = (value: string) =>
    setFilters((old) => {
      const next = { ...old };
      if (value === 'name') next.sort = 'name';
      else delete next.sort;
      return next;
    });
  const remaining = rows.length - visible.length;
  return (
    <main className="catalog-shell" id="character-catalog">
      <header className="catalog-hero">
        <div>
          <p className="eyebrow">
            CHARACTER CATALOG / PROVIDER-INDEPENDENT FOUNDATION
          </p>
          <h1>
            Find a card.
            <br />
            <span>Know its exact state.</span>
          </h1>
          <p>
            Inspect admitted facts, missing fields and their references.
            Optimization support is tracked separately.
          </p>
        </div>
        <div className="catalog-totals">
          <strong>{counts.cards}</strong>
          <span>
            {isBundled
              ? `ADMITTED CARD FORM${counts.cards === 1 ? '' : 'S'}`
              : `CARD FORM${counts.cards === 1 ? '' : 'S'} IN SESSION FILE`}
          </span>
          <b>{plural(counts.states, 'awakening state')}</b>
          <span>
            {isBundled
              ? 'NO EXPANDED REAL CATALOG'
              : 'NOT ADMITTED OR REVIEWED'}
          </span>
        </div>
      </header>
      <div className="catalog-notice" role="note">
        <strong>
          Dokkan Info acquisition is paused pending an approved method.
        </strong>
        <p>
          No provider import is connected. The bundled catalog contains the
          existing Goku record only. Synthetic catalog fixtures are confined to
          automated tests.
        </p>
      </div>
      {session && (
        <div
          className="catalog-session-banner"
          role="region"
          aria-labelledby="session-banner-title"
          tabIndex={-1}
          ref={bannerRef}
        >
          <div>
            <strong id="session-banner-title">
              Browsing local file: {session.fileName}
            </strong>
            <p>
              Snapshot <code>{clip(session.snapshot.id)}</code> · revision{' '}
              <code>{clip(session.snapshot.revision)}</code>
            </p>
            <p>
              Session only — not part of the bundled admitted catalog, not
              reviewed by this project. Evidence statuses are as declared in the
              file.
            </p>
          </div>
          <button
            type="button"
            className="catalog-button"
            onClick={() => switchTo(null)}
          >
            Return to bundled catalog
          </button>
        </div>
      )}
      <details className="catalog-panel catalog-coverage">
        <summary>
          Coverage, evidence definitions and snapshot provenance
        </summary>
        <p>{snapshot.coverage.scope}</p>
        <p>
          {counts.cards} card forms: {counts.startingForms} starting ·{' '}
          {counts.awakenedForms} ordinary awakened · {counts.transformedForms}{' '}
          transformed · {counts.unclassifiedForms} unclassified.
          <br />
          {counts.states} states: {counts.baseStates} base · {counts.ezaStates}{' '}
          EZA · {counts.sezaStates} SEZA · {counts.unknownStates} unknown. These
          state counts are not additional cards.
        </p>
        <p>
          Provider catalog total:{' '}
          {counts.sourceCardCount ?? 'unknown / not reconciled'} · Explicitly
          excluded source records: {counts.excluded}. No completeness claim
          against Dokkan Info’s roster.
        </p>
        <p>
          Snapshot <code>{snapshot.id}</code> · revision{' '}
          <code>{snapshot.revision}</code> · created {snapshot.createdAt} ·
          origin {snapshot.origin}
          {isBundled ? '' : ' (as declared by the session file)'}. Created date
          is the local normalization date, not a provider snapshot date or a new
          source review.
        </p>
        <ul>
          <li>
            <strong>Source-documented:</strong> a recorded source supports a
            value; upstream independence is not established.
          </li>
          <li>
            <strong>Independently confirmed:</strong> requires an explicit dated
            independent-evidence reference and review.{' '}
            {isBundled
              ? 'None is recorded here.'
              : 'Claims in a session file are not checked by this project.'}
          </li>
          <li>
            <strong>Unresolved:</strong> evidence or interpretation is
            incomplete. Mathematical tests establish implementation behavior
            only.
          </li>
        </ul>
        <p>
          Source license and bulk-reuse scope remain unassessed unless a
          specific grant is recorded. No artwork, source database or calculator
          implementation is included.
        </p>
        <ul>
          {snapshot.sources.map((source) => (
            <li key={source.id}>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.label} ↗
                </a>
              ) : (
                source.label
              )}{' '}
              · {source.access}
              <br />
              <span className="subtle">
                License: {source.license ?? 'not established'} · Permission:{' '}
                {source.permissionReference ?? 'no bulk grant recorded'}
              </span>
            </li>
          ))}
        </ul>
      </details>
      <LocalCatalogImport
        bundled={bundled}
        browsingFileName={session?.fileName ?? null}
        onBrowse={(fileName, next) => switchTo({ fileName, snapshot: next })}
      />
      <div className="catalog-layout">
        <aside
          className="catalog-panel catalog-search"
          aria-labelledby="catalog-search"
        >
          <h2 id="catalog-search" tabIndex={-1} ref={searchHeadingRef}>
            {isBundled ? 'Search admitted records' : 'Search session file'}
          </h2>
          <label>
            Name, title or ID
            <input
              type="search"
              value={filters.query ?? ''}
              onChange={(e) => filter('query', e.target.value)}
              placeholder="Search characters"
            />
          </label>
          <div className="catalog-filters">
            <label>
              Type
              <select
                aria-label="Type"
                value={filters.type ?? ''}
                onChange={(e) => filter('type', e.target.value)}
              >
                <option value="">All types</option>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
                <option value="__missing__">Unknown type</option>
              </select>
            </label>
            <label>
              Rarity
              <select
                aria-label="Rarity"
                value={filters.rarity ?? ''}
                onChange={(e) => filter('rarity', e.target.value)}
              >
                <option value="">All rarities</option>
                {RARITIES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
                <option value="__missing__">Unknown rarity</option>
              </select>
            </label>
            <label>
              Awakening state
              <select
                aria-label="Awakening state"
                value={filters.awakening ?? ''}
                onChange={(e) => filter('awakening', e.target.value)}
              >
                <option value="">All states</option>
                {AWAKENINGS.map((a) => (
                  <option key={a} value={a}>
                    {a.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                aria-label="Category"
                value={filters.category ?? ''}
                onChange={(e) => filter('category', e.target.value)}
              >
                <option value="">All category coverage</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
                <option value="__missing__">Categories not admitted</option>
              </select>
            </label>
            <label>
              Optimization support
              <select
                aria-label="Optimization support"
                value={filters.optimization ?? ''}
                onChange={(e) => filter('optimization', e.target.value)}
              >
                <option value="">All support levels</option>
                <option value="limited">
                  {isBundled
                    ? 'Limited evaluator available'
                    : 'Declared limited (not offered here)'}
                </option>
                <option value="unavailable">
                  {isBundled ? 'Unavailable' : 'Declared unavailable'}
                </option>
              </select>
            </label>
            <label>
              Sort
              <select
                aria-label="Sort"
                value={filters.sort ?? 'catalog'}
                onChange={(e) => sort(e.target.value)}
              >
                <option value="catalog">Catalog order</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
          </div>
          <p className="subtle">
            Filters use catalog fields only and must all match the same state.
            Unknown categories are not an empty category list. A filter with no
            matches does not prove absence from the game.
          </p>
          <button
            type="button"
            className="catalog-clear"
            onClick={() => {
              setFilters({});
              setLimit(PAGE_SIZE);
            }}
          >
            Clear filters
          </button>
          <p role="status" className="catalog-result-count">
            {visible.length < rows.length
              ? `Showing ${visible.length} of ${plural(rows.length, 'matching card form')}`
              : plural(rows.length, 'card form')}{' '}
            · {plural(matchingStates, 'matching state')}
          </p>
          {!rows.length && (
            <p>
              No records in this catalog match these filters.{' '}
              {snapshot.cards.length ? 'Try clearing filters.' : ''}
            </p>
          )}
          {visible.map(({ card, states }) => (
            <div className="catalog-result" key={card.id}>
              <h3>{card.name.value ?? card.id}</h3>
              <p className="subtle">
                {card.title.value ?? 'Title unavailable'}
              </p>
              {states.map((state) => (
                <button
                  type="button"
                  key={state.id}
                  aria-pressed={state.id === selected?.id}
                  onClick={() => choose(state.id)}
                >
                  {stateLabel(state)}
                  <span>
                    {isBundled
                      ? `${state.optimization.status} optimization`
                      : `declared ${state.optimization.status} · not offered here`}{' '}
                    · {completeness(state.fields).missing} missing fields
                  </span>
                </button>
              ))}
            </div>
          ))}
          {remaining > 0 && (
            <button
              type="button"
              className="catalog-button catalog-more"
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
            >
              Show {Math.min(PAGE_SIZE, remaining)} more
            </button>
          )}
          <details className="catalog-saved">
            <summary>Saved-build compatibility</summary>
            <p>{saved.message}</p>
            {saved.stateId &&
              (isBundled ? (
                <button
                  type="button"
                  className="catalog-clear"
                  onClick={() => choose(saved.stateId!)}
                >
                  Show saved build’s exact state
                </button>
              ) : (
                <p className="subtle">
                  Saved builds refer to the bundled admitted catalog. Return to
                  it to show the saved build’s exact state.
                </p>
              ))}
          </details>
        </aside>
        <CatalogDetails
          key={`${generation}:${selectedId}`}
          snapshot={snapshot}
          stateId={selectedId}
          isBundled={isBundled}
        />
      </div>
    </main>
  );
}
