import { CONTEXT_FIELDS, OPERATORS, type Condition } from './domain';
import { NumberField } from './fields';

const initial = (kind: Condition['kind']): Condition =>
  kind === 'always'
    ? { kind }
    : kind === 'all' || kind === 'any'
      ? { kind, children: [{ kind: 'always' }] }
      : kind === 'threshold'
        ? { kind, field: 'hpPercent', operator: '>=', value: 50 }
        : kind === 'ally'
          ? {
              kind,
              scope: 'team',
              includeSelf: false,
              match: 'category',
              value: '',
              minimum: 1,
            }
          : kind === 'state'
            ? { kind, value: '' }
            : { kind: 'other', description: '' };
export default function ConditionEditor({
  value,
  onChange,
  depth = 0,
}: {
  value: Condition;
  onChange: (value: Condition) => void;
  depth?: number;
}) {
  return (
    <fieldset className="definition-condition">
      <legend>Activation condition{depth ? ` · depth ${depth}` : ''}</legend>
      <label>
        Condition type
        <select
          aria-label={`Condition type at depth ${depth}`}
          value={value.kind}
          onChange={(e) =>
            onChange(initial(e.target.value as Condition['kind']))
          }
        >
          <option value="always">Unconditional</option>
          <option value="threshold">Numeric threshold</option>
          <option value="ally">Matching ally count</option>
          <option value="state">Explicit form/state</option>
          <option value="other">Other / not modeled</option>
          <option value="all" disabled={depth >= 5}>
            All conditions (AND)
          </option>
          <option value="any" disabled={depth >= 5}>
            Any condition (OR)
          </option>
        </select>
      </label>
      {value.kind === 'threshold' && (
        <div className="definition-grid three">
          <label>
            Quantity
            <select
              aria-label="Quantity"
              value={value.field}
              onChange={(e) => {
                const field = e.target.value as keyof typeof CONTEXT_FIELDS;
                onChange({ ...value, field, value: CONTEXT_FIELDS[field].min });
              }}
            >
              {Object.entries(CONTEXT_FIELDS).map(([key, spec]) => (
                <option key={key} value={key}>
                  {spec.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Comparison
            <select
              aria-label="Comparison"
              value={value.operator}
              onChange={(e) =>
                onChange({
                  ...value,
                  operator: e.target.value as typeof value.operator,
                })
              }
            >
              {OPERATORS.map((op) => (
                <option key={op}>{op}</option>
              ))}
            </select>
          </label>
          <NumberField
            label="Threshold"
            value={value.value}
            min={CONTEXT_FIELDS[value.field].min}
            max={CONTEXT_FIELDS[value.field].max}
            integer={CONTEXT_FIELDS[value.field].integer}
            onChange={(n) =>
              onChange({
                ...value,
                value: n ?? CONTEXT_FIELDS[value.field].min,
              })
            }
          />
        </div>
      )}
      {value.kind === 'ally' && (
        <div className="definition-grid">
          <label>
            Where
            <select
              aria-label="Where"
              value={value.scope}
              onChange={(e) =>
                onChange({
                  ...value,
                  scope: e.target.value as typeof value.scope,
                })
              }
            >
              <option value="team">On team</option>
              <option value="rotation">On current rotation</option>
            </select>
          </label>
          <label>
            Who counts
            <select
              aria-label="Who counts"
              value={String(value.includeSelf)}
              onChange={(e) =>
                onChange({ ...value, includeSelf: e.target.value === 'true' })
              }
            >
              <option value="false">Other allies only</option>
              <option value="true">Self included</option>
            </select>
          </label>
          <label>
            Match by
            <select
              aria-label="Match by"
              value={value.match}
              onChange={(e) =>
                onChange({
                  ...value,
                  match: e.target.value as typeof value.match,
                })
              }
            >
              <option value="category">Category</option>
              <option value="name">Exact name</option>
              <option value="type">Type</option>
            </select>
          </label>
          <label>
            Required value
            <input
              aria-label="Required value"
              value={value.value}
              onChange={(e) => onChange({ ...value, value: e.target.value })}
            />
          </label>
          <NumberField
            label="Minimum matching count"
            value={value.minimum}
            onChange={(n) => onChange({ ...value, minimum: n ?? 0 })}
          />
        </div>
      )}
      {value.kind === 'state' && (
        <label>
          Required form/state label
          <input
            aria-label="Required form/state label"
            value={value.value}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
          />
        </label>
      )}
      {value.kind === 'other' && (
        <label>
          Exact condition wording
          <textarea
            aria-label="Exact condition wording"
            value={value.description}
            onChange={(e) =>
              onChange({ ...value, description: e.target.value })
            }
          />
        </label>
      )}
      {(value.kind === 'all' || value.kind === 'any') && (
        <>
          <p className="definition-muted">
            {value.kind === 'all'
              ? 'Every child must be met.'
              : 'At least one child must be met.'}{' '}
            Unknown context stays unknown.
          </p>
          {value.children.map((child, i) => (
            <div key={i}>
              <ConditionEditor
                value={child}
                depth={depth + 1}
                onChange={(c) =>
                  onChange({
                    ...value,
                    children: value.children.map((v, j) => (j === i ? c : v)),
                  })
                }
              />
              <button
                type="button"
                disabled={value.children.length <= 1}
                onClick={() =>
                  onChange({
                    ...value,
                    children: value.children.filter((_, j) => j !== i),
                  })
                }
              >
                Remove condition {i + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={value.children.length >= 12 || depth >= 5}
            onClick={() =>
              onChange({
                ...value,
                children: [...value.children, { kind: 'always' }],
              })
            }
          >
            Add child condition
          </button>
        </>
      )}
    </fieldset>
  );
}
