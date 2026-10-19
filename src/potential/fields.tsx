import { useId } from 'react';

// A required whole-number input. An empty or out-of-range entry is reported on
// the field itself and kept as NaN in the request, so it can never be saved or
// searched as a hidden value.
export function IntegerField({
  label,
  value,
  min,
  max,
  onChange,
  compact = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  const id = useId();
  const invalid = !Number.isSafeInteger(value) || value < min || value > max;
  return (
    <label className={compact ? 'po-field po-field-compact' : 'po-field'}>
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        step={1}
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ''}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? id : undefined}
        onChange={(e) =>
          onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))
        }
      />
      {invalid && (
        <small id={id} className="po-field-error">
          Enter a whole number from {min} to {max.toLocaleString('en-US')}.
        </small>
      )}
    </label>
  );
}
