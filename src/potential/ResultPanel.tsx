import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  KIT_MECHANICS,
  KIT_MECHANIC_LABELS,
  METRIC_LABELS,
  SLOTS,
  type BuildRequest,
  type EvaluatorEntry,
} from '../character-build/domain';
import {
  explainGroup,
  itemLabel,
  sourceBreakdown,
} from '../character-build/explanation';
import { formatMetric } from '../character-build/format';
import type { SearchOutcome, SearchProgress } from '../character-build/search';
import ResultExplanation from '../character-build/ResultExplanation';
import { SkillTable, StatLine } from './BuildTable';
import type { ObjectiveCapability } from './capabilities';
import type { DirectRecommendation } from './recommendation';
import {
  SCOPE_LABELS,
  SLOT_NAMES,
  changeList,
  improvementText,
  whyLines,
} from './result';
import StatusBadge from './StatusBadge';

export interface Answer {
  value: DirectRecommendation;
  outcome: SearchOutcome | null;
  request: BuildRequest;
}

const STOP_TEXT: Record<SearchOutcome['stop'], string> = {
  complete: 'every combination was checked',
  'candidate-limit': 'the evaluation limit was reached',
  'scan-limit': 'the combination limit was reached',
  cancelled: 'the search was cancelled',
  error: 'the search could not run',
};

function Alternatives({
  outcome,
  request,
  entry,
  rankOne,
}: {
  outcome: SearchOutcome;
  request: BuildRequest;
  entry: EvaluatorEntry;
  rankOne: boolean;
}) {
  const [count, setCount] = useState(20);
  const groups = outcome.comparison.groups.filter((g) =>
    rankOne ? g.rank === 1 : g.rank !== 1 && g.frontier,
  );
  const rows = groups.flatMap((group) =>
    group.alternatives.map((alternative) => ({ group, alternative })),
  );
  const metrics = outcome.comparison.frontier.metricsUsed;
  if (!rows.length)
    return (
      <p>
        {rankOne
          ? 'No other configuration reaches the best value.'
          : 'No other configuration is better on some metric without being worse on another.'}
      </p>
    );
  return (
    <>
      {!rankOne && (
        <p>
          These builds are not beaten on every one of{' '}
          {metrics.map((m) => METRIC_LABELS[m]).join(', ')}: each is better on
          at least one, so choosing between them depends on what matters more.
        </p>
      )}
      <ul className="po-alternatives">
        {rows.slice(0, count).map(({ group, alternative }, i) => (
          <li key={i}>
            <strong>
              {METRIC_LABELS[request.objective]}{' '}
              {formatMetric(group.evaluation.metrics[request.objective])}
            </strong>
            {' · '}
            {alternative.isCurrent
              ? 'your current build'
              : changeList(alternative.build, request.current, entry).join(
                  '; ',
                )}
            {!rankOne && (
              <span className="po-muted">
                {' '}
                (
                {metrics
                  .filter((m) => m !== request.objective)
                  .map(
                    (m) =>
                      `${METRIC_LABELS[m]} ${formatMetric(group.evaluation.metrics[m])}`,
                  )
                  .join(' · ')}
                )
              </span>
            )}
          </li>
        ))}
      </ul>
      {count < rows.length && (
        <button
          type="button"
          className="cb-secondary"
          onClick={() => setCount((n) => n + 20)}
        >
          Show 20 more
        </button>
      )}
    </>
  );
}

function Placeholder({ ready }: { ready: boolean }) {
  return (
    <div className="po-placeholder">
      <p className="po-eyebrow">4 · Result</p>
      <h2>Your recommendation appears here.</h2>
      <p>
        {ready
          ? 'Press Optimize when the current build and goal are set.'
          : 'Set the current build and choose an objective, then press Optimize.'}
      </p>
    </div>
  );
}

export default function ResultPanel({
  answer,
  entry,
  objective,
  running,
  progress,
  ready,
  resultRef,
}: {
  answer: Answer | null;
  entry: EvaluatorEntry;
  objective: ObjectiveCapability | null;
  running: boolean;
  progress: SearchProgress;
  ready: boolean;
  resultRef: RefObject<HTMLHeadingElement | null>;
}) {
  const traceHeading = useRef<HTMLHeadingElement>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  useEffect(() => setTraceOpen(false), [answer]);
  if (running)
    return (
      <div className="po-placeholder" aria-busy="true">
        <p className="po-eyebrow">4 · Result</p>
        <h2>Optimizing…</h2>
        <p role="status">
          {progress.scanned.toLocaleString('en-US')} combinations checked ·{' '}
          {progress.evaluated.toLocaleString('en-US')} evaluated
        </p>
      </div>
    );
  if (!answer) return <Placeholder ready={ready} />;
  const { value, outcome, request } = answer;
  const selected = value.selected;
  const group = selected?.group;
  const alternative =
    group && selected ? group.alternatives[selected.alternativeIndex] : null;
  const comparison =
    outcome && group?.id === 'current-baseline'
      ? { ...outcome.comparison, groups: [group, ...outcome.comparison.groups] }
      : outcome?.comparison;
  const explanation =
    comparison && group && selected
      ? explainGroup(
          comparison,
          request,
          entry,
          group.id,
          selected.alternativeIndex,
        )
      : null;
  const breakdown = group ? sourceBreakdown(group.evaluation) : null;
  const metric = group?.evaluation.metrics[request.objective];
  const baseline = outcome?.comparison.current?.metrics[request.objective];
  const changes =
    alternative && changeList(alternative.build, request.current, entry);
  const needs = alternative
    ? Object.entries(alternative.missingInventory).map(
        ([id, n]) => `${n} × ${itemLabel(entry, id)}`,
      )
    : [];
  const present = KIT_MECHANICS.filter(
    (m) => entry.model.kit[m].status !== 'absent',
  );
  return (
    <section className="po-result" aria-labelledby="po-result-title">
      <p className="po-eyebrow">
        4 · Result · {SCOPE_LABELS[value.scope]}
        {objective && <StatusBadge status={objective.status} />}
      </p>
      <h2 id="po-result-title" tabIndex={-1} ref={resultRef}>
        {value.title}
      </h2>
      {!selected ? (
        <>
          <ul className="po-reasons">
            {value.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p>
            Change the goal or the current build, then optimize again. Nothing
            was ranked, so no build is suggested.
          </p>
        </>
      ) : (
        group &&
        alternative &&
        breakdown &&
        metric &&
        explanation && (
          <>
            {baseline?.value != null && metric.value !== null && (
              <p className="po-improvement">
                <span>{METRIC_LABELS[request.objective]}</span>
                <strong>
                  {improvementText(baseline.value, metric.value, metric.unit)}
                </strong>
              </p>
            )}
            {value.status === 'current-best' && value.tiedAlternatives > 1 && (
              <p>
                {value.tiedAlternatives - 1} other configuration
                {value.tiedAlternatives === 2 ? ' reaches' : 's reach'} the same
                value.
              </p>
            )}
            {value.status === 'ties' && (
              <p>
                {value.tiedAlternatives} configurations tie. Your current build
                is not among them; the one shown needs the fewest changes.
              </p>
            )}
            {value.status === 'best-found' && (
              <p className="po-warning">
                The search stopped early because {STOP_TEXT[value.search.stop]}.
                This is the best of the{' '}
                {value.search.evaluated.toLocaleString('en-US')} builds
                evaluated, not a proven best.
              </p>
            )}
            {objective?.status === 'experimental' && (
              <p className="po-muted">
                Experimental source-model comparison: {objective.basis}
              </p>
            )}
            <div className="po-result-grid">
              <div>
                <h3>Recommended build</h3>
                <SkillTable
                  breakdown={breakdown}
                  caption="Skill levels by source"
                />
                {Object.keys(alternative.build.choices).length > 0 && (
                  <p>
                    Choices:{' '}
                    {Object.entries(alternative.build.choices)
                      .map(([id, skill]) => `${id}: ${skill}`)
                      .join(' · ')}
                  </p>
                )}
                <StatLine breakdown={breakdown} />
              </div>
              <div>
                <h3>Equipment</h3>
                <dl className="po-equipment">
                  {SLOTS.map((slot) => (
                    <div key={slot}>
                      <dt>{SLOT_NAMES[slot]}</dt>
                      <dd>
                        {itemLabel(entry, alternative.build.equips[slot])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <h3>Changes</h3>
            <ul className="po-changes">
              {changes!.length ? (
                changes!.map((c) => <li key={c}>{c}</li>)
              ) : (
                <li>No changes: keep your current build.</li>
              )}
            </ul>
            {needs.length > 0 && (
              <p className="po-muted">
                {request.mode === 'catalog'
                  ? `Ownership was ignored. You would need ${needs.join('; ')}.`
                  : `Needs ${needs.join('; ')} beyond your spare items.`}{' '}
                Changes may cost resources; costs are not modeled.
              </p>
            )}
            <h3>Why</h3>
            {whyLines(explanation).map((line) => (
              <p key={line} className="po-why">
                {line}
              </p>
            ))}
            <details>
              <summary>Ties and alternatives</summary>
              {outcome && (
                <Alternatives
                  outcome={outcome}
                  request={request}
                  entry={entry}
                  rankOne
                />
              )}
            </details>
            <details>
              <summary>Tradeoffs</summary>
              {outcome && (
                <Alternatives
                  outcome={outcome}
                  request={request}
                  entry={entry}
                  rankOne={false}
                />
              )}
            </details>
            <details onToggle={(e) => setTraceOpen(e.currentTarget.open)}>
              <summary>Formula trace and evidence</summary>
              {traceOpen && (
                <ResultExplanation
                  explanation={explanation}
                  entry={entry}
                  headingRef={traceHeading}
                />
              )}
            </details>
            <details>
              <summary>Assumptions and omitted effects</summary>
              <ul>
                {entry.contexts
                  .find((c) => c.id === request.context.id)
                  ?.assumptions.map((a) => (
                    <li key={a}>{a}.</li>
                  ))}
                <li>
                  Incoming attacks are{' '}
                  {request.context.evasionAllowed
                    ? 'assumed evadable'
                    : 'assumed unevadable (evasion fixed at 0%)'}
                  .
                </li>
                {present.map((m) => (
                  <li key={m}>
                    {KIT_MECHANIC_LABELS[m]} ({entry.model.kit[m].status}):{' '}
                    {entry.model.kit[m].note}
                  </li>
                ))}
                {entry.recommendationSupport?.[request.objective]?.excludes.map(
                  (e) => (
                    <li key={e}>Not calculated: {e}.</li>
                  ),
                )}
                <li>
                  Equipment changes and respecs may cost resources; costs are
                  not modeled.
                </li>
              </ul>
            </details>
            <details>
              <summary>Search completeness</summary>
              <p>
                {value.search.scanned.toLocaleString('en-US')} combinations
                checked · {value.search.rejected.toLocaleString('en-US')} did
                not meet requirements ·{' '}
                {value.search.evaluated.toLocaleString('en-US')} evaluated ·{' '}
                {outcome?.comparison.search.unique.toLocaleString('en-US')}{' '}
                distinct results. Stopped because {STOP_TEXT[value.search.stop]}
                .{' '}
                {value.search.complete
                  ? 'Complete for this character, profile, context and the recorded equipment.'
                  : 'Incomplete: a better build may exist, and the total number of combinations is unknown.'}
              </p>
            </details>
          </>
        )
      )}
    </section>
  );
}
