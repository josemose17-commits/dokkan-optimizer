import {
  METRIC_DIRECTION,
  METRIC_KEYS,
  SKILLS,
  SLOTS,
  type AvailableMetric,
  type BuildRequest,
  type ComparisonResult,
  type Evaluation,
  type EvaluatorEntry,
  type Evidence,
  type Metric,
  type MetricKey,
  type ProbabilityStep,
  type Skill,
  type Skills,
  type Slot,
  type Stats,
} from './domain';

// Structured explanations built only from computed results: a re-evaluation of
// the selected configuration (for its trace), the baseline evaluation and the
// comparison's ranks and dominance records. The UI formats this data; it does
// not write its own claims about results.

export interface DeltaInfo {
  absolute: number;
  // Probability differences are percentage points, never percent change.
  unit: 'pp' | 'stat';
  // Relative change; null when the baseline is zero (undefined, not infinite).
  relative: number | null;
}

export function deltaInfo(
  value: number,
  baseline: number,
  unit: Metric['unit'],
): DeltaInfo {
  const absolute = value - baseline;
  return {
    absolute,
    unit: unit === 'probability' ? 'pp' : 'stat',
    relative: baseline === 0 ? null : absolute / baseline,
  };
}

type StatKey = 'hp' | 'attack' | 'defense';
interface Part {
  label: string;
  source: string;
  value: number;
  evidenceIds: string[];
}

export interface Explanation {
  groupId: string;
  alternativeIndex: number;
  isCurrent: boolean;
  configuration: {
    slots: {
      slot: Slot;
      current: string | null;
      proposed: string | null;
      changed: boolean;
    }[];
    choices: {
      nodeId: string;
      current: Skill | null;
      proposed: Skill;
      changed: boolean;
    }[];
    changes: string[];
    missingInventory: Record<string, number>;
    // In catalog mode ownership is ignored; missing items are informational.
    mode: BuildRequest['mode'];
    equivalentConfigurations: number;
  };
  stats: {
    key: StatKey;
    parts: Part[];
    total: number;
    baseline: number;
    delta: DeltaInfo;
  }[];
  skills: { key: Skill; parts: Part[]; total: number; baseline: number }[];
  probabilities: {
    metric: MetricKey;
    factors: ProbabilityStep['factors'];
    value: number;
    baseline: number | null;
    delta: DeltaInfo | null;
    note: string;
    evidenceIds: string[];
  }[];
  objective: {
    metric: AvailableMetric;
    value: number;
    baseline: number;
    delta: DeltaInfo;
    relation: 'above' | 'tie' | 'below';
    rank: number;
    tiedGroups: number;
    distinctResults: number;
  };
  frontier: {
    status: 'on' | 'off' | 'unavailable';
    metricsUsed: MetricKey[];
    omittedMetrics: MetricKey[];
    reason: string;
    dominatedBy:
      | null
      | { kind: 'baseline' }
      | { kind: 'group'; id: string; rank: number; label: string };
    betterOn: MetricKey[];
    truncated: boolean;
    evaluated: number;
  };
  unavailable: { metric: MetricKey; reason: string }[];
  evidence: (Evidence | { id: string; missing: true })[];
  model: {
    entryId: string;
    stateId: string;
    evaluatorId: string;
    evaluatorVersion: string;
    evaluatorLabel: string;
    verification: string;
    dataRevision: string;
    contextId: string;
    contextLabel: string;
    contextAssumptions: string[];
    evasionAllowed: boolean;
  };
}

// Totals split by source, summed from the same trace records the explanation
// shows: fixed potential skills (a documented profile or the user's entered
// levels), selected choice nodes, equipment, and the final totals.
export interface SourceBreakdown {
  skills: { fixed: Skills; chosen: Skills; equipment: Skills; total: Skills };
  stats: { card: Stats; potential: Stats; equipment: Stats; total: Stats };
}
const zeroSkills = (): Skills => ({ additional: 0, critical: 0, evasion: 0 });
const zeroStats = (): Stats => ({ hp: 0, attack: 0, defense: 0 });
export function sourceBreakdown(evaluation: Evaluation): SourceBreakdown {
  const skills = {
    fixed: zeroSkills(),
    chosen: zeroSkills(),
    equipment: zeroSkills(),
    total: { ...evaluation.skills },
  };
  for (const c of evaluation.trace.skills) {
    const bucket =
      c.source === 'equip'
        ? skills.equipment
        : c.source === 'node'
          ? skills.chosen
          : skills.fixed;
    for (const key of SKILLS) bucket[key] += c.values[key] ?? 0;
  }
  const stats = {
    card: zeroStats(),
    potential: zeroStats(),
    equipment: zeroStats(),
    total: { ...evaluation.stats },
  };
  for (const c of evaluation.trace.stats) {
    const bucket =
      c.source === 'card'
        ? stats.card
        : c.source === 'equip'
          ? stats.equipment
          : stats.potential;
    for (const key of ['hp', 'attack', 'defense'] as const)
      bucket[key] += c.values[key] ?? 0;
  }
  return { skills, stats };
}

export const itemLabel = (entry: EvaluatorEntry, id: string | null) =>
  id === null
    ? 'Empty'
    : (entry.model.orbs.find((o) => o.id === id)?.label ??
      `Unknown item (${id})`);

const sameMetrics = (a: Evaluation, b: Evaluation) =>
  METRIC_KEYS.every((k) => a.metrics[k].value === b.metrics[k].value);

export function explainGroup(
  result: ComparisonResult,
  request: BuildRequest,
  entry: EvaluatorEntry,
  groupId: string,
  alternativeIndex?: number,
): Explanation | null {
  const index = result.groups.findIndex((g) => g.id === groupId);
  const group = result.groups[index];
  const baseline = result.current;
  if (!group || !baseline) return null;
  const chosen =
    alternativeIndex ??
    Math.max(
      0,
      group.alternatives.findIndex((a) => a.isCurrent),
    );
  const alternative = group.alternatives[chosen];
  if (!alternative) return null;
  // Re-evaluate the exact configuration shown so its trace matches it; an
  // equivalent alternative can reach the same metrics from other sources.
  const evaluation = entry.evaluator.evaluate(
    alternative.build,
    request,
    entry,
  );
  if (!sameMetrics(evaluation, group.evaluation))
    throw new Error('Alternative does not reproduce its group evaluation.');

  const current = request.current;
  const configuration: Explanation['configuration'] = {
    slots: SLOTS.map((slot) => ({
      slot,
      current: current.equips[slot],
      proposed: alternative.build.equips[slot],
      changed: current.equips[slot] !== alternative.build.equips[slot],
    })),
    choices: Object.entries(alternative.build.choices).map(
      ([nodeId, proposed]) => ({
        nodeId,
        current: current.choices[nodeId] ?? null,
        proposed,
        changed: current.choices[nodeId] !== proposed,
      }),
    ),
    changes: alternative.changes,
    missingInventory: alternative.missingInventory,
    mode: request.mode,
    equivalentConfigurations: group.alternatives.length,
  };

  const parts = (
    contributions: Evaluation['trace']['stats' | 'skills'],
    key: string,
  ): Part[] =>
    contributions
      .filter((c) => ((c.values as Record<string, number>)[key] ?? 0) !== 0)
      .map((c) => ({
        label: c.label,
        source: c.source,
        value: (c.values as Record<string, number>)[key]!,
        evidenceIds: c.evidenceIds,
      }));
  const stats = (['hp', 'attack', 'defense'] as const).map((key) => ({
    key,
    parts: parts(evaluation.trace.stats, key),
    total: evaluation.stats[key],
    baseline: baseline.stats[key],
    delta: deltaInfo(evaluation.stats[key], baseline.stats[key], 'stat'),
  }));
  const skills = SKILLS.map((key) => ({
    key,
    parts: parts(evaluation.trace.skills, key),
    total: evaluation.skills[key],
    baseline: baseline.skills[key],
  }));
  const probabilities = evaluation.trace.probabilities.map((step) => {
    const before = baseline.metrics[step.metric].value;
    return {
      metric: step.metric,
      factors: step.factors,
      value: step.value,
      baseline: before,
      delta:
        before === null ? null : deltaInfo(step.value, before, 'probability'),
      note: step.note,
      evidenceIds: step.evidenceIds,
    };
  });

  const metric = request.objective;
  const value = evaluation.metrics[metric].value!;
  const before = baseline.metrics[metric].value!;
  const higher = METRIC_DIRECTION[metric] === 'higher';
  const relation =
    value === before
      ? 'tie'
      : value > before === higher
        ? ('above' as const)
        : ('below' as const);

  const dominator = group.dominatedBy;
  const dominatingGroup =
    dominator?.kind === 'group'
      ? result.groups.find((g) => g.id === dominator.id)
      : undefined;
  const representative = dominatingGroup
    ? (dominatingGroup.alternatives.find((a) => a.isCurrent) ??
      dominatingGroup.alternatives[0]!)
    : null;

  const unavailable = METRIC_KEYS.filter(
    (k) => evaluation.metrics[k].value === null,
  ).map((k) => ({ metric: k, reason: evaluation.metrics[k].reason }));

  // Evidence in first-use order: contributions, probability rules, metrics.
  const ids = [
    ...evaluation.trace.stats.flatMap((c) => c.evidenceIds),
    ...evaluation.trace.skills.flatMap((c) => c.evidenceIds),
    ...evaluation.trace.probabilities.flatMap((p) => p.evidenceIds),
    ...METRIC_KEYS.flatMap((k) => evaluation.metrics[k].evidenceIds),
  ];
  const evidence = [...new Set(ids)].map(
    (id) =>
      entry.model.evidence.find((e) => e.id === id) ?? {
        id,
        missing: true as const,
      },
  );

  const context = entry.contexts.find((c) => c.id === request.context.id)!;
  return {
    groupId,
    alternativeIndex: chosen,
    isCurrent: alternative.isCurrent,
    configuration,
    stats,
    skills,
    probabilities,
    objective: {
      metric,
      value,
      baseline: before,
      delta: deltaInfo(value, before, evaluation.metrics[metric].unit),
      relation,
      rank: group.rank,
      tiedGroups: result.groups.filter(
        (g) => g.evaluation.metrics[metric].value === value,
      ).length,
      distinctResults: result.groups.length,
    },
    frontier: {
      status: !result.frontier.comparable
        ? 'unavailable'
        : group.frontier
          ? 'on'
          : 'off',
      metricsUsed: result.frontier.metricsUsed,
      omittedMetrics: result.frontier.omittedMetrics,
      reason: result.frontier.reason,
      dominatedBy:
        dominator === null
          ? null
          : dominator.kind === 'baseline'
            ? { kind: 'baseline' }
            : {
                kind: 'group',
                id: dominator.id,
                rank: dominatingGroup!.rank,
                label: SLOTS.map((slot) =>
                  itemLabel(entry, representative!.build.equips[slot]),
                ).join(' / '),
              },
      betterOn: group.dominatedOn,
      truncated: result.search.truncated,
      evaluated: result.search.evaluated,
    },
    unavailable,
    evidence,
    model: {
      entryId: entry.id,
      stateId: entry.stateId,
      evaluatorId: entry.evaluator.id,
      evaluatorVersion: entry.evaluator.version,
      evaluatorLabel: entry.evaluator.label,
      verification: entry.evaluator.verification,
      dataRevision: entry.model.revision,
      contextId: context.id,
      contextLabel: context.label,
      contextAssumptions: context.assumptions,
      evasionAllowed: request.context.evasionAllowed,
    },
  };
}
