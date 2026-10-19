import { useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogSnapshot } from '../character-data/domain';
import {
  METRIC_LABELS,
  SKILLS,
  SLOTS,
  type BuildRequest,
  type EvaluatorEntry,
} from '../character-build/domain';
import { resolveEvaluator } from '../character-build/registry';
import { loadCharacterState } from '../character-build/storage';
import { estimateCandidateSpace } from '../character-build/generation';
import { requestErrors, orbErrors } from '../character-build/legality';
import {
  searchBuilds,
  type SearchOutcome,
  type SearchProgress,
} from '../character-build/search';
import { formatDeltaInfo, formatMetric } from '../character-build/format';
import SavedBuilds from '../character-build/SavedBuilds';
import ResultExplanation from '../character-build/ResultExplanation';
import { explainGroup } from '../character-build/explanation';
import {
  loadDefinitions,
  latestDocuments,
} from '../character-definitions/library';
import { NumberField } from '../character-definitions/fields';
import { catalogCoverage, COVERAGE_LABELS } from './coverage';
import {
  recommendationGates,
  recommend,
  type DirectRecommendation,
  type RecommendationScope,
} from './recommendation';
import {
  resolveProgression,
  snapshotProgressions,
  type ProgressionCatalog,
} from './progression';
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
function Alternatives({
  outcome,
  request,
}: {
  outcome: SearchOutcome;
  request: BuildRequest;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(50);
  const rows = outcome.comparison.groups
    .filter((g) => g.rank === 1 || g.frontier)
    .flatMap((group) =>
      group.alternatives.map((alternative) => ({ group, alternative })),
    );
  const metrics = outcome.comparison.frontier.metricsUsed;
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Alternatives, ties and tradeoffs</summary>
      {open && (
        <>
          <p>
            {outcome.comparison.frontier.reason} Metrics:{' '}
            {metrics.map((m) => METRIC_LABELS[m]).join(', ') || 'unavailable'}.
          </p>
          {metrics.some((m) =>
            ['critical', 'evasion', 'additionalSuper'].includes(m),
          ) && (
            <p>
              Probability tradeoffs use the source-documented initial-check
              model, not independently confirmed game behavior.
            </p>
          )}
          <ul>
            {rows.slice(0, count).map(({ group, alternative }, i) => (
              <li key={i}>
                <strong>
                  {METRIC_LABELS[request.objective]}:{' '}
                  {formatMetric(group.evaluation.metrics[request.objective])}
                </strong>
                {' · '}
                {alternative.changes.join('; ') || 'Current build'}
                <p>
                  {metrics
                    .map(
                      (m) =>
                        `${METRIC_LABELS[m]}: ${formatMetric(group.evaluation.metrics[m])}`,
                    )
                    .join(' · ')}
                  .{' '}
                  {!outcome.comparison.frontier.comparable
                    ? 'Frontier unavailable.'
                    : group.frontier
                      ? 'Non-dominated on these common metrics.'
                      : 'Off the frontier.'}
                </p>
              </li>
            ))}
          </ul>
          <p>
            {Math.min(count, rows.length)} of {rows.length} input alternatives
            shown; equivalent evaluations retain their distinct inputs.
          </p>
          {count < rows.length && (
            <button type="button" onClick={() => setCount((n) => n + 50)}>
              Show 50 more alternatives
            </button>
          )}
        </>
      )}
    </details>
  );
}
function DirectResult({
  value,
  outcome,
  request,
  entry,
}: {
  value: DirectRecommendation;
  outcome: SearchOutcome | null;
  request: BuildRequest;
  entry: EvaluatorEntry;
}) {
  const selected = value.selected,
    group = selected?.group;
  const alternative =
    group && selected ? group.alternatives[selected.alternativeIndex] : null;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const explanation =
    outcome && group && selected
      ? explainGroup(
          group.id === 'current-baseline'
            ? {
                ...outcome.comparison,
                groups: [group, ...outcome.comparison.groups],
              }
            : outcome.comparison,
          request,
          entry,
          group.id,
          selected.alternativeIndex,
        )
      : null;
  return (
    <section
      className="potential-result"
      aria-label="Build recommendation"
      tabIndex={-1}
    >
      <p className="eyebrow">
        {value.scope === 'full-potential'
          ? 'FULL POTENTIAL REQUEST'
          : 'SELECTED PROFILE ONLY'}
      </p>
      <h2>{value.title}</h2>
      {value.reasons.map((r) => (
        <p key={r}>{r}</p>
      ))}
      {group && (
        <p>
          {entry.recommendationSupport?.[request.objective]?.excludes.join(
            '; ',
          )}{' '}
          are excluded.{' '}
          {['additionalSuper', 'critical', 'evasion'].includes(
            request.objective,
          ) &&
            'Probability result uses acknowledged source-model assumptions; game conventions remain unresolved.'}
        </p>
      )}
      {group && alternative && (
        <>
          <p>
            <strong>
              {METRIC_LABELS[request.objective]}:{' '}
              {formatMetric(group.evaluation.metrics[request.objective])}
            </strong>
            {value.delta && <> · {formatDeltaInfo(value.delta)} vs current</>}
          </p>
          <div className="potential-build">
            <div>
              <h3>Potential and skill totals</h3>
              <dl>
                {SKILLS.map((skill) => (
                  <div key={skill}>
                    <dt>
                      {skill === 'additional'
                        ? 'Additional'
                        : skill === 'critical'
                          ? 'Critical'
                          : 'Evasion'}
                    </dt>
                    <dd>{group.evaluation.skills[skill]}</dd>
                  </div>
                ))}
              </dl>
              <p>
                {entry.model.profile.label}.{' '}
                {entry.model.profile.nodes.length
                  ? 'Only the supplied activated choice nodes were searched.'
                  : 'Fixed supplied profile; no selectable allocation nodes were searched.'}
              </p>
            </div>
            <div>
              <h3>Equipment</h3>
              <dl>
                {SLOTS.map((slot) => (
                  <div key={slot}>
                    <dt>{slot}</dt>
                    <dd>
                      {entry.model.orbs.find(
                        (o) => o.id === alternative.build.equips[slot],
                      )?.label ?? 'Empty'}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <h3>Change from your build</h3>
          <ul>
            {(alternative.changes.length
              ? alternative.changes
              : ['No changes required.']
            ).map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
          <h3>Why this result</h3>
          <p>
            {value.search.complete
              ? 'The supported search completed.'
              : 'The search stopped early; better alternatives may remain.'}{' '}
            This configuration has the best available{' '}
            {METRIC_LABELS[request.objective].toLowerCase()} value among{' '}
            {value.search.evaluated} evaluated targets and the current baseline.{' '}
            {value.tiedAlternatives} compatible configuration
            {value.tiedAlternatives === 1 ? '' : 's'} share that objective
            value. This is not an overall-strength, damage or survival
            conclusion.
          </p>
          {outcome && <Alternatives outcome={outcome} request={request} />}
          {explanation && (
            <details>
              <summary>Calculation trace and evidence</summary>
              <ResultExplanation
                explanation={explanation}
                entry={entry}
                headingRef={headingRef}
              />
            </details>
          )}
        </>
      )}
      <details>
        <summary>Search details</summary>
        {!outcome ? (
          <p>
            No candidate search was performed; the requirements above must be
            resolved first.
          </p>
        ) : (
          <p>
            {value.search.scanned} combinations checked ·{' '}
            {value.search.rejected} rejected before evaluation ·{' '}
            {value.search.evaluated} evaluated ·{' '}
            {outcome.comparison.search.unique} distinct evaluations. Stop:{' '}
            {value.search.stop}.{' '}
            {value.search.complete
              ? 'Complete for the declared profile/context/catalog.'
              : 'Incomplete search: best found so far, never globally optimal.'}
          </p>
        )}
      </details>
    </section>
  );
}

function CharacterSearch({
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
  const resolved = resolveProgression(original, progressions);
  const entry = resolved.ok ? resolved.entry : original;
  const [initial] = useState(() => loadCharacterState(storage, entry));
  const [request, setRequest] = useState<BuildRequest>(() => {
    if (pending) return structuredClone(pending);
    let exists = false;
    try {
      exists = storage.getItem(entry.storageKey) !== null;
    } catch {
      /* warning comes from loader */
    }
    return exists
      ? initial.state
      : { ...initial.state, mode: 'inventory', objective: 'hp' };
  });
  const [scope, setScope] = useState<RecommendationScope>('full-potential');
  const [acknowledged, setAcknowledged] = useState(false);
  const [budget, setBudget] = useState<number | null>(100000);
  const [running, setRunning] = useState(false),
    [progress, setProgress] = useState(emptyProgress);
  const [answer, setAnswer] = useState<{
    value: DirectRecommendation;
    outcome: SearchOutcome | null;
    request: BuildRequest;
  } | null>(null);
  const token = useRef<{ cancelled: boolean; id: number }>({
    cancelled: false,
    id: 0,
  });
  const input = useRef<HTMLDivElement>(null),
    resultRegion = useRef<HTMLDivElement>(null);
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
    budget !== null &&
    Number.isSafeInteger(budget) &&
    budget >= 1 &&
    budget <= 1_000_000;
  const space = errors.length ? null : estimateCandidateSpace(request, entry);
  const run = async () => {
    if (errors.length || !validBudget) {
      input.current?.querySelector<HTMLElement>('[aria-invalid=true]')?.focus();
      return;
    }
    invalidate();
    const current = token.current;
    const saved = structuredClone(request);
    const gates = recommendationGates(
      entry,
      progressions,
      saved,
      scope,
      acknowledged,
    );
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
      setTimeout(() => resultRegion.current?.focus(), 0);
      return;
    }
    setRunning(true);
    setProgress(emptyProgress());
    const outcome = await searchBuilds(saved, entry, {
      maxScanned: budget!,
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
    setTimeout(() => resultRegion.current?.focus(), 0);
  };
  const describe = (r: BuildRequest) =>
    `${entry.model.card.name} · ${entry.model.profile.label} · ${METRIC_LABELS[r.objective]}`;
  return (
    <>
      <h2>
        {entry.model.card.title} · {entry.model.card.name}
      </h2>
      <p>
        {entry.model.card.type} / {entry.model.card.rarity} ·{' '}
        {entry.model.card.awakening} · Lv.{entry.model.card.level}/SA
        {entry.model.card.superAttackLevel} · {entry.model.card.region}
      </p>
      {initial.warning && (
        <p className="potential-notice">
          {initial.warning} The optimizer reads this older working copy without
          writing it; named build saves are explicit below.
        </p>
      )}
      <div ref={input} className="potential-steps">
        <section>
          <h3>2 · Progression and current build</h3>
          <label>
            Recommendation scope
            <select
              aria-label="Recommendation scope"
              value={scope}
              onChange={(e) => {
                invalidate();
                setScope(e.target.value as RecommendationScope);
              }}
            >
              <option value="full-potential">Full potential allocation</option>
              <option value="selected-profile">
                Selected documented profile only
              </option>
            </select>
          </label>
          <p>
            {scope === 'full-potential'
              ? 'The complete node/template mapping is not admitted for this state. The result will identify that exact gate.'
              : 'Only this supplied profile is admitted; this is a scoped equipment/choice comparison, not full potential optimization.'}
          </p>
          <label>
            Supported progression
            <select
              aria-label="Supported progression"
              value={entry.model.profile.id}
              onChange={() => {}}
            >
              <option value={entry.model.profile.id}>
                {entry.model.profile.label} ·{' '}
                {entry.model.profile.routes.length} duplicate routes
              </option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={request.progression.systemUnlocked}
              onChange={(e) =>
                update({
                  ...request,
                  progression: {
                    ...request.progression,
                    systemUnlocked: e.target.checked,
                  },
                })
              }
            />
            Hidden Potential already unlocked
          </label>
          {entry.model.profile.nodes.map((node) => (
            <div key={node.id}>
              <label>
                <input
                  type="checkbox"
                  checked={request.progression.activatedNodes.includes(node.id)}
                  onChange={(e) => {
                    const choices = { ...request.current.choices };
                    if (e.target.checked) choices[node.id] = node.options[0]!;
                    else delete choices[node.id];
                    update({
                      ...request,
                      progression: {
                        ...request.progression,
                        activatedNodes: e.target.checked
                          ? [...request.progression.activatedNodes, node.id]
                          : request.progression.activatedNodes.filter(
                              (id) => id !== node.id,
                            ),
                      },
                      current: { ...request.current, choices },
                    });
                  }}
                />
                {node.id}: activated · {node.route} · requires SA{' '}
                {node.minSuperAttackLevel}
                {node.prerequisites.length
                  ? ` and ${node.prerequisites.join(', ')}`
                  : ''}
              </label>
              {request.progression.activatedNodes.includes(node.id) && (
                <label>
                  {node.id} (current choice)
                  <select
                    aria-label={`Current node ${node.id}`}
                    value={request.current.choices[node.id]}
                    onChange={(e) =>
                      update({
                        ...request,
                        current: {
                          ...request.current,
                          choices: {
                            ...request.current.choices,
                            [node.id]: e.target
                              .value as (typeof node.options)[number],
                          },
                        },
                      })
                    }
                  >
                    {node.options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ))}
          {SLOTS.map((slot) => (
            <label key={slot}>
              Current {slot} equipment
              <select
                aria-label={`Current ${slot} equipment`}
                value={request.current.equips[slot] ?? ''}
                onChange={(e) =>
                  update({
                    ...request,
                    current: {
                      ...request.current,
                      equips: {
                        ...request.current.equips,
                        [slot]: e.target.value || null,
                      },
                    },
                  })
                }
              >
                <option value="">Empty</option>
                {entry.model.orbs
                  .filter((o) => o.slots.includes(slot))
                  .map((o) => (
                    <option
                      key={o.id}
                      value={o.id}
                      disabled={
                        orbErrors(o, slot, request, entry.model).length > 0
                      }
                    >
                      {o.label}
                    </option>
                  ))}
              </select>
            </label>
          ))}
          <p className="cb-muted">
            Other route/node configurations need actual node options, increments
            and prerequisites. A percentage or custom total cannot supply them.
          </p>
        </section>
        <section>
          <h3>3 · Equipment availability</h3>
          <label>
            Equipment mode
            <select
              aria-label="Equipment mode"
              value={request.mode}
              onChange={(e) =>
                update({
                  ...request,
                  mode: e.target.value as BuildRequest['mode'],
                })
              }
            >
              <option value="inventory">
                Best build using my available equipment
              </option>
              <option value="catalog">Best available in catalog</option>
            </select>
          </label>
          {request.mode === 'inventory' && (
            <details open>
              <summary>Unequipped inventory quantities</summary>
              {entry.model.orbs.map((o) => (
                <NumberField
                  key={o.id}
                  label={`${o.label} unequipped quantity`}
                  value={request.inventory[o.id] ?? 0}
                  max={999}
                  onChange={(n) =>
                    update({
                      ...request,
                      inventory: {
                        ...request.inventory,
                        [o.id]: n ?? Number.NaN,
                      },
                    })
                  }
                />
              ))}
            </details>
          )}
          <p>
            Current items can be retained in the same slot. They are not free
            extra copies or transferable inventory. Costs and affordability are
            not evaluated.
          </p>
        </section>
      </div>
      <section>
        <h3>4 · Objective and assumptions</h3>
        <label>
          Optimization objective
          <select
            aria-label="Optimization objective"
            value={request.objective}
            onChange={(e) =>
              update({
                ...request,
                objective: e.target.value as BuildRequest['objective'],
              })
            }
          >
            {entry.objectives.map((m) => (
              <option key={m} value={m}>
                {METRIC_LABELS[m]}
                {['attack', 'defense', 'hp'].includes(m)
                  ? ' · before battle modifiers'
                  : ' · initial-check model'}
              </option>
            ))}
          </select>
        </label>
        <p>
          Card stat objectives do not estimate damage or survivability. Expected
          damage is a priority engineering gap: its combat stages, enemy
          interactions, variance and rounding are not validated.
        </p>
        <details>
          <summary>
            Advanced context, alternative metrics and search limits
          </summary>
          <p>
            {entry.contexts[0]?.assumptions.join(' · ')}. Conditions are fixed
            by this evaluator; no full turn is simulated.
          </p>
          <label>
            <input
              type="checkbox"
              checked={request.context.evasionAllowed}
              onChange={(e) =>
                update({
                  ...request,
                  context: {
                    ...request.context,
                    evasionAllowed: e.target.checked,
                  },
                })
              }
            />
            Evasion is allowed by the selected context
          </label>
          <label>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => {
                invalidate();
                setAcknowledged(e.target.checked);
              }}
            />
            I accept the source-documented initial-check probability model, not
            independently confirmed game behavior
          </label>
          <fieldset>
            <legend>Metrics defining the tradeoff frontier</legend>
            {entry.objectives.map((m) => (
              <label key={m}>
                <input
                  type="checkbox"
                  checked={request.frontierMetrics.includes(m)}
                  onChange={(e) =>
                    update({
                      ...request,
                      frontierMetrics: e.target.checked
                        ? [...request.frontierMetrics, m]
                        : request.frontierMetrics.filter((key) => key !== m),
                    })
                  }
                />
                {METRIC_LABELS[m]} frontier metric
              </label>
            ))}
          </fieldset>
          <NumberField
            label="Maximum evaluations"
            value={request.maxCandidates}
            min={1}
            max={20000}
            onChange={(n) =>
              update({ ...request, maxCandidates: n ?? Number.NaN })
            }
          />
          <NumberField
            label="Maximum combinations checked"
            value={budget}
            min={1}
            max={1000000}
            onChange={(n) => {
              invalidate();
              setBudget(n);
            }}
          />
          <p>
            {space
              ? `${space.allocations} allocation combinations × equipment pools = at most ${space.upperBound.toLocaleString('en-US')} targets before inventory checks.`
              : 'Search size unavailable until inputs meet requirements.'}
          </p>
        </details>
        {errors.length > 0 && (
          <ul role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {!validBudget && (
          <p role="alert">Enter a combination budget from 1 to 1000000.</p>
        )}
        <div className="cb-button-row">
          <button
            type="button"
            className="cb-primary"
            disabled={running || errors.length > 0 || !validBudget}
            onClick={run}
          >
            Recommend build
          </button>
          {running && (
            <button
              type="button"
              onClick={() => {
                token.current.cancelled = true;
              }}
            >
              Cancel search
            </button>
          )}
        </div>
        {running && (
          <p role="status">
            {progress.scanned} checked · {progress.evaluated} evaluated ·{' '}
            {progress.rejected} requirements not met
          </p>
        )}
      </section>
      <div ref={resultRegion} tabIndex={-1}>
        {answer && (
          <DirectResult
            value={answer.value}
            outcome={answer.outcome}
            request={answer.request}
            entry={entry}
          />
        )}
      </div>
      <details>
        <summary>Saved builds and JSON backups</summary>
        <SavedBuilds
          entry={entry}
          available={registry}
          request={request}
          describe={describe}
          inputIssues={errors.length + Number(!validBudget)}
          onReplace={(r) => update(r)}
          onOpen={(e, r) => onOpen(e, r)}
        />
      </details>
      <details>
        <summary>Catalog scope, excluded effects and evidence</summary>
        <p>
          {entry.model.orbs.length} admitted equipment records; not every orb in
          the game. Generic silver source IDs/restrictions still await direct
          confirmation; no verified-only label is used. No artwork is bundled.
        </p>
        <p>
          {entry.recommendationSupport?.[request.objective]?.excludes.join(
            '; ',
          )}
        </p>
        <p>
          All current rules/records are source-documented, not independently
          confirmed. Math tests check the implementation, not the game. No
          card-specific missing mechanic is substituted with another character’s
          model.
        </p>
        <code>
          {entry.stateId} · {entry.model.revision} · {entry.evaluator.id}/
          {entry.evaluator.version}
        </code>
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
  return (
    <main className="cb-workbench potential-workbench">
      <header>
        <p className="eyebrow">DOKKAN HIDDEN POTENTIAL</p>
        <h1>
          Choose a character.
          <br />
          Find what to change.
        </h1>
        <p>
          Select the exact state, progression, equipment and objective.
          Recommendations state precisely which choices and mechanics were
          searched.
        </p>
      </header>
      <section>
        <h2>1 · Select a character</h2>
        <label>
          Character and exact state
          <select
            aria-label="Character and exact state"
            value={selected}
            onChange={(e) => select(e.target.value)}
          >
            <option value="">Choose a character</option>
            {snapshot.states.map((s) => {
              const c = snapshot.cards.find((c) => c.id === s.cardId)!;
              return (
                <option key={s.id} value={s.id}>
                  {c.title.value ?? '?'} · {c.name.value ?? c.id} ·{' '}
                  {s.fields.type.value ?? '?'} {s.fields.rarity.value ?? '?'} ·{' '}
                  {s.awakening.kind}
                  {s.awakening.step === null
                    ? ''
                    : ` step ${s.awakening.step}`}{' '}
                  · Lv.{s.fields.level.value ?? '?'}/SA
                  {s.fields.superAttackLevel.value ?? '?'} ·{' '}
                  {s.region ?? 'region unknown'} · {s.id}
                </option>
              );
            })}
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
      </section>
      {!selected && (
        <p>
          Choose a character to see its supported progression and recommendation
          requirements.
        </p>
      )}
      {resolution && !resolution.ok && (
        <section aria-label="Build recommendation">
          <h2>Cannot recommend yet</h2>
          <p>
            {local.some((d) => d.definition.id === selected)
              ? 'This user definition has no reviewed potential-template mapping or character-aware evaluator. Recorded text/custom totals are retained in maintenance and do not establish attainable allocations.'
              : resolution.reason}
          </p>
          <a href={`${import.meta.env.BASE_URL}?workbench=definitions`}>
            Open character maintenance
          </a>
        </section>
      )}
      {resolution?.ok && (
        <CharacterSearch
          key={`${selected}:${nonce}`}
          entry={resolution.entry}
          progressions={progressions}
          registry={registry}
          pending={pending}
          onOpen={(e, r) => select(e.stateId, r)}
        />
      )}
      <details>
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
          One admitted source state is currently bundled. This is not complete
          coverage; unsupported characters are kept in catalog/maintenance
          rather than silently assigned an evaluator. No new provider dataset is
          imported.
        </p>
        <a href={`${import.meta.env.BASE_URL}?workbench=catalog`}>
          Browse factual details and completeness
        </a>
      </details>
    </main>
  );
}
