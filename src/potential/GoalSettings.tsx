import { useState } from 'react';
import {
  METRIC_LABELS,
  type AvailableMetric,
  type BuildRequest,
  type Context,
  type EvaluatorEntry,
} from '../character-build/domain';
import { itemLabel } from '../character-build/explanation';
import type { Capabilities, ObjectiveCapability } from './capabilities';
import { IntegerField } from './fields';
import StatusBadge from './StatusBadge';

const GROUPS: {
  id: ObjectiveCapability['group'];
  title: string;
  note: string;
}[] = [
  {
    id: 'card-stats',
    title: 'Card stats',
    note: 'Documented stat additions. Not damage or survival.',
  },
  {
    id: 'skill-chances',
    title: 'Skill chances',
    note: 'Ranked by total skill levels; any convention where the chance rises with level picks the same winner. Percentages use an unresolved source model.',
  },
];

// Step 3: what to optimize for and which equipment may be used. Technical
// search limits stay under Advanced.
export default function GoalSettings({
  entry,
  request,
  capabilities,
  objectiveChosen,
  budget,
  estimate,
  onChange,
  onObjective,
  onBudget,
  onContext,
}: {
  entry: EvaluatorEntry;
  request: BuildRequest;
  capabilities: Capabilities;
  objectiveChosen: boolean;
  budget: number;
  estimate: string | null;
  onChange: (request: BuildRequest) => void;
  onObjective: (metric: AvailableMetric) => void;
  onBudget: (budget: number) => void;
  onContext: (context: Context) => void;
}) {
  const context = entry.contexts.find((c) => c.id === request.context.id);
  return (
    <section className="po-card" aria-labelledby="po-goal-title">
      <h2 id="po-goal-title">
        <span className="po-step">3</span> Goal
      </h2>
      {entry.sequence && (
        <fieldset className="po-group">
          <legend>Evaluation context</legend>
          <label className="po-field">
            Model
            <select
              aria-label="Evaluation model"
              value={request.context.id}
              onChange={(e) => {
                if (e.target.value === 'initial-check-v1')
                  onContext(entry.defaults().context);
                else
                  onContext({
                    id: 'event-sequence-v1',
                    modelRevision: entry.sequence!.model.revision,
                    scenarioId: entry.sequence!.scenarios[0]!.id,
                    evasionAllowed: request.context.evasionAllowed,
                  });
              }}
            >
              <option value="initial-check-v1">
                Initial eligible check (existing v1)
              </option>
              <option value="event-sequence-v1">
                Explicit event sequence v1 · experimental
              </option>
            </select>
          </label>
          {request.context.id === 'event-sequence-v1' && (
            <>
              <label className="po-field">
                Supplied sequence
                <select
                  aria-label="Supplied sequence"
                  value={request.context.scenarioId}
                  onChange={(e) => {
                    if (request.context.id === 'event-sequence-v1')
                      onContext({
                        ...request.context,
                        scenarioId: e.target.value,
                      });
                  }}
                >
                  {entry.sequence.scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="po-warning">
                Experimental event model. Enemy survival and incoming damage are
                supplied assumptions; damage and survival are unavailable.
              </p>
              <label className="po-check">
                <input
                  type="checkbox"
                  checked={request.context.evasionAllowed}
                  onChange={(e) =>
                    onContext({
                      ...request.context,
                      evasionAllowed: e.target.checked,
                    })
                  }
                />
                Incoming attacks are evadable in this sequence
              </label>
            </>
          )}
        </fieldset>
      )}
      <fieldset className="po-group po-objectives">
        <legend>Objective</legend>
        {GROUPS.map((group) => {
          const options = capabilities.objectives.filter(
            (o) => o.group === group.id,
          );
          if (!options.length) return null;
          const status = options.some((o) => o.status === 'supported')
            ? 'supported'
            : options.some((o) => o.status === 'experimental')
              ? 'experimental'
              : 'unavailable';
          return (
            <div key={group.id} className="po-objective-group">
              <p className="po-group-title">
                {group.title} <StatusBadge status={status} />
              </p>
              <p className="po-muted">{group.note}</p>
              {options.map((o) => (
                <label
                  key={o.metric}
                  className="po-objective"
                  data-status={o.status}
                >
                  <input
                    type="radio"
                    name="objective"
                    value={o.metric}
                    checked={objectiveChosen && request.objective === o.metric}
                    disabled={o.status === 'unavailable'}
                    onChange={() => onObjective(o.metric)}
                  />
                  <span>
                    <span className="po-objective-name">{o.label}</span>
                    <span className="po-objective-summary">{o.summary}</span>
                    {o.status === 'unavailable' && (
                      <span className="po-objective-reason">
                        Unavailable: {o.gates.map((g) => g.message).join(' ')}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          );
        })}
        {capabilities.objectives.some((o) => o.group === 'event-sequence') && (
          <div className="po-objective-group">
            <p className="po-group-title">
              Supplied event sequence <StatusBadge status="experimental" />
            </p>
            {capabilities.objectives
              .filter((o) => o.group === 'event-sequence')
              .map((o) => (
                <label
                  key={o.metric}
                  className="po-objective"
                  data-status={o.status}
                >
                  <input
                    type="radio"
                    name="objective"
                    value={o.metric}
                    checked={objectiveChosen && request.objective === o.metric}
                    disabled={o.status === 'unavailable'}
                    onChange={() => onObjective(o.metric)}
                  />
                  <span>
                    <span className="po-objective-name">{o.label}</span>
                    <span className="po-objective-summary">{o.summary}</span>
                    {o.gates.length > 0 && (
                      <span className="po-objective-reason">
                        {o.gates.map((g) => g.message).join(' ')}
                      </span>
                    )}
                  </span>
                </label>
              ))}
          </div>
        )}
        {capabilities.gaps.length > 0 && (
          <div className="po-objective-group po-gaps">
            <p className="po-group-title">
              Not available yet <StatusBadge status="unavailable" />
            </p>
            <ul>
              {capabilities.gaps.map((gap) => (
                <li key={gap.label}>
                  <strong>{gap.label}:</strong> {gap.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </fieldset>
      {objectiveChosen &&
        request.objective === 'evasion' &&
        context &&
        context.evasionOptions.length > 1 && (
          <label className="po-check po-context">
            <input
              type="checkbox"
              checked={request.context.evasionAllowed}
              onChange={(e) =>
                onChange({
                  ...request,
                  context: {
                    ...request.context,
                    evasionAllowed: e.target.checked,
                  },
                })
              }
            />
            The incoming attack can be evaded (when off, evasion is 0% for every
            build)
          </label>
        )}
      <fieldset className="po-group">
        <legend>Candidate equipment</legend>
        <div className="po-choice-row">
          <label className="po-radio">
            <input
              type="radio"
              name="candidate-mode"
              checked={request.mode === 'inventory'}
              onChange={() => onChange({ ...request, mode: 'inventory' })}
            />
            Use my equipment
          </label>
          <label className="po-radio">
            <input
              type="radio"
              name="candidate-mode"
              checked={request.mode === 'catalog'}
              onChange={() => onChange({ ...request, mode: 'catalog' })}
            />
            Best available in catalog
          </label>
        </div>
        {request.mode === 'catalog' ? (
          <p className="po-muted">
            Every recorded item that fits this character is considered;
            ownership is ignored and the result lists what you would need.
          </p>
        ) : (
          <Inventory entry={entry} request={request} onChange={onChange} />
        )}
      </fieldset>
      <details className="po-advanced">
        <summary>Advanced search settings</summary>
        <fieldset className="po-group">
          <legend>Tradeoff metrics</legend>
          <p className="po-muted">
            Alternatives are compared on these metrics to show tradeoffs; the
            objective alone decides the recommendation.
          </p>
          <div className="po-check-grid">
            {capabilities.objectives
              .map((o) => o.metric)
              .map((m) => (
                <label key={m} className="po-check">
                  <input
                    type="checkbox"
                    checked={request.frontierMetrics.includes(m)}
                    disabled={
                      capabilities.objectives.find((o) => o.metric === m)
                        ?.status === 'unavailable'
                    }
                    onChange={(e) =>
                      onChange({
                        ...request,
                        frontierMetrics: e.target.checked
                          ? [...request.frontierMetrics, m]
                          : request.frontierMetrics.filter((k) => k !== m),
                      })
                    }
                  />
                  {METRIC_LABELS[m]}
                </label>
              ))}
          </div>
        </fieldset>
        <div className="po-grid-2">
          <IntegerField
            label="Maximum evaluations"
            value={request.maxCandidates}
            min={1}
            max={20000}
            onChange={(n) => onChange({ ...request, maxCandidates: n })}
          />
          <IntegerField
            label="Maximum combinations checked"
            value={budget}
            min={1}
            max={1000000}
            onChange={onBudget}
          />
        </div>
        {estimate && <p className="po-muted">{estimate}</p>}
      </details>
    </section>
  );
}

// Spare (unequipped) copies, collapsed to a one-line summary by default.
function Inventory({
  entry,
  request,
  onChange,
}: {
  entry: EvaluatorEntry;
  request: BuildRequest;
  onChange: (request: BuildRequest) => void;
}) {
  const [filter, setFilter] = useState('');
  const spare = Object.entries(request.inventory).filter(
    ([, n]) => Number.isFinite(n) && n > 0,
  );
  const items = entry.model.orbs.filter((o) =>
    o.label.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  return (
    <div className="po-inventory">
      <p>
        {spare.length
          ? `Spare items: ${spare.map(([id, n]) => `${n} × ${itemLabel(entry, id)}`).join(', ')}.`
          : 'No spare items entered yet, so only your current equipment can be used.'}
      </p>
      <details>
        <summary>Edit spare items</summary>
        <p className="po-muted">
          Count unequipped copies only. Items equipped now can stay in their
          slot without a spare copy.
        </p>
        {entry.model.orbs.length > 8 && (
          <label className="po-field">
            <span>Filter items</span>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
        )}
        <ul className="po-inventory-list">
          {items.map((o) => (
            <li key={o.id}>
              <IntegerField
                compact
                label={`${o.label} spare copies`}
                value={request.inventory[o.id] ?? 0}
                min={0}
                max={999}
                onChange={(n) =>
                  onChange({
                    ...request,
                    inventory: { ...request.inventory, [o.id]: n },
                  })
                }
              />
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
