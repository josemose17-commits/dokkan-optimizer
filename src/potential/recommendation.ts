import {
  METRIC_DIRECTION,
  METRIC_LABELS,
  type BuildRequest,
  type BuildGroup,
  type EvaluatorEntry,
  type MetricKey,
} from '../character-build/domain';
import { buildKey } from '../character-build/generation';
import type { SearchOutcome } from '../character-build/search';
import { deltaInfo } from '../character-build/explanation';
import { objectiveGates, type Gate } from './capabilities';
import { resolveProgression, type ProgressionCatalog } from './progression';

// What the search covers: every attainable allocation of a complete template,
// the documented profile only, or the user's own entered values.
export type RecommendationScope =
  'full-potential' | 'selected-profile' | 'custom-input';
export type RecommendationGate = Gate;

// Experimental (source-model) objectives are allowed and labeled as such;
// unavailable objectives and unsupported scopes are refused here, before any
// search, with the same reasons the capability summary shows.
export function recommendationGates(
  entry: EvaluatorEntry,
  progressions: ProgressionCatalog,
  request: BuildRequest,
  scope: RecommendationScope,
): RecommendationGate[] {
  const resolved = resolveProgression(entry, progressions);
  if (!resolved.ok) return [{ code: 'mapping', message: resolved.reason }];
  const gates: RecommendationGate[] = [
    ...objectiveGates(entry, request.objective, request),
  ];
  if (
    scope === 'full-potential' &&
    resolved.template.coverage !== 'complete-for-progression'
  )
    gates.push({
      code: 'allocation-graph',
      message: `Cannot recommend a full potential allocation for this exact state: ${resolved.template.missing.join('; ')}. A growth/profile total does not supply those choices.`,
    });
  if (scope === 'custom-input' && !request.customPotential)
    gates.push({
      code: 'custom-input',
      message: 'Enter your current potential values first.',
    });
  if (scope !== 'custom-input' && request.customPotential)
    gates.push({
      code: 'custom-input',
      message:
        'Your own potential values are not a documented allocation; they are compared only as entered.',
    });
  return gates;
}
export interface DirectRecommendation {
  status:
    | 'recommended'
    | 'current-best'
    | 'ties'
    | 'best-found'
    | 'no-compatible'
    | 'cannot-recommend';
  title: string;
  scope: RecommendationScope;
  reasons: string[];
  selected: { group: BuildGroup; alternativeIndex: number } | null;
  // Configurations reaching the best objective value (including the current
  // build when it ties), and whether the current build is one of them.
  tiedAlternatives: number;
  currentAmongBest: boolean;
  objective: MetricKey;
  delta: ReturnType<typeof deltaInfo> | null;
  search: SearchOutcome['progress'] & {
    complete: boolean;
    stop: SearchOutcome['stop'];
  };
}
export function recommend(
  outcome: SearchOutcome,
  request: BuildRequest,
  scope: RecommendationScope,
  gates: RecommendationGate[],
): DirectRecommendation {
  const c = outcome.comparison;
  const base: DirectRecommendation = {
    status: 'cannot-recommend',
    title: 'Cannot recommend yet',
    scope,
    reasons: [...gates.map((g) => g.message), ...c.errors],
    selected: null,
    tiedAlternatives: 0,
    currentAmongBest: false,
    objective: request.objective,
    delta: null,
    search: {
      ...outcome.progress,
      complete: outcome.stop === 'complete',
      stop: outcome.stop,
    },
  };
  if (base.reasons.length) return base;
  if (!c.current || c.current.metrics[request.objective].value === null) {
    base.reasons = [
      'The current build has no available value for this objective.',
    ];
    return base;
  }
  if (!c.groups.length)
    return {
      ...base,
      status:
        outcome.stop === 'complete' ? 'no-compatible' : 'cannot-recommend',
      title:
        outcome.stop === 'complete'
          ? 'No compatible build meets these requirements'
          : 'Cannot recommend yet: search stopped before a candidate was evaluated',
      reasons: [],
    };
  let first = c.groups[0]!,
    best = first.evaluation.metrics[request.objective].value;
  if (best === null) {
    base.reasons = ['The objective is unavailable.'];
    return base;
  }
  const baselineValue = c.current.metrics[request.objective].value!;
  const baselineBetter =
    METRIC_DIRECTION[request.objective] === 'higher'
      ? baselineValue > best
      : baselineValue < best;
  const baselineTied = baselineValue === best;
  const metrics = c.frontier.metricsUsed;
  const baselineDominator = c.frontier.comparable
    ? c.groups.find((g) => {
        const noWorse = (metric: MetricKey) =>
          METRIC_DIRECTION[metric] === 'higher'
            ? g.evaluation.metrics[metric].value! >=
              c.current!.metrics[metric].value!
            : g.evaluation.metrics[metric].value! <=
              c.current!.metrics[metric].value!;
        return (
          metrics.every(noWorse) &&
          metrics.some(
            (metric) =>
              g.evaluation.metrics[metric].value !==
              c.current!.metrics[metric].value,
          )
        );
      })
    : undefined;
  const baselineGroup: BuildGroup = {
    ...first,
    id: 'current-baseline',
    evaluation: c.current,
    rank: 1,
    frontier: c.frontier.comparable && !baselineDominator,
    dominatedBy: baselineDominator
      ? { kind: 'group', id: baselineDominator.id }
      : null,
    dominatedOn: baselineDominator
      ? metrics.filter(
          (metric) =>
            baselineDominator.evaluation.metrics[metric].value !==
            c.current!.metrics[metric].value,
        )
      : [],
    alternatives: [
      {
        build: request.current,
        changes: [],
        missingInventory: {},
        isCurrent: true,
      },
    ],
    deltas: Object.fromEntries(
      Object.entries(c.current.metrics).map(([m, value]) => [
        m,
        value.value === null ? null : 0,
      ]),
    ) as BuildGroup['deltas'],
  };
  if (baselineBetter) {
    first = baselineGroup;
    best = baselineValue;
  }
  const ties = baselineBetter
    ? [first]
    : c.groups.filter(
        (g) => g.evaluation.metrics[request.objective].value === best,
      );
  if (
    baselineTied &&
    !ties.some((g) => g.alternatives.some((a) => a.isCurrent))
  )
    ties.push(baselineGroup);
  const alternatives = ties.flatMap((group) =>
    group.alternatives.map((alternative, alternativeIndex) => ({
      group,
      alternative,
      alternativeIndex,
    })),
  );
  alternatives.sort(
    (a, b) =>
      Number(b.alternative.isCurrent) - Number(a.alternative.isCurrent) ||
      a.alternative.changes.length - b.alternative.changes.length ||
      buildKey(a.alternative.build).localeCompare(
        buildKey(b.alternative.build),
      ),
  );
  const selected = alternatives[0]!;
  const baseline = c.current.metrics[request.objective].value!;
  const currentNoWorse =
    METRIC_DIRECTION[request.objective] === 'higher'
      ? baseline >= best
      : baseline <= best;
  const complete = outcome.stop === 'complete';
  const status = !complete
    ? 'best-found'
    : currentNoWorse
      ? 'current-best'
      : alternatives.length > 1
        ? 'ties'
        : 'recommended';
  return {
    ...base,
    status,
    title:
      status === 'best-found'
        ? 'Best found.'
        : status === 'current-best'
          ? `Your current build is already best for ${METRIC_LABELS[request.objective]}.`
          : status === 'ties'
            ? 'Multiple builds tie.'
            : 'Recommended build.',
    reasons: [],
    selected: {
      group: selected.group,
      alternativeIndex: selected.alternativeIndex,
    },
    tiedAlternatives: alternatives.length,
    currentAmongBest: currentNoWorse,
    delta: deltaInfo(
      best,
      baseline,
      first.evaluation.metrics[request.objective].unit,
    ),
    search: { ...outcome.progress, complete, stop: outcome.stop },
  };
}
