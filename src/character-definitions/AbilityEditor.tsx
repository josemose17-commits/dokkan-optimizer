import {
  ABILITIES,
  FAMILIES,
  PHASES,
  newEffect,
  type Ability,
  type Effect,
  type SnapshotContext,
} from './domain';
import { inspectEffect } from './evaluation';
import ConditionEditor from './ConditionEditor';
import { NumberField, SourceFields } from './fields';

export const newId = () => `user:${crypto.randomUUID()}`;
function EffectEditor({
  value,
  onChange,
  context,
}: {
  value: Effect;
  onChange: (value: Effect) => void;
  context: SnapshotContext;
}) {
  const support = inspectEffect(value, context);
  return (
    <div className="definition-effect">
      <div className="definition-grid">
        <label>
          Effect label
          <input
            aria-label="Effect label"
            value={value.label}
            onChange={(e) => onChange({ ...value, label: e.target.value })}
          />
        </label>
        <label>
          Effect template
          <select
            aria-label="Effect template"
            value={value.family}
            onChange={(e) => {
              const family = e.target.value as Effect['family'];
              onChange({
                ...value,
                family,
                unit:
                  family === 'flat-stat'
                    ? 'flat'
                    : family === 'percent-stat'
                      ? 'percent'
                      : 'unknown',
                representation:
                  family === 'other' ? 'recorded-only' : 'structured',
              });
            }}
          >
            {FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f === 'flat-stat'
                  ? 'Flat stat addition · implemented snapshot arithmetic'
                  : `${f} · recorded, calculation unavailable`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="definition-support">
        Recorded ✓ · Structured {support.structured ? '✓' : '—'} · Calculation
        implemented {support.implemented ? '✓' : '—'} · Selected context{' '}
        {support.supported
          ? support.condition.state === 'unmet'
            ? 'supported; condition unmet'
            : 'supported'
          : 'unsupported / incomplete'}
      </p>
      <div className="definition-grid three">
        <label>
          Recipient
          <select
            aria-label="Recipient"
            value={value.target}
            onChange={(e) =>
              onChange({ ...value, target: e.target.value as Effect['target'] })
            }
          >
            <option value="self">Self</option>
            <option value="allies-including-self">Allies including self</option>
            <option value="other-allies">Other allies</option>
            <option value="enemy">Enemy</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Stat (if applicable)
          <select
            aria-label="Stat (if applicable)"
            value={value.stat ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                stat: (e.target.value || null) as Effect['stat'],
              })
            }
          >
            <option value="">Unknown / not applicable</option>
            <option value="hp">HP</option>
            <option value="attack">ATK</option>
            <option value="defense">DEF</option>
          </select>
        </label>
        <NumberField
          label="Amount (blank = unknown)"
          value={value.amount}
          min={value.unit === 'probability' ? 0 : -Number.MAX_SAFE_INTEGER}
          max={value.unit === 'probability' ? 100 : Number.MAX_SAFE_INTEGER}
          integer={!['percent', 'probability'].includes(value.unit)}
          onChange={(n) => onChange({ ...value, amount: n })}
        />
        <label>
          Amount unit
          <select
            aria-label="Amount unit"
            value={value.unit}
            onChange={(e) =>
              onChange({ ...value, unit: e.target.value as Effect['unit'] })
            }
          >
            {['flat', 'percent', 'probability', 'count', 'unknown'].map((u) => (
              <option key={u} value={u}>
                {u === 'probability'
                  ? 'probability (% 0–100, recorded only)'
                  : u === 'percent'
                    ? 'percent (%, recorded only)'
                    : u}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Original wording / interpretation
        <textarea
          aria-label="Original wording / interpretation"
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </label>
      <ConditionEditor
        value={value.condition}
        onChange={(condition) => onChange({ ...value, condition })}
      />
      <details>
        <summary>Timing, duration and advanced details</summary>
        <div className="definition-grid three">
          <label>
            Timing
            <select
              aria-label="Timing"
              value={value.timing}
              onChange={(e) =>
                onChange({
                  ...value,
                  timing: e.target.value as Effect['timing'],
                })
              }
            >
              {PHASES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Duration
            <select
              aria-label="Duration"
              value={value.duration.kind}
              onChange={(e) =>
                onChange({
                  ...value,
                  duration: {
                    kind: e.target.value as Effect['duration']['kind'],
                    count: ['turns', 'appearances'].includes(e.target.value)
                      ? (value.duration.count ?? 1)
                      : null,
                  },
                })
              }
            >
              {['snapshot', 'turns', 'appearances', 'permanent', 'other'].map(
                (p) => (
                  <option key={p}>{p}</option>
                ),
              )}
            </select>
          </label>
          {['turns', 'appearances'].includes(value.duration.kind) && (
            <NumberField
              label="Duration count"
              value={value.duration.count}
              min={1}
              onChange={(n) =>
                onChange({
                  ...value,
                  duration: { ...value.duration, count: n },
                })
              }
            />
          )}
          <label>
            Stacking
            <select
              aria-label="Stacking"
              value={value.stacking}
              onChange={(e) =>
                onChange({
                  ...value,
                  stacking: e.target.value as Effect['stacking'],
                })
              }
            >
              {['once', 'additive', 'multiplicative', 'unknown'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <NumberField
            label="Cap (blank = none)"
            value={value.cap}
            onChange={(n) => onChange({ ...value, cap: n })}
          />
          <label>
            Reset behavior
            <input
              aria-label="Reset behavior"
              value={value.reset}
              onChange={(e) => onChange({ ...value, reset: e.target.value })}
            />
          </label>
          <label>
            Dependency effect IDs (comma-separated)
            <input
              aria-label="Dependency effect IDs (comma-separated)"
              value={value.dependencies.join(', ')}
              onChange={(e) =>
                onChange({
                  ...value,
                  dependencies: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label>
            Representation
            <select
              aria-label="Representation"
              value={value.representation}
              onChange={(e) =>
                onChange({
                  ...value,
                  representation: e.target.value as Effect['representation'],
                })
              }
            >
              <option value="structured">Structured</option>
              <option value="recorded-only">Recorded only</option>
            </select>
          </label>
        </div>
        <SourceFields
          value={value.source}
          onChange={(source) => onChange({ ...value, source })}
        />
        <p className="definition-muted">
          Only one-time self flat additions with snapshot duration are
          calculated. Other durations, stacking, caps, reset and dependencies
          remain recorded.
        </p>
      </details>
      <p className="definition-summary">
        Preview: {value.label} → {value.target}, {value.amount ?? 'unknown'}{' '}
        {value.unit} {value.stat ?? 'effect'}; {value.timing},{' '}
        {value.duration.kind}; activation {support.condition.state}.
      </p>
      {support.reasons.length > 0 && (
        <ul>
          {support.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
export default function AbilityEditor({
  value,
  onChange,
  context,
}: {
  value: Ability[];
  onChange: (value: Ability[]) => void;
  context: SnapshotContext;
}) {
  const update = (i: number, ability: Ability) =>
    onChange(value.map((a, j) => (j === i ? ability : a)));
  return (
    <section>
      <h2>Abilities</h2>
      <p>
        Record any kit. Choose a structured template when its interpretation is
        understood. Recording an ability does not enable its calculation.
      </p>
      {value.map((a, i) => (
        <details
          key={a.id}
          className="definition-card"
          open={i === value.length - 1}
        >
          <summary>
            {a.name} · {a.kind} · {a.effects.length} effect records
          </summary>
          <div className="definition-grid">
            <label>
              Ability name
              <input
                aria-label="Ability name"
                value={a.name}
                onChange={(e) => update(i, { ...a, name: e.target.value })}
              />
            </label>
            <label>
              Ability category
              <select
                aria-label="Ability category"
                value={a.kind}
                onChange={(e) =>
                  update(i, { ...a, kind: e.target.value as Ability['kind'] })
                }
              >
                {ABILITIES.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Original ability wording / source notes
            <textarea
              aria-label="Original ability wording / source notes"
              value={a.wording}
              onChange={(e) => update(i, { ...a, wording: e.target.value })}
            />
          </label>
          <div className="definition-actions">
            <button
              type="button"
              disabled={i === 0}
              onClick={() => {
                const next = [...value];
                [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                onChange(next);
              }}
            >
              Move ability up
            </button>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              Remove ability
            </button>
          </div>
          {a.effects.length === 0 && (
            <p className="definition-notice">
              Recorded only. Modeled stat results remain unavailable until its
              impact is structured or the record is explicitly removed.
            </p>
          )}
          {a.effects.map((effect, ei) => (
            <details
              key={effect.id}
              className="definition-card"
              open={ei === a.effects.length - 1}
            >
              <summary>{effect.label}</summary>
              <EffectEditor
                value={effect}
                context={context}
                onChange={(next) =>
                  update(i, {
                    ...a,
                    effects: a.effects.map((x, j) => (j === ei ? next : x)),
                  })
                }
              />
              <div className="definition-actions">
                <button
                  type="button"
                  onClick={() =>
                    update(i, {
                      ...a,
                      effects: [
                        ...a.effects,
                        {
                          ...structuredClone(effect),
                          id: newId(),
                          label: `${effect.label} (copy)`,
                        },
                      ],
                    })
                  }
                >
                  Duplicate effect
                </button>
                <button
                  type="button"
                  disabled={ei === 0}
                  onClick={() => {
                    const next = [...a.effects];
                    [next[ei - 1], next[ei]] = [next[ei]!, next[ei - 1]!];
                    update(i, { ...a, effects: next });
                  }}
                >
                  Move effect up
                </button>
                <button
                  type="button"
                  onClick={() =>
                    update(i, {
                      ...a,
                      effects: a.effects.filter((_, j) => j !== ei),
                    })
                  }
                >
                  Remove effect
                </button>
              </div>
            </details>
          ))}
          <button
            type="button"
            disabled={value.reduce((n, x) => n + x.effects.length, 0) >= 120}
            onClick={() =>
              update(i, { ...a, effects: [...a.effects, newEffect(newId())] })
            }
          >
            Add effect
          </button>
        </details>
      ))}
      <button
        type="button"
        disabled={value.length >= 60}
        onClick={() =>
          onChange([
            ...value,
            {
              id: newId(),
              name: 'New ability',
              kind: 'passive',
              wording: '',
              effects: [],
            },
          ])
        }
      >
        Add ability
      </button>
    </section>
  );
}
