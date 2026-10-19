import { useId } from 'react';
import { STATS, type SourceNote, type Values } from './domain';

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  integer = true,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  integer?: boolean;
}) {
  const id = useId();
  const invalid =
    value !== null &&
    (!Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isSafeInteger(value)));
  return (
    <label className="definition-field">
      {label}
      <input
        aria-label={label}
        type="number"
        step={integer ? 1 : 'any'}
        min={min}
        max={max}
        value={value === null || !Number.isFinite(value) ? '' : value}
        placeholder="Unknown"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? id : undefined}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }
      />
      {invalid && (
        <small id={id} role="alert">
          Enter {integer ? 'an integer' : 'a number'} between {min} and {max},
          or leave unknown.
        </small>
      )}
    </label>
  );
}
export function StatFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Values;
  onChange: (value: Values) => void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="definition-grid three">
        {STATS.map((stat) => (
          <NumberField
            key={stat}
            label={`${label} ${stat === 'attack' ? 'ATK' : stat === 'defense' ? 'DEF' : 'HP'}`}
            value={value[stat]}
            onChange={(n) => onChange({ ...value, [stat]: n })}
          />
        ))}
      </div>
    </fieldset>
  );
}
export function SourceFields({
  value,
  onChange,
}: {
  value: SourceNote;
  onChange: (value: SourceNote) => void;
}) {
  return (
    <div className="definition-grid">
      <label>
        Evidence label
        <select
          aria-label="Evidence label"
          value={value.status}
          onChange={(e) =>
            onChange({
              ...value,
              status: e.target.value as SourceNote['status'],
            })
          }
        >
          <option value="user-entered">User-entered assertion</option>
          <option value="source-documented">
            Source-documented (reference required)
          </option>
        </select>
      </label>
      <label>
        Reference / locator
        <input
          aria-label="Reference / locator"
          value={value.reference}
          onChange={(e) => onChange({ ...value, reference: e.target.value })}
        />
      </label>
      <label>
        Source/interpretation notes
        <textarea
          aria-label="Source/interpretation notes"
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </label>
      <p className="definition-muted">
        This is your evidence label, not an independent confirmation by this
        app.
      </p>
    </div>
  );
}
