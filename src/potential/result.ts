import {
  METRIC_LABELS,
  SLOTS,
  type AvailableMetric,
  type Build,
  type EvaluatorEntry,
  type Metric,
  type Skill,
  type Slot,
} from '../character-build/domain';
import { itemLabel, type Explanation } from '../character-build/explanation';
import { formatFormula, formatPercent } from '../character-build/format';
import type { RecommendationScope } from './recommendation';

// Display helpers for the primary result. Every number comes from the
// evaluation, its calculation trace or the comparison; nothing is restated.

export const SKILL_NAMES: Record<Skill, string> = {
  additional: 'Additional Attack',
  critical: 'Critical Hit',
  evasion: 'Evasion',
};
export const SLOT_NAMES: Record<Slot, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
};
export const STAT_NAMES = { hp: 'HP', attack: 'ATK', defense: 'DEF' } as const;
export const SCOPE_LABELS: Record<RecommendationScope, string> = {
  'full-potential': 'Full allocation search',
  'selected-profile': 'Documented profile · equipment search',
  'custom-input': 'Your entered values · equipment search',
};

// The skill whose total level decides each skill-chance objective.
const OBJECTIVE_SKILL: Partial<Record<AvailableMetric, Skill>> = {
  additionalSuper: 'additional',
  critical: 'critical',
  evasion: 'evasion',
};

const number = (n: number) => n.toLocaleString('en-US');
export function formatValue(value: number, unit: Metric['unit']): string {
  return unit === 'probability' ? formatPercent(value) : number(value);
}

// "Baseline → recommendation (+change)" in the objective's own unit.
export function improvementText(
  baseline: number,
  value: number,
  unit: Metric['unit'],
): string {
  const delta = value - baseline;
  if (Math.abs(delta) < 1e-10) return `${formatValue(value, unit)} (no change)`;
  const sign = delta > 0 ? '+' : '−';
  const change =
    unit === 'probability'
      ? `${sign}${Math.abs(delta * 100).toFixed(1)} percentage points`
      : `${sign}${number(Math.abs(delta))}`;
  return `${formatValue(baseline, unit)} → ${formatValue(value, unit)} (${change})`;
}

// Specific differences from the current build, in the user's terms.
export function changeList(
  build: Build,
  current: Build,
  entry: EvaluatorEntry,
): string[] {
  const skill = (s: Skill | undefined) => (s ? SKILL_NAMES[s] : 'not chosen');
  return [
    ...Object.entries(build.choices)
      .filter(([id, s]) => current.choices[id] !== s)
      .map(
        ([id, s]) =>
          `Choice node ${id}: ${skill(current.choices[id])} → ${SKILL_NAMES[s]}`,
      ),
    ...SLOTS.filter((slot) => build.equips[slot] !== current.equips[slot]).map(
      (slot) =>
        `${SLOT_NAMES[slot]}: ${itemLabel(entry, current.equips[slot])} → ${itemLabel(entry, build.equips[slot])}`,
    ),
  ];
}

// Sum one explanation row's parts by where they come from.
function bySource(parts: { source: string; value: number }[]) {
  const total = (keep: (source: string) => boolean) =>
    parts.filter((p) => keep(p.source)).reduce((sum, p) => sum + p.value, 0);
  return {
    card: total((s) => s === 'card'),
    potential: total((s) => s !== 'card' && s !== 'equip'),
    equipment: total((s) => s === 'equip'),
  };
}

// Two or three short, calculation-backed sentences for the objective.
export function whyLines(x: Explanation): string[] {
  const metric = x.objective.metric;
  const skill = OBJECTIVE_SKILL[metric];
  if (!skill) {
    const key = metric as keyof typeof STAT_NAMES;
    const row = x.stats.find((s) => s.key === key)!;
    const s = bySource(row.parts);
    return [
      `${STAT_NAMES[key]} = ${number(s.card)} card + ${number(s.potential)} Hidden Potential + ${number(s.equipment)} equipment = ${number(row.total)}.`,
    ];
  }
  const levels = x.skills.find((s) => s.key === skill)!;
  const s = bySource(levels.parts);
  const lines = [
    `${SKILL_NAMES[skill]}: ${s.potential} from Hidden Potential + ${s.equipment} from equipment = ${levels.total} levels.`,
  ];
  const trigger = x.probabilities.find((p) => p.metric === 'additionalTrigger');
  const step = x.probabilities.find((p) => p.metric === metric)!;
  if (metric === 'additionalSuper' && trigger)
    lines.push(`Initial AA trigger = ${formatFormula(trigger)}.`);
  lines.push(`${METRIC_LABELS[metric]} = ${formatFormula(step)}.`);
  return lines;
}
