import {
  SLOTS,
  type Build,
  type BuildGroup,
  type BuildRequest,
  type CharacterCatalog,
  type ComparisonResult,
  type Evaluation,
  type MetricKey,
} from './domain';
import { buildKey, generateBuilds } from './generation';
import { evaluateBuild } from './evaluation';
import { missingInventory, requestErrors } from './legality';

const available = (e: Evaluation, key: MetricKey) =>
  e.metrics[key].value !== null && Number.isFinite(e.metrics[key].value);

export function frontier(evaluations: Evaluation[], requested: MetricKey[]) {
  const sameContext =
    new Set(evaluations.map((e) => e.comparisonKey)).size <= 1;
  const metricsUsed = requested.filter((key) =>
    evaluations.every((e) => available(e, key)),
  );
  const omittedMetrics = requested.filter((key) => !metricsUsed.includes(key));
  const comparable =
    sameContext && metricsUsed.length > 0 && evaluations.length > 0;
  const indices = comparable
    ? evaluations.flatMap((candidate, index) => {
        const dominated = evaluations.some(
          (other) =>
            metricsUsed.every(
              (key) =>
                other.metrics[key].value! >= candidate.metrics[key].value!,
            ) &&
            metricsUsed.some(
              (key) =>
                other.metrics[key].value! > candidate.metrics[key].value!,
            ),
        );
        return dominated ? [] : [index];
      })
    : [];
  return {
    metricsUsed: sameContext ? metricsUsed : [],
    omittedMetrics,
    comparable,
    indices,
    reason: !sameContext
      ? 'Different contexts cannot be compared.'
      : !metricsUsed.length
        ? 'No common available metrics; dominance is unavailable.'
        : 'Frontier uses only these common metrics: no worse in each, strictly better in at least one. Exact ties are retained.',
  };
}

function changes(
  build: Build,
  current: Build,
  catalog: CharacterCatalog,
): string[] {
  // An unknown ID stays identifiable; it is never shown as an empty slot.
  const label = (id: string | null) =>
    id === null
      ? 'Empty'
      : (catalog.orbs.find((o) => o.id === id)?.label ??
        `Unknown item (${id})`);
  return [
    ...Object.entries(build.choices)
      .filter(([id, skill]) => current.choices[id] !== skill)
      .map(([id, skill]) => `${id}: ${current.choices[id]} → ${skill}`),
    ...SLOTS.filter((slot) => build.equips[slot] !== current.equips[slot]).map(
      (slot) =>
        `${slot}: ${label(current.equips[slot])} → ${label(build.equips[slot])}`,
    ),
  ];
}

// Group by the complete exposed evaluation, including unavailable states/context.
// Alternatives remain attached; equivalence does not imply equal resource costs.
function evaluationKey(evaluation: Evaluation): string {
  return JSON.stringify([
    evaluation.comparisonKey,
    Object.entries(evaluation.metrics)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, metric]) => [key, metric.value, metric.reason]),
  ]);
}

export function compareBuilds(
  request: BuildRequest,
  catalog: CharacterCatalog,
): ComparisonResult {
  const result: ComparisonResult = {
    errors: requestErrors(request, catalog),
    current: null,
    groups: [],
    frontier: {
      comparable: false,
      metricsUsed: [],
      omittedMetrics: [],
      reason: 'No evaluated builds.',
    },
    search: {
      evaluated: 0,
      unique: 0,
      totalLegal: null,
      limit: request.maxCandidates,
      truncated: false,
    },
  };
  if (result.errors.length) return result;
  // Baseline is assessed independently, including when enumeration later truncates.
  result.current = evaluateBuild(request.current, request, catalog);
  const groups = new Map<string, BuildGroup>();
  for (const build of generateBuilds(request, catalog)) {
    if (result.search.evaluated === request.maxCandidates) {
      result.search.truncated = true;
      break;
    }
    const evaluation = evaluateBuild(build, request, catalog);
    result.search.evaluated++;
    const key = evaluationKey(evaluation);
    let group = groups.get(key);
    if (!group) {
      group = {
        id: buildKey(build),
        rank: 0,
        evaluation,
        alternatives: [],
        frontier: false,
        deltas: Object.fromEntries(
          Object.entries(evaluation.metrics).map(([metric, value]) => {
            const baseline = result.current!.metrics[metric as MetricKey].value;
            return [
              metric,
              value.value === null || baseline === null
                ? null
                : value.value - baseline,
            ];
          }),
        ) as BuildGroup['deltas'],
      };
      groups.set(key, group);
    }
    group.alternatives.push({
      build,
      changes: changes(build, request.current, catalog),
      missingInventory: missingInventory(build, request),
      isCurrent: buildKey(build) === buildKey(request.current),
    });
  }
  result.groups = [...groups.values()].sort(
    (a, b) =>
      b.evaluation.metrics[request.objective].value! -
        a.evaluation.metrics[request.objective].value! ||
      a.id.localeCompare(b.id),
  );
  let previous: number | null = null;
  let rank = 0;
  result.groups.forEach((group, index) => {
    const value = group.evaluation.metrics[request.objective].value!;
    if (value !== previous) rank = index + 1;
    group.rank = rank;
    previous = value;
  });
  // A truncated target search must not label a build non-dominated when the
  // independently evaluated current baseline already dominates it.
  const f = frontier(
    [...result.groups.map((g) => g.evaluation), result.current],
    request.frontierMetrics,
  );
  result.frontier = {
    comparable: f.comparable,
    metricsUsed: f.metricsUsed,
    omittedMetrics: f.omittedMetrics,
    reason: f.reason,
  };
  f.indices.forEach((index) => {
    if (result.groups[index]) result.groups[index]!.frontier = true;
  });
  result.search.unique = result.groups.length;
  if (!result.search.truncated)
    result.search.totalLegal = result.search.evaluated;
  return result;
}
