import { describe, expect, it } from 'vitest';
import type { Metric } from './domain';
import { formatDelta, formatDeltaInfo, formatMetric } from './format';
import { deltaInfo } from './explanation';

const metric = (value: number | null, unit: Metric['unit']): Metric => ({
  value,
  unit,
  evidenceIds: [],
  reason: 'test',
});

describe('metric and delta presentation (hand-written expected strings)', () => {
  it('formats probabilities in percent and unknown values as unavailable', () => {
    expect(formatMetric(metric(0.05, 'probability'))).toBe('5.0%');
    expect(formatMetric(metric(13911, 'stat'))).toBe('13,911');
    expect(formatMetric(metric(null, 'damage'))).toBe('Unavailable');
    expect(formatMetric(metric(0.5, 'ratio'))).toBe('50.0%');
  });
  it('labels probability differences as percentage points plus relative change', () => {
    // 5% → 7%: +2 percentage points, which is +40% relative to 5%.
    expect(formatDelta(0.07 - 0.05, metric(0.05, 'probability'))).toBe(
      '+2.0 pp (+40.0% rel.)',
    );
  });
  it('reports stat deltas with percentage change', () => {
    // 500 / 13,911 = 3.594...%
    expect(formatDelta(500, metric(13911, 'stat'))).toBe('+500 (+3.59%)');
    expect(formatDelta(-500, metric(14411, 'stat'))).toBe('−500 (−3.47%)');
  });
  it('never divides by a zero baseline', () => {
    expect(formatDelta(0.04, metric(0, 'probability'))).toBe(
      '+4.0 pp (rel. n/a: 0% baseline)',
    );
    expect(formatDelta(500, metric(0, 'stat'))).toBe(
      '+500 (% n/a: 0 baseline)',
    );
  });
  it('distinguishes no change from unavailable', () => {
    expect(formatDelta(0, metric(0.05, 'probability'))).toBe('No change');
    expect(formatDelta(null, metric(0.05, 'probability'))).toBe('Unavailable');
    expect(formatDelta(1, metric(null, 'damage'))).toBe('Unavailable');
  });
});

describe('structured deltas used by explanations (hand-written expectations)', () => {
  it('reports percentage points and relative change separately', () => {
    // 5% → 7%
    expect(deltaInfo(0.07, 0.05, 'probability')).toEqual({
      absolute: 0.07 - 0.05,
      unit: 'pp',
      relative: (0.07 - 0.05) / 0.05,
    });
    expect(formatDeltaInfo(deltaInfo(0.07, 0.05, 'probability'))).toBe(
      '+2.0 percentage points (+40.0% relative change)',
    );
  });
  it('leaves relative change undefined against a zero baseline', () => {
    const info = deltaInfo(0.04, 0, 'probability');
    expect(info.relative).toBeNull();
    expect(formatDeltaInfo(info)).toBe(
      '+4.0 percentage points (relative change undefined: zero baseline)',
    );
  });
  it('formats stat changes with two-decimal relative change', () => {
    expect(formatDeltaInfo(deltaInfo(14411, 13911, 'stat'))).toBe(
      '+500 (+3.59% relative change)',
    );
    expect(formatDeltaInfo(deltaInfo(13911, 13911, 'stat'))).toBe('no change');
  });
});
