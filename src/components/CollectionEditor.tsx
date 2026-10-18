import { useState } from 'react';
import type { OwnedInstance } from '../domain/types';
import { catalog, defaultOwned, instanceId } from '../data/fixtures/catalog';

export function CollectionEditor({
  owned,
  onChange,
  storageNotice,
}: {
  owned: OwnedInstance[];
  onChange: (next: OwnedInstance[]) => void;
  storageNotice: string | null;
}) {
  const [query, setQuery] = useState('');
  const selected = new Set(owned.map((instance) => instance.unitId));
  const visible = catalog.units.filter((unit) =>
    `${unit.name} ${unit.categories.join(' ')}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section
      className="panel collection-panel"
      id="collection"
      aria-labelledby="collection-title"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">01 / YOUR BOX</span>
          <h2 id="collection-title">
            Demo collection <span className="count">{owned.length}</span>
          </h2>
        </div>
        <span className="pill muted">LOCAL ONLY</span>
      </div>
      <p className="subtle">
        Choose the fictional units you own. Each checkbox represents one owned
        instance.
      </p>
      <label className="search-field">
        <span className="sr-only">Search demo units</span>
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search units or demo categories"
        />
      </label>
      <div className="collection-actions">
        <button
          className="text-button"
          type="button"
          onClick={() =>
            onChange(
              catalog.units.map((unit) => ({
                id: instanceId(unit.id),
                unitId: unit.id,
              })),
            )
          }
        >
          Own all 12
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() =>
            onChange(defaultOwned.map((instance) => ({ ...instance })))
          }
        >
          Reset demo
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => onChange([])}
        >
          Clear
        </button>
      </div>
      <div className="unit-list">
        {visible.map((unit, index) => {
          const unsupported = unit.mechanics.filter(
            (mechanic) => mechanic.status === 'unsupported',
          );
          return (
            <article
              className={`unit-row ${selected.has(unit.id) ? 'is-owned' : ''}`}
              key={unit.id}
            >
              <label className="unit-choice">
                <input
                  type="checkbox"
                  checked={selected.has(unit.id)}
                  aria-label={`Own ${unit.name}`}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [
                            ...owned,
                            { id: instanceId(unit.id), unitId: unit.id },
                          ]
                        : owned.filter(
                            (instance) => instance.unitId !== unit.id,
                          ),
                    )
                  }
                />
                <span
                  className={`unit-avatar tone-${index % 4}`}
                  aria-hidden="true"
                >
                  {unit.name
                    .split(' ')
                    .map((word) => word[0])
                    .join('')}
                </span>
                <span className="unit-name">
                  <strong>{unit.name}</strong>
                  <span>
                    {unit.categories
                      .map((id) => id.replace('demo:', ''))
                      .join(' · ')}{' '}
                    <span className="unit-state">/ {unit.awakeningState}</span>
                  </span>
                </span>
                {unit.leaderSkill && (
                  <span className="leader-badge" title="Available as leader">
                    L
                  </span>
                )}
              </label>
              <details className="unit-details">
                <summary>
                  Fixture details{' '}
                  {unsupported.length ? (
                    <span className="warning-text">· unsupported mechanic</span>
                  ) : null}
                </summary>
                <p>
                  Hand-authored ratings: pressure{' '}
                  {unit.syntheticRatings.pressure} · sustain{' '}
                  {unit.syntheticRatings.sustain} · utility{' '}
                  {unit.syntheticRatings.utility}. These are not game stats.
                </p>
                {unit.leaderSkill && (
                  <p>Leader rule: {unit.leaderSkill.label}</p>
                )}
                <p>
                  {unit.linkIds
                    .map(
                      (id) =>
                        catalog.links.find((link) => link.id === id)?.name,
                    )
                    .join(' · ')}{' '}
                  (synthetic)
                </p>
                <p>
                  Stable ID: <code>{unit.id}</code>
                  <br />
                  Source: {unit.provenance.sourceId}
                  <br />
                  Reviewed: {unit.provenance.reviewedAt} · Verified: never
                </p>
                <ul>
                  {unit.mechanics.map((mechanic) => (
                    <li key={mechanic.id}>
                      {mechanic.status} / {mechanic.scope}:{' '}
                      {mechanic.description}
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          );
        })}
        {!visible.length && (
          <p className="subtle">No fixture units match this search.</p>
        )}
      </div>
      <p
        className={`storage-status ${storageNotice ? 'warning-text' : ''}`}
        role="status"
      >
        {storageNotice ?? '✓ Collection saved in this browser'}
      </p>
    </section>
  );
}
