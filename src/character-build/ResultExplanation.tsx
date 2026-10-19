import type { RefObject } from 'react';
import {
  METRIC_LABELS as labels,
  type EvaluatorEntry,
  type MetricKey,
  type ProbabilityStep,
  type Skill,
} from './domain';
import { itemLabel, type Explanation } from './explanation';
import { formatDeltaInfo, formatPercent } from './format';

const STAT_LABELS = { hp: 'HP', attack: 'ATK', defense: 'DEF' } as const;
const SKILL_LABELS: Record<Skill, string> = {
  additional: 'Additional Attack',
  critical: 'Critical Hit',
  evasion: 'Evasion',
};
const EVIDENCE_STATUS = {
  documented: 'Source-documented · not independently corroborated',
  'independently-corroborated': 'Independently corroborated',
  unresolved: 'Unresolved',
} as const;
const list = (metrics: MetricKey[]) =>
  metrics.map((m) => labels[m]).join(', ') || 'none';
const number = (n: number) => n.toLocaleString('en-US');

function formula(step: {
  factors: ProbabilityStep['factors'];
  value: number;
  note: string;
}) {
  if (!step.factors.length)
    return `${formatPercent(step.value)} (${step.note})`;
  return `${step.factors
    .map((f) =>
      f.kind === 'level'
        ? `${f.value} (${f.label})`
        : `${formatPercent(f.value)} (${f.label})`,
    )
    .join(' × ')} = ${formatPercent(step.value)}`;
}

// Renders a computed Explanation. All numbers and relations come from it.
export default function ResultExplanation({
  explanation: x,
  entry,
  headingRef,
}: {
  explanation: Explanation;
  entry: EvaluatorEntry;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const proposed = x.configuration.slots
    .filter((s) => s.proposed !== null)
    .map((s) => itemLabel(entry, s.proposed));
  const changedSlots = x.configuration.slots.filter((s) => s.changed);
  const needs = Object.entries(x.configuration.missingInventory)
    .map(([id, n]) => `${n} × ${itemLabel(entry, id)}`)
    .join('; ');
  const changedChoices = x.configuration.choices.filter((c) => c.changed);
  const o = x.objective;
  const relation =
    o.relation === 'above'
      ? 'better than the current build on this objective'
      : o.relation === 'below'
        ? 'worse than the current build on this objective'
        : 'equal to the current build on this objective (a tie)';
  const f = x.frontier;
  const scope = f.truncated
    ? ` Only the ${f.evaluated} evaluated targets were compared; the search was truncated.`
    : '';
  const omitted = f.omittedMetrics.length
    ? ` ${list(f.omittedMetrics)} excluded: unavailable for at least one result.`
    : '';
  const frontierText =
    f.status === 'unavailable'
      ? f.reason
      : f.status === 'on'
        ? `On the frontier for ${list(f.metricsUsed)}: neither the current build nor any other evaluated result is at least as good on all of these and better on one.${omitted}${scope}`
        : `Off the frontier: ${
            f.dominatedBy?.kind === 'group'
              ? `#${f.dominatedBy.rank} (${f.dominatedBy.label})`
              : 'the current build'
          } is at least as good on every selected metric (${list(f.metricsUsed)}) and better on ${list(f.betterOn)}.${omitted}${scope}`;
  const statRows = [
    ...new Set(x.stats.flatMap((s) => s.parts.map((p) => p.label))),
  ];
  const skillRows = [
    ...new Set(x.skills.flatMap((s) => s.parts.map((p) => p.label))),
  ];
  return (
    <section
      className="cb-card cb-explanation"
      id="result-explanation"
      aria-labelledby="explanation-title"
    >
      <p className="cb-eyebrow">05 / WHY THIS RESULT</p>
      <h2 id="explanation-title" tabIndex={-1} ref={headingRef}>
        Explanation for #{o.rank}: {proposed.join(' / ') || 'no equips'}
      </h2>
      <ul className="cb-explain-summary">
        <li>
          <strong>Proposed vs current:</strong>{' '}
          {changedSlots.length || changedChoices.length
            ? [
                ...changedSlots.map(
                  (s) =>
                    `${s.slot}: ${itemLabel(entry, s.current)} → ${itemLabel(entry, s.proposed)}`,
                ),
                ...changedChoices.map(
                  (c) =>
                    `${c.nodeId}: ${c.current ? SKILL_LABELS[c.current] : 'none'} → ${SKILL_LABELS[c.proposed]}`,
                ),
              ].join('; ')
            : 'same equips and choices as the current build'}
          .
          {x.configuration.equivalentConfigurations > 1 &&
            ` ${x.configuration.equivalentConfigurations} compatible configurations give these exact results; this explanation follows configuration ${x.alternativeIndex + 1}.`}
          {Object.keys(x.configuration.missingInventory).length > 0 &&
            (x.configuration.mode === 'catalog'
              ? ` Ownership is ignored in this comparison; with your inventory it would need ${needs}.`
              : ` Needs ${needs} beyond your unequipped inventory.`)}
        </li>
        <li>
          <strong>Objective ({labels[o.metric]}):</strong>{' '}
          {o.delta.unit === 'pp' ? formatPercent(o.value) : number(o.value)} vs{' '}
          {o.delta.unit === 'pp'
            ? formatPercent(o.baseline)
            : number(o.baseline)}{' '}
          for the current build: {formatDeltaInfo(o.delta)}, {relation}. Rank #
          {o.rank} of {o.distinctResults} distinct results
          {o.tiedGroups > 1 &&
            `, tied with ${o.tiedGroups - 1} other result${o.tiedGroups === 2 ? '' : 's'}`}
          .
        </li>
        <li>
          <strong>Pareto frontier:</strong> {frontierText}
        </li>
        {x.unavailable.length > 0 && (
          <li>
            <strong>Not evaluated:</strong>{' '}
            {list(x.unavailable.map((u) => u.metric))} — unavailable, never
            zero.
          </li>
        )}
      </ul>

      <details>
        <summary>Stat additions by source</summary>
        <div className="cb-explain-table">
          <table>
            <caption>
              Card stats are summed from these sources; no combat multipliers.
            </caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                {x.stats.map((s) => (
                  <th scope="col" key={s.key}>
                    {STAT_LABELS[s.key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statRows.map((row) => (
                <tr key={row}>
                  <th scope="row">{row}</th>
                  {x.stats.map((s) => {
                    const part = s.parts.find((p) => p.label === row);
                    return (
                      <td key={s.key}>
                        {part ? `+${number(part.value)}` : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row">Total (this result)</th>
                {x.stats.map((s) => (
                  <td key={s.key}>{number(s.total)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Current build</th>
                {x.stats.map((s) => (
                  <td key={s.key}>{number(s.baseline)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Change</th>
                {x.stats.map((s) => (
                  <td key={s.key}>{formatDeltaInfo(s.delta)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <details>
        <summary>Skill levels and probability calculations</summary>
        <div className="cb-explain-table">
          <table>
            <caption>Hidden Potential skill levels by source.</caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                {x.skills.map((s) => (
                  <th scope="col" key={s.key}>
                    {SKILL_LABELS[s.key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {skillRows.map((row) => (
                <tr key={row}>
                  <th scope="row">{row}</th>
                  {x.skills.map((s) => {
                    const part = s.parts.find((p) => p.label === row);
                    return <td key={s.key}>{part ? `+${part.value}` : '—'}</td>;
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row">Total levels (this result)</th>
                {x.skills.map((s) => (
                  <td key={s.key}>{s.total}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Current build</th>
                {x.skills.map((s) => (
                  <td key={s.key}>{s.baseline}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="cb-explain-steps">
          {x.probabilities.map((p) => (
            <li key={p.metric}>
              <strong>{labels[p.metric]}:</strong> {formula(p)}
              <br />
              <span className="cb-muted">
                Current build{' '}
                {p.baseline === null
                  ? 'unavailable'
                  : formatPercent(p.baseline)}
                {p.delta &&
                  (Math.abs(p.delta.absolute) < 1e-10
                    ? ' · no change'
                    : ` · change ${formatDeltaInfo(p.delta)}`)}
                . {p.note}
              </span>
            </li>
          ))}
        </ul>
        <p className="cb-muted">
          Percentage points (pp) are the difference between two chances;
          relative change divides that difference by the current chance and is
          undefined when the current chance is 0%.
        </p>
      </details>

      <details>
        <summary>Assumptions, evidence and model version</summary>
        <p>
          Context <strong>{x.model.contextLabel}</strong> (
          {x.model.contextAssumptions.join('; ')}; evasion{' '}
          {x.model.evasionAllowed ? 'allowed' : 'disabled'}).
        </p>
        <ul className="cb-explain-evidence">
          {x.evidence.map((e) =>
            'missing' in e ? (
              <li key={e.id}>
                <strong>{e.id}</strong> · evidence record missing
              </li>
            ) : (
              <li key={e.id}>
                <strong>{e.field}</strong> ·{' '}
                <span className="cb-pill">{EVIDENCE_STATUS[e.status]}</span>
                <br />
                {e.statement}
                <br />
                <span className="cb-muted">{e.limitation}</span>
                {e.sources.length > 0 && (
                  <>
                    <br />
                    {e.sources.map((source, i) => (
                      <span key={source.url}>
                        {i > 0 && ' · '}
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.label}
                        </a>
                      </span>
                    ))}
                  </>
                )}
              </li>
            ),
          )}
        </ul>
        <p>
          <strong>Mathematical test coverage:</strong> {x.model.verification}
        </p>
        <p className="cb-muted">
          Data revision {x.model.dataRevision} · evaluator {x.model.entryId} (
          {x.model.evaluatorLabel}; implementation {x.model.evaluatorId} v
          {x.model.evaluatorVersion}) · state {x.model.stateId}.
        </p>
      </details>

      <details>
        <summary>Unavailable metrics and unsupported effects</summary>
        <ul>
          {x.unavailable.map((u) => (
            <li key={u.metric}>
              <strong>{labels[u.metric]}:</strong> {u.reason}
            </li>
          ))}
          {entry.model.card.excludedMechanics.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
        <p className="cb-muted">
          Unsupported effects are excluded from every number above; they are not
          assumed to help or hurt.
        </p>
      </details>
    </section>
  );
}
