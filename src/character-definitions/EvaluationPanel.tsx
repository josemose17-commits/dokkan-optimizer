import { useState } from 'react';
import { STATS, type DefinitionDocument } from './domain';
import {
  CAPABILITIES,
  COMPARISON_METRICS,
  compareDefinitions,
  configurationChanges,
  metricValue,
  type ComparisonMetric,
  type ConditionTrace,
} from './evaluation';
import { formatDeltaInfo } from '../character-build/format';

const label = (metric: ComparisonMetric) =>
  `${metric.startsWith('preEffect') ? 'Pre-effect subtotal' : 'Modeled snapshot'} ${metric.endsWith('attack') ? 'ATK' : metric.endsWith('defense') ? 'DEF' : 'HP'}`;
const number = (value: number | null) =>
  value === null ? 'Unavailable' : value.toLocaleString('en-US');
function ConditionDetails({ value }: { value: ConditionTrace }) {
  return (
    <li>
      {value.state}: {value.reason}
      {value.children.length > 0 && (
        <ul>
          {value.children.map((c, i) => (
            <ConditionDetails key={i} value={c} />
          ))}
        </ul>
      )}
    </li>
  );
}
export default function EvaluationPanel({
  document: doc,
}: {
  document: DefinitionDocument;
}) {
  const [metrics, setMetrics] = useState<ComparisonMetric[]>([
    'preEffect.hp',
    'preEffect.attack',
    'preEffect.defense',
  ]);
  const [limit, setLimit] = useState(30);
  const compared = compareDefinitions(doc, metrics, limit);
  const baselineBuild = doc.configurations.find(
    (c) => c.id === doc.baselineId,
  )!;
  return (
    <section className="definition-results" aria-label="Definition comparison">
      <h2>Compare configured values</h2>
      <p className="definition-notice">
        <strong>
          Authored arithmetic model, not a verified combat evaluator.
        </strong>{' '}
        No damage, survival, full-turn probability or overall-strength ranking.
        An ATK subtotal is not a damage objective.
      </p>
      <p>
        Evaluating the current editor snapshot; it may include unsaved edits.
        Comparison never writes a revision.
      </p>
      <p>{CAPABILITIES['flat-stat'].description}</p>
      <p>
        Pre-effect subtotal = raw + entered Hidden Potential additions +
        compatible flat equipment. Modeled snapshot = that subtotal + supported
        active flat self effects, each once. Unknown values or unresolved stat
        effects produce Unavailable. No rounding or game modifier stages are
        assumed.
      </p>
      <fieldset>
        <legend>
          Comparison objective: inspect these higher-is-better subtotals
        </legend>
        <div className="definition-grid">
          {COMPARISON_METRICS.map((m) => (
            <label key={m}>
              <input
                type="checkbox"
                checked={metrics.includes(m)}
                onChange={(e) =>
                  setMetrics(
                    e.target.checked
                      ? [...metrics, m]
                      : metrics.filter((x) => x !== m),
                  )
                }
              />
              {label(m)}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Maximum configurations compared
        <select
          aria-label="Maximum configurations compared"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          {[1, 5, 10, 30].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <p role="status">
        {compared.search.compared} of {compared.search.available} saved/draft
        configurations compared.{' '}
        {compared.search.truncated
          ? 'Search truncated; frontier applies only to the compared subset plus current baseline.'
          : 'No truncation.'}{' '}
        No allocation or equipment search was performed. No globally optimal
        build is claimed.
      </p>
      <p>
        Frontier metrics common to every compared build and baseline:{' '}
        {compared.common.map(label).join(', ') || 'none; dominance unavailable'}
        .{' '}
        {compared.omitted.length > 0 &&
          `Omitted because unavailable: ${compared.omitted.map(label).join(', ')}.`}{' '}
        Equal results remain tied and retain all configuration names.
      </p>
      <h3>Current: {baselineBuild.name}</h3>
      <p>
        {STATS.map(
          (s) =>
            `${s}: raw ${number(compared.baseline.layers.raw[s])}, potential ${number(compared.baseline.layers.potential[s])}, equipment ${number(compared.baseline.layers.equipment[s])}`,
        ).join(' · ')}
      </p>
      {compared.groups.map((group, gi) => (
        <article className="definition-card" key={gi}>
          <h3>
            {group.alternatives.map((b) => b.name).join(' = ')}
            {group.alternatives.some((b) => b.id === doc.baselineId)
              ? ' · includes current'
              : ''}
          </h3>
          {group.alternatives.map((b) => (
            <div key={b.id}>
              <strong>{b.name}: changes from current</strong>
              <ul>
                {configurationChanges(b, baselineBuild, doc.equipment).map(
                  (change) => (
                    <li key={change}>{change}</li>
                  ),
                )}
              </ul>
            </div>
          ))}
          <p>
            {compared.common.length
              ? group.frontier
                ? 'Non-dominated on the listed metrics among compared configurations.'
                : 'Dominated on the listed metrics by a compared configuration or current baseline.'
              : 'Frontier unavailable.'}
          </p>
          <dl className="definition-metrics">
            {COMPARISON_METRICS.map((m) => (
              <div key={m}>
                <dt>{label(m)}</dt>
                <dd>
                  {number(metricValue(group.evaluation, m))}
                  <small>
                    {group.deltas[m]
                      ? formatDeltaInfo({ ...group.deltas[m]!, unit: 'stat' })
                      : 'Delta unavailable'}{' '}
                    vs current
                  </small>
                </dd>
              </div>
            ))}
          </dl>
          <p>
            Entered skill totals (no probability conversion): AA{' '}
            {number(group.evaluation.skills.additional)}, Crit{' '}
            {number(group.evaluation.skills.critical)}, Evasion{' '}
            {number(group.evaluation.skills.evasion)}.
          </p>
          {group.evaluation.equipmentProblems.length > 0 && (
            <ul className="definition-notice">
              {group.evaluation.equipmentProblems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}
          <details>
            <summary>Exact configuration differences and assumptions</summary>
            {group.alternatives.map((b) => (
              <div key={b.id}>
                <h4>{b.name}</h4>
                <p>Custom allocation — board compatibility not checked.</p>
                <pre>
                  {JSON.stringify(
                    {
                      potentialStats: b.potentialStats,
                      skills: b.skills,
                      slots: b.slots,
                      equips: b.equips,
                      unlockedRoutes: b.unlockedRoutes,
                      notes: b.notes,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            ))}
            <p>
              Same definition {doc.definition.id} revision{' '}
              {doc.definition.revision}, same manually specified context for
              every row:
            </p>
            <pre>{JSON.stringify(doc.context, null, 2)}</pre>
          </details>
          <details>
            <summary>Calculation trace and effect coverage</summary>
            <p>
              Trace follows {group.alternatives[0]!.name}, the first listed
              configuration in this equivalent-results group. All alternative
              choices remain listed above.
            </p>
            <ol>
              {group.evaluation.trace.map((t, i) => (
                <li key={i}>
                  {t.layer} · {t.label}: {t.stat} {number(t.value)}
                </li>
              ))}
            </ol>
            {group.evaluation.unstructuredAbilities.length > 0 && (
              <p className="definition-notice">
                Recorded abilities without effect interpretation:{' '}
                {group.evaluation.unstructuredAbilities.join(', ')}. Modeled
                snapshot totals unavailable.
              </p>
            )}
            <ul>
              {group.evaluation.effects.map((e) => (
                <li key={e.id}>
                  <strong>
                    {e.ability} / {e.name}
                  </strong>{' '}
                  — recorded;{' '}
                  {e.support.structured ? 'structured' : 'recorded only'};
                  calculation{' '}
                  {e.support.implemented ? 'implemented' : 'unavailable'};
                  context{' '}
                  {e.support.supported ? 'supported' : 'unsupported/incomplete'}
                  .{' '}
                  {e.support.condition.state === 'unmet'
                    ? 'Not activated.'
                    : e.support.supported
                      ? 'Included in modeled snapshot.'
                      : 'Excluded; affected modeled totals unavailable.'}
                  <ul>
                    <ConditionDetails value={e.support.condition} />
                    {e.support.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <p>Unavailable: {group.evaluation.unavailable.join('; ')}.</p>
            <p>
              Arithmetic tests check this implementation. They do not confirm
              Dokkan’s game behavior. Source labels are user assertions; no
              independent confirmation is granted by this editor.
            </p>
          </details>
        </article>
      ))}
    </section>
  );
}
