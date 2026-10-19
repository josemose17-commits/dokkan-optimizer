import {
  CONTEXT_FIELDS,
  PHASES,
  type DefinitionDocument,
  type SnapshotContext,
} from './domain';
import { requiredConditions } from './evaluation';
import { NumberField } from './fields';

export default function ContextEditor({
  document: doc,
  onChange,
}: {
  document: DefinitionDocument;
  onChange: (context: SnapshotContext) => void;
}) {
  const conditions = requiredConditions(doc),
    ctx = doc.context;
  const fields = [
    ...new Set(
      conditions.filter((c) => c.kind === 'threshold').map((c) => c.field),
    ),
  ];
  const allyConditions = [
    ...new Map(
      conditions
        .filter((c) => c.kind === 'ally')
        .map((c) => [
          JSON.stringify([c.scope, c.includeSelf, c.match, c.value]),
          c,
        ]),
    ).values(),
  ];
  return (
    <section>
      <h2>Explicit context</h2>
      <p>
        All inputs here are manually specified snapshot values. Conditions are
        derived from those values. No battle events, duration history or state
        transitions are simulated.
      </p>
      <label>
        Evaluation timing
        <select
          aria-label="Evaluation timing"
          value={ctx.phase}
          onChange={(e) =>
            onChange({
              ...ctx,
              phase: e.target.value as SnapshotContext['phase'],
            })
          }
        >
          {PHASES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <div className="definition-grid three">
        {fields.map((key) => {
          const spec = CONTEXT_FIELDS[key];
          return (
            <NumberField
              key={key}
              label={spec.label}
              value={ctx.values[key] ?? null}
              min={spec.min}
              max={spec.max}
              integer={spec.integer}
              onChange={(n) =>
                onChange({ ...ctx, values: { ...ctx.values, [key]: n } })
              }
            />
          );
        })}
      </div>
      {allyConditions.map((c) => {
        const matching = (a: SnapshotContext['allies'][number]) =>
          a.scope === c.scope &&
          a.includeSelf === c.includeSelf &&
          a.match === c.match &&
          a.value === c.value;
        const value = ctx.allies.find(matching)?.count ?? null;
        return (
          <NumberField
            key={JSON.stringify(c)}
            label={`${c.scope} · ${c.includeSelf ? 'self included' : 'other allies'} · ${c.match}: ${c.value}`}
            value={value}
            onChange={(count) =>
              onChange({
                ...ctx,
                allies: [
                  ...ctx.allies.filter((a) => !matching(a)),
                  {
                    scope: c.scope,
                    includeSelf: c.includeSelf,
                    match: c.match,
                    value: c.value,
                    count,
                  },
                ],
              })
            }
          />
        );
      })}
      {conditions.some((c) => c.kind === 'state') && (
        <label>
          Manually specified form/state label
          <input
            aria-label="Manually specified form/state label"
            value={ctx.state ?? ''}
            placeholder="Unknown"
            onChange={(e) =>
              onChange({ ...ctx, state: e.target.value || null })
            }
          />
        </label>
      )}
      {fields.length === 0 &&
        allyConditions.length === 0 &&
        !conditions.some((c) => c.kind === 'state') && (
          <p className="definition-muted">
            Add a structured condition to see its required context inputs here.
          </p>
        )}
    </section>
  );
}
