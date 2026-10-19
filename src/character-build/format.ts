import type { Metric } from './domain';

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
