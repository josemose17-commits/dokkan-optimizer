import { useMemo, useState } from 'react';
import { METRIC_LABELS } from '../character-build/domain';
import type { MechanicsRecord } from '../character-build/mechanics/registry';
import {
  allEffects,
  type SequenceMetric,
  type SequenceResult,
} from '../character-build/mechanics/domain';
import { evaluateSequence } from '../character-build/mechanics/evaluation';
import {
  excludedFor,
  inspectSequenceEffect,
  sequenceObjectiveGates,
} from '../character-build/mechanics/support';
import SequenceTrace from './SequenceTrace';

export default function CharacterMechanics({
  record,
}: {
  record: MechanicsRecord;
}) {
  const [scenarioIndex, setScenario] = useState(0);
  const [metric, setMetric] = useState<SequenceMetric | ''>('');
  const [evadable, setEvadable] = useState(true);
  const [answer, setAnswer] = useState<SequenceResult | null>(null);
  const selected = record.scenarios[scenarioIndex]!;
  const capabilities = useMemo(
    () =>
      selected.objectives.map((key) => ({
        key,
        gates: sequenceObjectiveGates(record.model, selected.scenario, key),
      })),
    [record, selected],
  );
  const gates = capabilities.find((c) => c.key === metric)?.gates ?? [];
  const effects = allEffects(record.model);
  return (
    <details
      className="po-card po-mechanics"
      aria-label="Character event mechanics"
    >
      <summary>Character event mechanics · support and timing</summary>
      <p className="po-muted">
        Native-effect preview, separate from build recommendations. No potential
        board, equipment ownership, damage or survival result is inferred.
      </p>
      {record.scenarios.length > 1 ? (
        <label className="po-field">
          Preview scenario
          <select
            value={scenarioIndex}
            onChange={(e) => {
              setScenario(Number(e.target.value));
              setMetric('');
              setAnswer(null);
            }}
          >
            {record.scenarios.map((s, i) => (
              <option key={s.scenario.id} value={i}>
                {s.scenario.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p>
          <strong>{selected.scenario.label}</strong>
        </p>
      )}
      <ul className="po-mechanic-gates">
        {capabilities.map((c) => (
          <li key={c.key}>
            <strong>
              {METRIC_LABELS[c.key]}:{' '}
              {c.gates.length
                ? 'Unavailable'
                : 'Experimental context available'}
            </strong>
            {c.gates.length > 0 && (
              <details>
                <summary>Required evidence</summary>
                <ul>
                  {c.gates.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
      <label className="po-field">
        Preview metric
        <select
          aria-label="Preview metric"
          value={metric}
          onChange={(e) => {
            setMetric(e.target.value as SequenceMetric | '');
            setAnswer(null);
          }}
        >
          <option value="">Choose a metric</option>
          {capabilities.map((c) => (
            <option key={c.key} value={c.key} disabled={!!c.gates.length}>
              {METRIC_LABELS[c.key]}
              {c.gates.length ? ' · unavailable' : ''}
            </option>
          ))}
        </select>
      </label>
      {selected.scenario.actions.some((a) => a.kind === 'incoming') && (
        <label className="po-check">
          <input
            type="checkbox"
            checked={evadable}
            onChange={(e) => {
              setEvadable(e.target.checked);
              setAnswer(null);
            }}
          />
          Incoming attack is evadable in this preview
        </label>
      )}
      <button
        className="cb-secondary"
        disabled={!metric || !!gates.length}
        onClick={() => {
          if (!metric || gates.length) return;
          setAnswer(
            evaluateSequence(
              record.model,
              {
                schemaVersion: 1,
                modelRevision: record.model.revision,
                scenario: selected.scenario,
                skills: { additional: 0, critical: 0, evasion: 0 },
                evasionAllowed: evadable,
                maxBranches: 1024,
                maxEvents: 20000,
              },
              [metric],
            ),
          );
        }}
      >
        Evaluate native event
      </button>
      {answer && (
        <div className="po-mechanic-answer" role="status">
          {answer.status === 'evaluated' && metric ? (
            <p>
              {METRIC_LABELS[metric]}:{' '}
              <strong>{answer.metrics[metric]?.toLocaleString('en-US')}</strong>{' '}
              · declared native-only context.
            </p>
          ) : (
            <ul>
              {answer.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {answer?.status === 'evaluated' && (
        <SequenceTrace
          sequence={{
            modelId: record.model.id,
            modelRevision: record.model.revision,
            scenario: selected.scenario.label,
            assumptions: [
              ...record.model.assumptions,
              ...selected.scenario.assumptions,
            ],
            result: answer,
          }}
        />
      )}
      <details>
        <summary>
          Recorded / structured / implemented / supported context
        </summary>
        <div className="po-sequence-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Effect</th>
                <th scope="col">Recorded</th>
                <th scope="col">Structured</th>
                <th scope="col">Implementation</th>
                <th scope="col">This metric/context</th>
              </tr>
            </thead>
            <tbody>
              {effects.map((e) => {
                const support = inspectSequenceEffect(
                  e,
                  record.model.rules.find((r) => r.effectId === e.id),
                );
                const c = record.model.coverage.find(
                  (c) => c.effectId === e.id,
                );
                const excluded = c && excludedFor(c, selected.scenario);
                return (
                  <tr key={e.id}>
                    <th scope="row">
                      {e.label}
                      <br />
                      <code>{e.id}</code>
                    </th>
                    <td>Yes</td>
                    <td>{support.structured ? 'Yes' : 'No'}</td>
                    <td>{support.implemented ? 'Available' : 'Not bound'}</td>
                    <td>
                      {!metric
                        ? 'Choose a metric'
                        : excluded
                          ? `Excluded: ${c?.exclusion?.reason}`
                          : !c?.affects.includes(metric)
                            ? 'Outside this metric'
                            : support.supported && !gates.length
                              ? 'Supported if triggered'
                              : 'Blocked'}
                      <ul>
                        {support.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
      <details>
        <summary>Evidence and model limits</summary>
        <ul>
          {record.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <ul>
          {record.model.evidence.map((e) => (
            <li key={e.id}>
              <a href={e.reference} target="_blank" rel="noreferrer">
                {e.id}
              </a>{' '}
              · reviewed {e.reviewedAt}; source revision{' '}
              {e.sourceRevision ?? 'not captured'}; independent confirmation{' '}
              {e.independentConfirmation ?? 'none'}. {e.note}
            </li>
          ))}
        </ul>
      </details>
    </details>
  );
}
