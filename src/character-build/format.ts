import type { Metric, ProbabilityStep } from './domain';

// Presentation of evaluated metrics. Probabilities are shown in percent;
// their absolute differences are percentage points (pp), not percent change.
export function formatMetric(metric: Metric): string {
  return metric.value === null
    ? 'Unavailable'
    : metric.unit === 'probability'
      ? `${(metric.value * 100).toFixed(1)}%`
      : metric.value.toLocaleString('en-US');
}

export function formatDelta(value: number | null, baseline: Metric): string {
  if (value === null || baseline.value === null) return 'Unavailable';
  if (Math.abs(value) < 1e-10) return 'No change';
  const sign = value > 0 ? '+' : '−';
  // Relative change is undefined against a zero baseline; say so explicitly.
  const relative = (digits: number) =>
    `${sign}${Math.abs((value / baseline.value!) * 100).toFixed(digits)}%`;
  if (baseline.unit === 'probability')
    return `${sign}${Math.abs(value * 100).toFixed(1)} pp (${
      baseline.value === 0 ? 'rel. n/a: 0% baseline' : `${relative(1)} rel.`
    })`;
  return `${sign}${Math.abs(value).toLocaleString('en-US')} (${
    baseline.value === 0 ? '% n/a: 0 baseline' : relative(2)
  })`;
}

export const formatPercent = (p: number, digits = 1) =>
  `${(p * 100).toFixed(digits)}%`;

// Text for a structured delta: percentage points for probabilities, absolute
// change for stats, and an explicit statement when relative change is undefined.
export function formatDeltaInfo(info: {
  absolute: number;
  unit: 'pp' | 'stat';
  relative: number | null;
}): string {
  if (Math.abs(info.absolute) < 1e-10) return 'no change';
  const sign = info.absolute > 0 ? '+' : '−';
  const absolute =
    info.unit === 'pp'
      ? `${sign}${Math.abs(info.absolute * 100).toFixed(1)} percentage points`
      : `${sign}${Math.abs(info.absolute).toLocaleString('en-US')}`;
  const relative =
    info.relative === null
      ? 'relative change undefined: zero baseline'
      : `${sign}${Math.abs(info.relative * 100).toFixed(info.unit === 'pp' ? 1 : 2)}% relative change`;
  return `${absolute} (${relative})`;
}

// A probability step as written arithmetic: "2 (Critical Hit levels) × 2.0%
// (chance per level) = 4.0%". A context-fixed value shows its note instead.
export function formatFormula(step: {
  factors: ProbabilityStep['factors'];
  value: number;
  note: string;
}): string {
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
