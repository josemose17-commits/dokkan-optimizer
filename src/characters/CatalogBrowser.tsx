import { useEffect, useState } from 'react';
import { CHARACTER_STORAGE_KEY } from '../character-build/storage';
import { CARD_STATE_ID } from '../data/real/character-build/goku';
import { catalogSnapshot as snapshot } from '../data/real/catalog';
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
  type Fact,
  type StatBlock,
} from '../character-data/domain';
import './catalog.css';

const fmt = (value: number) => value.toLocaleString('en-US');
const stateLabel = (state: (typeof snapshot.states)[number]) =>
  `${state.awakening.kind === 'base' ? 'Base (no EZA)' : state.awakening.kind.toUpperCase()}${state.awakening.step === null ? '' : ` step ${state.awakening.step}`} · ${state.region ?? 'Region unknown'} · Lv.${state.fields.level.value ?? '?'} / SA${state.fields.superAttackLevel.value ?? '?'}`;

function Field({ label, fact }: { label: string; fact: Fact<unknown> }) {
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
            const source = snapshot.sources.find((s) => s.id === ref.sourceId)!;
            return (
              <div className="catalog-reference" key={i}>
                <p>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.label} ↗
                    </a>
                  ) : (
                    source.label
                  )}{' '}
                  · {source.access}
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

function CatalogDetails({ stateId }: { stateId: string | null }) {
  const state = stateId ? resolveState(snapshot, stateId) : null;
  const [profileId, setProfileId] = useState('');
  if (!state)
    return (
      <section className="catalog-panel" aria-label="Character details">
        <h2>State unavailable</h2>
        <p>
          The requested exact state is not admitted. Select a catalog result; no
          substitute state was chosen.
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
        Completeness counts the 11 detail fields below. It does not measure
        accuracy or optimization support. Only states listed in search are
        admitted; other awakenings are not inferred.
      </p>
      <details className="catalog-identity">
        <summary>Identity references and source aliases</summary>
        <dl>
          <Field label="Name" fact={card.name} />
          <Field label="Title" fact={card.title} />
        </dl>
        <ul>
          {card.aliases.map((alias) => (
            <li key={`${alias.sourceId}:${alias.recordId}`}>
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
            />
          ))}
        </dl>
      </section>
      <section
        className="catalog-support"
        aria-labelledby="optimization-support"
      >
        <h3 id="optimization-support">
          Optimization support: {state.optimization.status}
        </h3>
        <p>{state.optimization.reason}</p>
        {state.id === CARD_STATE_ID &&
          state.optimization.evaluatorId === 'goku-initial-check-v1' && (
            <a
              className="catalog-action"
              href={`${import.meta.env.BASE_URL}?workbench=character-build`}
            >
              Open existing limited build comparison ↗
            </a>
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

export default function CatalogBrowser() {
  const [filters, setFilters] = useState<SearchFilters>({});
  const initialId = () =>
    new URLSearchParams(window.location.search).get('state') ??
    snapshot.states[0]?.id ??
    null;
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [saved] = useState(() => {
    try {
      return inspectSavedBuildIdentity(
        window.localStorage.getItem(CHARACTER_STORAGE_KEY),
        snapshot,
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
    const pop = () => setSelectedId(initialId());
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const choose = (id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('state', id);
    window.history.pushState(null, '', url);
  };
  const counts = catalogCounts(snapshot);
  const rows = searchCatalog(snapshot, filters);
  const selected = selectedId ? resolveState(snapshot, selectedId) : null;
  const categories = [
    ...new Set(snapshot.states.flatMap((s) => s.fields.categories.value ?? [])),
  ].sort();
  const filter = (key: keyof SearchFilters, value: string) =>
    setFilters((old) => ({ ...old, [key]: value }));
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
          <span>ADMITTED CARD FORM</span>
          <b>{counts.states} awakening state</b>
          <span>NO EXPANDED REAL CATALOG</span>
        </div>
      </header>
      <div className="catalog-notice" role="note">
        <strong>
          Dokkan Info acquisition is paused pending an approved method.
        </strong>
        <p>
          No provider import is connected. This browser shows the existing Goku
          record only. Synthetic catalog fixtures are confined to automated
          tests.
        </p>
      </div>
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
          origin {snapshot.origin}. Created date is the local normalization
          date, not a provider snapshot date or a new source review.
        </p>
        <ul>
          <li>
            <strong>Source-documented:</strong> a recorded source supports a
            value; upstream independence is not established.
          </li>
          <li>
            <strong>Independently confirmed:</strong> requires an explicit dated
            independent-evidence reference and review. None is recorded here.
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
      <div className="catalog-layout">
        <aside
          className="catalog-panel catalog-search"
          aria-labelledby="catalog-search"
        >
          <h2 id="catalog-search">Search admitted records</h2>
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
                <option value="">All admitted states</option>
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
          </div>
          <p className="subtle">
            Filters use admitted fields only. Unknown categories are not an
            empty category list. A filter with no matches does not prove absence
            from the game.
          </p>
          <button className="catalog-clear" onClick={() => setFilters({})}>
            Clear filters
          </button>
          <p role="status" className="catalog-result-count">
            {rows.length} card form{rows.length === 1 ? '' : 's'} ·{' '}
            {rows.reduce((n, row) => n + row.states.length, 0)} matching state
            {rows.reduce((n, row) => n + row.states.length, 0) === 1 ? '' : 's'}
          </p>
          {!rows.length && <p>No admitted records match these filters.</p>}
          {rows.map(({ card, states }) => (
            <div className="catalog-result" key={card.id}>
              <h3>{card.name.value ?? card.id}</h3>
              <p className="subtle">
                {card.title.value ?? 'Title unavailable'}
              </p>
              {states.map((state) => (
                <button
                  key={state.id}
                  aria-pressed={state.id === selected?.id}
                  onClick={() => choose(state.id)}
                >
                  {stateLabel(state)}
                  <span>
                    {state.optimization.status} optimization ·{' '}
                    {completeness(state.fields).missing} missing fields
                  </span>
                </button>
              ))}
            </div>
          ))}
          <details className="catalog-saved">
            <summary>Saved-build compatibility</summary>
            <p>{saved.message}</p>
            {saved.stateId && (
              <button
                className="catalog-clear"
                onClick={() => choose(saved.stateId!)}
              >
                Show saved build’s exact state
              </button>
            )}
          </details>
        </aside>
        <CatalogDetails key={selectedId} stateId={selectedId} />
      </div>
    </main>
  );
}
