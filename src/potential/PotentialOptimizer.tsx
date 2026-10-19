import { useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogSnapshot, CatalogState } from '../character-data/domain';
import {
  METRIC_LABELS,
  SLOTS,
  type AvailableMetric,
  type BuildRequest,
  type EvaluatorEntry,
} from '../character-build/domain';
import { allocationSpace } from '../character-build/allocation';
import { resolveEvaluator } from '../character-build/registry';
import { resolveKit } from '../character-build/kit';
import { gohanKit } from '../data/real/character-build/gohan-kit';
import CatalogBrowser from '../characters/CatalogBrowser';
import CharacterAnalysis from './CharacterAnalysis';
import '../character-build/character.css';
import { loadCharacterState } from '../character-build/storage';
import { estimateCandidateSpace } from '../character-build/generation';
import { requestErrors } from '../character-build/legality';
import {
  searchBuilds,
  type SearchOutcome,
  type SearchProgress,
} from '../character-build/search';
import SavedBuilds from '../character-build/SavedBuilds';
import { itemLabel } from '../character-build/explanation';
import { download } from '../character-build/download';
import { browserStorage } from '../storage/browser';
import {
  loadDefinitions,
  latestDocuments,
} from '../character-definitions/library';
import { catalogCoverage, COVERAGE_LABELS } from './coverage';
import { resolveCapabilities, type Capabilities } from './capabilities';
import CurrentBuild from './CurrentBuild';
import GoalSettings from './GoalSettings';
import ResultPanel, { type Answer } from './ResultPanel';
import {
  recommendationGates,
  recommend,
  type RecommendationScope,
} from './recommendation';
import {
  resolveProgression,
  snapshotProgressions,
  type ProgressionCatalog,
} from './progression';
import { SLOT_NAMES } from './result';
import './potential.css';

const storage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) =>
    window.localStorage.setItem(key, value),
};
const emptyProgress = (): SearchProgress => ({
  scanned: 0,
  evaluated: 0,
  rejected: 0,
});
const optimizerHref = (state: string) =>
  `${import.meta.env.BASE_URL}?workbench=optimizer&state=${encodeURIComponent(state)}`;

// A readable name for an exact state: who, which form, which state.
function stateName(snapshot: CatalogSnapshot, s: CatalogState) {
  const card = snapshot.cards.find((c) => c.id === s.cardId);
  const awakening =
    s.awakening.kind === 'eza'
      ? `EZA${s.awakening.step === null ? '' : ` step ${s.awakening.step}`}`
      : s.awakening.kind === 'seza'
        ? 'Super EZA'
        : s.awakening.kind === 'base'
          ? 'Base (no EZA)'
          : 'Awakening unknown';
  const region =
    s.region === 'global-en'
      ? 'Global English'
      : (s.region ?? 'region unknown');
  return {
    name: card?.name.value ?? s.cardId,
    title: card?.title.value ?? '',
    detail: `${s.fields.type.value ?? '?'} ${s.fields.rarity.value ?? '?'} · ${awakening} · Lv.${s.fields.level.value ?? '?'} / SA${s.fields.superAttackLevel.value ?? '?'} · ${region}`,
  };
}

// The search scope follows from what the character supports and the chosen
// potential source; the user never picks a mode that cannot run.
function scopeFor(
  request: BuildRequest,
  capabilities: Capabilities,
): RecommendationScope {
  if (request.customPotential) return 'custom-input';
  return capabilities.allocation.full.available
    ? 'full-potential'
    : 'selected-profile';
}

function SupportSummary({ capabilities }: { capabilities: Capabilities }) {
  const { allocation, equipment, counts, gaps } = capabilities;
  return (
    <ul className="po-support" aria-label="What this character supports">
      <li data-status="available">
        <strong>Equipment search</strong>
        <span>
          {equipment
            .map((e) =>
              e.items
                ? `${e.items} ${e.slot}`
                : `${SLOT_NAMES[e.slot].toLowerCase()}: none recorded`,
            )
            .join(' · ')}
        </span>
      </li>
      <li data-status={allocation.full.available ? 'available' : 'unavailable'}>
        {allocation.full.available ? (
          <>
            <strong>Full allocation search</strong>
            <span>Every attainable allocation is compared.</span>
          </>
        ) : (
          <>
            <strong>
              Full allocation support not available for this character yet.
            </strong>
            <details>
              <summary>Why, and what you can do</summary>
              <p>Missing evidence:</p>
              <ul>
                {allocation.full.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p>
                Optimize equipment for the documented profile
                {allocation.custom.available
                  ? ', or enter your own current values'
                  : ''}
                .
              </p>
            </details>
          </>
        )}
      </li>
      <li
        data-status={allocation.custom.available ? 'available' : 'unavailable'}
      >
        <strong>Your current values</strong>
        <span>
          {allocation.custom.available
            ? 'Can be entered (board requirements not checked).'
            : 'Not supported by this evaluator.'}
        </span>
      </li>
      <li data-status="available">
        <strong>Objectives</strong>
        <span>
          {counts.supported} supported · {counts.experimental} experimental
          {counts.unavailable ? ` · ${counts.unavailable} unavailable` : ''}
          {gaps.length ? ' · damage and survival not modeled' : ''}
        </span>
      </li>
    </ul>
  );
}

function Workspace({
  entry: original,
  progressions,
  registry,
  pending,
  onOpen,
}: {
  entry: EvaluatorEntry;
  progressions: ProgressionCatalog;
  registry: readonly EvaluatorEntry[];
  pending: BuildRequest | null;
  onOpen: (entry: EvaluatorEntry, request: BuildRequest) => void;
}) {
  const { entry, capabilities } = useMemo(() => {
    const resolved = resolveProgression(original, progressions);
    const entry = resolved.ok ? resolved.entry : original;
    return { entry, capabilities: resolveCapabilities(entry, progressions) };
  }, [original, progressions]);
  // Older working settings are read but never written here; saves are explicit.
  const [initial] = useState(() => loadCharacterState(browserStorage(), entry));
  const [stored] = useState(() => {
    try {
      return storage.getItem(entry.storageKey) !== null;
    } catch {
      return false;
    }
  });
  const [request, setRequest] = useState<BuildRequest>(() =>
    pending
      ? structuredClone(pending)
      : stored && !initial.warning
        ? initial.state
        : { ...initial.state, mode: 'catalog' },
  );
  // No objective is preselected for a new session: none of the supported
  // ones is a meaningful default for every player.
  const [objectiveChosen, setObjectiveChosen] = useState(
    () => !!pending || (stored && !initial.warning),
  );
  const [budget, setBudget] = useState(100000);
  const [running, setRunning] = useState(false),
    [progress, setProgress] = useState(emptyProgress);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const token = useRef({ cancelled: false, id: 0 });
  const inputs = useRef<HTMLDivElement>(null),
    resultHeading = useRef<HTMLHeadingElement>(null);
  const invalidate = () => {
    token.current.cancelled = true;
    token.current = { cancelled: false, id: token.current.id + 1 };
    setRunning(false);
    setAnswer(null);
  };
  const update = (value: BuildRequest) => {
    invalidate();
    setRequest(value);
  };
  useEffect(
    () => () => {
      token.current.cancelled = true;
    },
    [],
  );
  const errors = requestErrors(request, entry);
  const validBudget =
    Number.isSafeInteger(budget) && budget >= 1 && budget <= 1_000_000;
  const scope = scopeFor(request, capabilities);
  const objective =
    capabilities.objectives.find((o) => o.metric === request.objective) ?? null;
  // A blocked objective still runs through the gates, so its exact reason is
  // shown as the result instead of a silent no-op.
  const ready = objectiveChosen && !errors.length && validBudget;
  const space = errors.length ? null : estimateCandidateSpace(request, entry);
  const allocations = errors.length
    ? null
    : allocationSpace(request, entry).count;
  const summary = space
    ? `${scope === 'custom-input' ? 'Your entered values' : capabilities.allocation.documented.label}: ${allocations} allocation${allocations === 1 ? '' : 's'} × equipment = up to ${space.upperBound.toLocaleString('en-US')} combinations.`
    : null;
  const evaluation = useMemo(() => {
    if (errors.length) return null;
    try {
      return entry.evaluator.evaluate(request.current, request, entry);
    } catch {
      return null;
    }
  }, [entry, request, errors.length]);

  const run = async () => {
    if (!ready) {
      inputs.current
        ?.querySelector<HTMLElement>(
          objectiveChosen
            ? '[aria-invalid=true]'
            : 'input[name=objective]:not(:disabled)',
        )
        ?.focus();
      return;
    }
    invalidate();
    const current = token.current;
    const saved = structuredClone(request);
    const gates = recommendationGates(entry, progressions, saved, scope);
    if (gates.length) {
      const empty: SearchOutcome = {
        comparison: {
          errors: [],
          current: null,
          groups: [],
          frontier: {
            comparable: false,
            metricsUsed: [],
            omittedMetrics: [],
            reason: 'No search performed.',
          },
          search: {
            evaluated: 0,
            unique: 0,
            totalLegal: null,
            limit: saved.maxCandidates,
            truncated: false,
          },
        },
        progress: emptyProgress(),
        stop: 'error',
      };
      setAnswer({
        value: recommend(empty, saved, scope, gates),
        outcome: null,
        request: saved,
      });
      setTimeout(() => resultHeading.current?.focus(), 0);
      return;
    }
    setRunning(true);
    setProgress(emptyProgress());
    const outcome = await searchBuilds(saved, entry, {
      maxScanned: budget,
      cancelled: () => current.cancelled,
      progress: (p) => {
        if (token.current.id === current.id) setProgress(p);
      },
      yieldControl: () => new Promise((resolve) => setTimeout(resolve, 0)),
    });
    if (token.current.id !== current.id) return;
    setRunning(false);
    setAnswer({
      value: recommend(outcome, saved, scope, []),
      outcome,
      request: saved,
    });
    setTimeout(() => resultHeading.current?.focus(), 0);
  };
  const describe = (r: BuildRequest) =>
    `${entry.model.card.name} · ${r.customPotential ? 'your entered values' : entry.model.profile.label} · ${SLOTS.map((s) => itemLabel(entry, r.current.equips[s])).join(' / ')} · ${METRIC_LABELS[r.objective]}`;
  const answerObjective = answer
    ? (capabilities.objectives.find(
        (o) => o.metric === answer.request.objective,
      ) ?? null)
    : null;
  return (
    <>
      <SupportSummary capabilities={capabilities} />
      {initial.warning && (
        <div className="po-notice">
          {initial.warning} The optimizer reads this older working copy without
          writing it; named build saves are explicit below.
          {initial.raw !== null && (
            <button
              type="button"
              className="cb-secondary"
              onClick={() =>
                download(
                  'dokkan-working-settings-unreadable.json',
                  initial.raw!,
                )
              }
            >
              Download stored settings copy
            </button>
          )}
        </div>
      )}
      <div className="po-workspace">
        <div className="po-inputs" ref={inputs}>
          <CurrentBuild
            entry={entry}
            request={request}
            capabilities={capabilities}
            evaluation={evaluation}
            onChange={update}
          />
          <GoalSettings
            entry={entry}
            request={request}
            capabilities={capabilities}
            objectiveChosen={objectiveChosen}
            budget={budget}
            estimate={summary}
            onChange={update}
            onObjective={(metric: AvailableMetric) => {
              setObjectiveChosen(true);
              update({ ...request, objective: metric });
            }}
            onBudget={(n) => {
              invalidate();
              setBudget(n);
            }}
          />
        </div>
        <div
          className="po-output"
          role="region"
          aria-label="Optimize and result"
          tabIndex={0}
        >
          <div className="po-run">
            <div className="cb-button-row">
              <button
                type="button"
                className="cb-primary"
                disabled={running}
                onClick={run}
              >
                Optimize
              </button>
              {running && (
                <button
                  type="button"
                  className="cb-secondary"
                  onClick={() => {
                    token.current.cancelled = true;
                  }}
                >
                  Cancel search
                </button>
              )}
            </div>
            {!objectiveChosen ? (
              <p className="po-muted">Choose an objective in step 3.</p>
            ) : (
              summary && <p className="po-muted">{summary}</p>
            )}
            {errors.length > 0 && (
              <ul role="alert" className="po-errors">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>
          <ResultPanel
            answer={answer}
            entry={entry}
            objective={answer ? answerObjective : objective}
            running={running}
            progress={progress}
            ready={ready}
            resultRef={resultHeading}
          />
        </div>
      </div>
      <details
        className="po-saved"
        open={
          new URLSearchParams(window.location.search).get('saved') === '1' ||
          undefined
        }
      >
        <summary>Saved builds · save, load or export</summary>
        <SavedBuilds
          entry={entry}
          available={registry}
          request={request}
          describe={describe}
          inputIssues={errors.length + Number(!validBudget)}
          onReplace={(r) => {
            setObjectiveChosen(true);
            update(r);
          }}
          onOpen={(e, r) => onOpen(e, r)}
        />
      </details>
    </>
  );
}

export default function PotentialOptimizer({
  snapshot,
  registry,
}: {
  snapshot: CatalogSnapshot;
  registry: readonly EvaluatorEntry[];
}) {
  const progressions = useMemo(
    () => snapshotProgressions(registry),
    [registry],
  );
  const [selected, setSelected] = useState(
    () => new URLSearchParams(window.location.search).get('state') ?? '',
  );
  const [pending, setPending] = useState<BuildRequest | null>(null);
  const [nonce, setNonce] = useState(0);
  const [local] = useState(() =>
    latestDocuments(loadDefinitions(storage).library),
  );
  const coverage = catalogCoverage(snapshot, registry, progressions);
  const resolution = selected
    ? resolveEvaluator(registry, snapshot, selected)
    : null;
  const kit = selected ? resolveKit(snapshot, [gohanKit], selected) : null;
  const params = new URLSearchParams(window.location.search);
  const browsing =
    params.get('workbench') === 'catalog' ||
    params.get('browse') === '1' ||
    (params.get('workbench') === null && params.has('state'));
  // Mount on first request, then preserve local catalog imports/filters.
  const [browseMounted, setBrowseMounted] = useState(browsing);
  useEffect(() => {
    const pop = () => {
      setSelected(
        new URLSearchParams(window.location.search).get('state') ?? '',
      );
      setPending(null);
      setNonce((n) => n + 1);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const select = (state: string, request: BuildRequest | null = null) => {
    setSelected(state);
    setPending(request);
    setNonce((n) => n + 1);
    const url = new URL(window.location.href);
    url.searchParams.set('workbench', 'optimizer');
    if (state) url.searchParams.set('state', state);
    else url.searchParams.delete('state');
    window.history.pushState(null, '', url);
  };
  const supported = snapshot.states.filter(
    (s) => resolveEvaluator(registry, snapshot, s.id).ok,
  );
  const others = snapshot.states.filter((s) => !supported.includes(s));
  const guided = others.filter(
    (s) => resolveKit(snapshot, [gohanKit], s.id).ok,
  );
  const unsupported = others.filter((s) => !guided.includes(s));
  const state = snapshot.states.find((s) => s.id === selected) ?? null;
  const name = state ? stateName(snapshot, state) : null;
  const isLocal = local.some((d) => d.definition.id === selected);
  const option = (s: CatalogState) => {
    const n = stateName(snapshot, s);
    return (
      <option key={s.id} value={s.id}>
        {n.name} — {n.title} · {n.detail}
      </option>
    );
  };
  return (
    <main className="po-page">
      <header className="po-hero">
        <p className="po-eyebrow">DOKKAN POTENTIAL OPTIMIZER</p>
        <h1>Build around the character’s kit.</h1>
        <p>
          Kit facts → intended slot and role → potential emphasis → equip
          priorities. Start with reviewed character guidance; exact build search
          is offered only within its documented support.
        </p>
      </header>
      {(params.get('workbench') === 'legacy-team' ||
        params.get('retired') === 'team') && (
        <p className="po-notice">
          The synthetic team demo has been retired. Its browser storage has not
          been deleted.
        </p>
      )}
      <section
        className="po-card po-character"
        aria-labelledby="po-character-title"
      >
        <h2 id="po-character-title">
          <span className="po-step">1</span> Character
        </h2>
        <label className="po-field">
          <span>Character and exact state</span>
          <select value={selected} onChange={(e) => select(e.target.value)}>
            <option value="">Choose a character</option>
            {guided.length > 0 && (
              <optgroup label="Reviewed kit guidance">
                {guided.map(option)}
              </optgroup>
            )}
            {supported.length > 0 && (
              <optgroup label="Limited equipment comparison">
                {supported.map(option)}
              </optgroup>
            )}
            {unsupported.length > 0 && (
              <optgroup label="Not supported yet">
                {unsupported.map(option)}
              </optgroup>
            )}
            {local.length > 0 && (
              <optgroup label="Your maintenance records — support checked separately">
                {local.map((d) => (
                  <option key={d.definition.id} value={d.definition.id}>
                    {d.definition.title} · {d.definition.name} ·{' '}
                    {d.definition.awakening.kind} · user-entered ·{' '}
                    {d.definition.id}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        {name && state && (
          <div className="po-identity">
            <p className="po-name">{name.name}</p>
            <p>
              {name.title} · {name.detail}
            </p>
            <p className="po-muted">State ID {state.id}</p>
          </div>
        )}
        {!selected && (
          <div className="po-quick">
            <p className="po-muted">
              {guided.length} state with reviewed kit guidance ·{' '}
              {supported.length} with a limited equipment evaluator. No complete
              allocation search yet.
            </p>
            {[...guided, ...supported].map((s) => {
              const n = stateName(snapshot, s);
              return (
                <button
                  key={s.id}
                  type="button"
                  className="cb-secondary"
                  onClick={() => select(s.id)}
                >
                  {n.name} · {n.detail} ·{' '}
                  {guided.includes(s) ? 'Kit guidance' : 'Equipment comparison'}
                </button>
              );
            })}
          </div>
        )}
      </section>
      <details
        className="po-browse"
        open={browsing || undefined}
        onToggle={(e) => {
          if (e.currentTarget.open) setBrowseMounted(true);
        }}
      >
        <summary>Search characters and inspect details</summary>
        {browseMounted && (
          <CatalogBrowser
            embedded
            initialState={selected || null}
            onChoose={(id) => select(id)}
          />
        )}
      </details>
      {kit?.ok && <CharacterAnalysis key={kit.kit.revision} kit={kit.kit} />}
      {resolution?.ok && (
        <section aria-label="Limited progression-profile and equipment comparison">
          <h2 className="po-comparison-title">
            Limited progression-profile / equipment comparison
          </h2>
          <p className="po-muted">
            This evaluator is separate from kit guidance. It does not select
            potential nodes or model a full attack chain, damage or survival.
          </p>
          <Workspace
            key={`${resolution.entry.id}:${nonce}`}
            entry={resolution.entry}
            progressions={progressions}
            registry={registry}
            pending={pending}
            onOpen={(e, r) => select(e.stateId, r)}
          />
        </section>
      )}
      {resolution && !resolution.ok && !kit?.ok && (
        <section
          className="po-card po-unsupported"
          aria-label="Build recommendation"
        >
          <h2>Not supported yet</h2>
          <p>
            {isLocal
              ? 'This user definition has no reviewed potential-template mapping or character-aware evaluator. Recorded text/custom totals are retained in maintenance and do not establish attainable allocations.'
              : resolution.reason}
          </p>
          <p>No other character or state is used in its place.</p>
          <ul>
            {supported.slice(0, 3).map((s) => {
              const n = stateName(snapshot, s);
              return (
                <li key={s.id}>
                  <a href={optimizerHref(s.id)}>
                    Compare equipment for {n.name} ({n.detail})
                  </a>
                </li>
              );
            })}
            {state && (
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}?workbench=catalog&state=${encodeURIComponent(state.id)}`}
                >
                  View this state's recorded details
                </a>
              </li>
            )}
            {isLocal && (
              <li>
                <a href={`${import.meta.env.BASE_URL}?workbench=definitions`}>
                  Open character maintenance
                </a>
              </li>
            )}
          </ul>
        </section>
      )}
      <details
        className="po-coverage"
        open={params.get('about') === '1' || undefined}
      >
        <summary>Character catalog coverage</summary>
        <dl>
          {Object.entries(coverage).map(([key, count]) => (
            <div key={key}>
              <dt>{COVERAGE_LABELS[key as keyof typeof coverage]}</dt>
              <dd>{count === null ? 'Unknown source total' : count}</dd>
            </div>
          ))}
        </dl>
        <p>
          {coverage.exactStates} exact{' '}
          {coverage.exactStates === 1 ? 'state is' : 'states are'} currently
          bundled, each recorded individually; {coverage.evaluatorStates} with a
          limited evaluator. This is not complete coverage; unsupported
          characters are kept in catalog/maintenance rather than silently
          assigned an evaluator. No new provider dataset is imported.
        </p>
        <a href={`${import.meta.env.BASE_URL}?workbench=catalog`}>
          Browse factual details and completeness
        </a>
        <p>
          Bulk catalog acquisition needs an approved Dokkan Info text
          export/schema and terms covering caching, public distribution and
          updates. No provider integration is connected.
        </p>
        <p>
          The retired synthetic team key{' '}
          <code>dokkan-team-lab.collection.v1</code> is left untouched. Existing
          Goku working settings and named build formats are preserved.
        </p>
      </details>
    </main>
  );
}
