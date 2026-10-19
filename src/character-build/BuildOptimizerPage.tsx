import { useEffect, useMemo, useState } from 'react';
import type { CatalogSnapshot, CatalogState } from '../character-data/domain';
import CharacterWorkbench, { type Identity } from './CharacterWorkbench';
import type { BuildRequest, EvaluatorEntry } from './domain';
import {
  optimizableStates,
  resolveEvaluator,
  type Resolution,
} from './registry';
import './character.css';

const base = import.meta.env.BASE_URL;
export const optimizerHref = (stateId: string) =>
  `${base}?workbench=character-build&state=${encodeURIComponent(stateId)}`;
const catalogHref = (stateId: string) =>
  `${base}?state=${encodeURIComponent(stateId)}`;
const stateParam = () =>
  new URLSearchParams(window.location.search).get('state');

const REGIONS: Record<string, string> = { 'global-en': 'Global English' };

// Display identity comes from the catalog record, never from the evaluator.
export function identityFor(
  snapshot: CatalogSnapshot,
  state: CatalogState,
): Identity {
  const card = snapshot.cards.find((c) => c.id === state.cardId);
  const { kind, step } = state.awakening;
  return {
    name: card?.name.value ?? card?.id ?? state.cardId,
    title: card?.title.value ?? null,
    type: state.fields.type.value,
    cardClass: state.fields.class.value,
    rarity: state.fields.rarity.value,
    region: state.region ? (REGIONS[state.region] ?? state.region) : null,
    awakening:
      kind === 'eza'
        ? `EZA step ${step} · without Super EZA`
        : kind === 'seza'
          ? `Super EZA step ${step}`
          : kind === 'base'
            ? 'Base state (no EZA)'
            : 'Awakening state unknown',
    level: state.fields.level.value,
    superAttackLevel: state.fields.superAttackLevel.value,
    aliases: card?.aliases.map((a) => a.recordId) ?? [],
  };
}

function Picker({
  snapshot,
  registry,
}: {
  snapshot: CatalogSnapshot;
  registry: readonly EvaluatorEntry[];
}) {
  const supported = optimizableStates(registry, snapshot);
  const others = snapshot.states.length - supported.length;
  return (
    <main className="cb-workbench" id="character-workbench">
      <header className="cb-hero">
        <div>
          <p className="cb-eyebrow">CHARACTER BUILDS / BUILD OPTIMIZER</p>
          <h1>
            Choose a character
            <br />
            <span>to optimize.</span>
          </h1>
          <p>
            Each evaluator is bound to one exact card state. Settings and saved
            builds stay with that state.
          </p>
        </div>
      </header>
      <section className="cb-card" aria-labelledby="picker-title">
        <h2 id="picker-title">
          {supported.length} exact state{supported.length === 1 ? '' : 's'} with
          an evaluator
        </h2>
        <ul className="cb-picker">
          {supported.map(({ entry, state }) => {
            const id = identityFor(snapshot, state);
            return (
              <li key={entry.id}>
                <a href={optimizerHref(state.id)}>
                  <strong>{id.name}</strong>
                  {id.title && <span>{id.title}</span>}
                  <span>
                    {[id.cardClass, id.type, id.rarity]
                      .filter(Boolean)
                      .join(' ')}{' '}
                    · {id.awakening} · Lv.{id.level ?? '?'} / SA
                    {id.superAttackLevel ?? '?'} ·{' '}
                    {id.region ?? 'region unknown'}
                  </span>
                  <span className="cb-muted">
                    Evaluator {entry.id} · {entry.model.orbs.length} items ·{' '}
                    {entry.objectives.length} objectives · data{' '}
                    {entry.model.revision}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        <p className="cb-muted">
          {others} other catalog state{others === 1 ? '' : 's'} can be browsed
          in the <a href={base}>character catalog</a>, which states why
          optimization is unavailable for each.
        </p>
      </section>
    </main>
  );
}

function Unavailable({
  snapshot,
  resolution,
  requested,
}: {
  snapshot: CatalogSnapshot;
  resolution: Extract<Resolution, { ok: false }>;
  requested: string;
}) {
  const identity = resolution.state
    ? identityFor(snapshot, resolution.state)
    : null;
  return (
    <main className="cb-workbench" id="character-workbench">
      <section className="cb-card" aria-labelledby="unavailable-title">
        <p className="cb-eyebrow">BUILD OPTIMIZER</p>
        <h1 id="unavailable-title" className="cb-unavailable-title">
          Optimization unavailable
        </h1>
        {identity ? (
          <p>
            <strong>{identity.name}</strong>
            {identity.title && ` — ${identity.title}`} · {identity.awakening} ·
            Lv.{identity.level ?? '?'} / SA{identity.superAttackLevel ?? '?'}
          </p>
        ) : (
          <p>
            Requested state: <code>{requested}</code>
          </p>
        )}
        <p className="cb-error" role="alert">
          {resolution.reason}
        </p>
        <p className="cb-muted">
          No other character, state or evaluator is used in its place.
        </p>
        <p className="cb-button-row">
          {resolution.state && (
            <a className="cb-secondary" href={catalogHref(resolution.state.id)}>
              View catalog details
            </a>
          )}
          <a
            className="cb-secondary"
            href={`${base}?workbench=character-build`}
          >
            Choose a supported character
          </a>
        </p>
      </section>
    </main>
  );
}

export default function BuildOptimizerPage({
  snapshot,
  registry,
}: {
  snapshot: CatalogSnapshot;
  registry: readonly EvaluatorEntry[];
}) {
  const [requested, setRequested] = useState(stateParam);
  // Settings handed over when a saved build of another state is loaded.
  const [pending, setPending] = useState<{
    request: BuildRequest;
    message: string;
    nonce: number;
  } | null>(null);
  useEffect(() => {
    const pop = () => {
      setPending(null);
      setRequested(stateParam());
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const available = useMemo(
    () => optimizableStates(registry, snapshot).map((r) => r.entry),
    [registry, snapshot],
  );
  if (requested === null)
    return <Picker snapshot={snapshot} registry={registry} />;
  const resolution = resolveEvaluator(registry, snapshot, requested);
  if (!resolution.ok)
    return (
      <Unavailable
        snapshot={snapshot}
        resolution={resolution}
        requested={requested}
      />
    );
  return (
    <CharacterWorkbench
      key={`${resolution.entry.id}:${pending?.nonce ?? 0}`}
      entry={resolution.entry}
      identity={identityFor(snapshot, resolution.state)}
      available={available}
      pending={pending}
      onOpen={(entry, request, message) => {
        // Saved settings always open in their own state's workbench.
        window.history.pushState(null, '', optimizerHref(entry.stateId));
        setRequested(entry.stateId);
        setPending({ request, message, nonce: Date.now() });
      }}
    />
  );
}
