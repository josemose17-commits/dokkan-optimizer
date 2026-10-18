import type {
  Evaluation,
  OptimizationRequest,
  OptimizationResult,
  Replacement,
  ScoreComponents,
} from '../domain/types';
import { evaluateCandidate } from './evaluation';
import { generateCandidates } from './generation';
import { validateRequest } from './validation';

export { ENGINE_LIMITS } from './validation';
export const MODEL_WARNINGS = [
  'Synthetic demonstration — not real Dokkan recommendations.',
  'Target rotations are not guaranteed opening rotations. No turn-by-turn battle simulation is performed.',
  'Unsupported: real damage, survivability, Ki, same-name rules, opening-order randomness, transformations, domains, items, and enemy actions.',
  'Replacements use only evaluated eligible teams; a truncated search can miss alternatives.',
];

function replacementsFor(
  team: Evaluation,
  evaluated: Evaluation[],
): Replacement[] {
  return evaluated
    .flatMap((alternative) => {
      const out = team.ownedIds.filter(
        (id) => !alternative.ownedIds.includes(id),
      );
      const incoming = alternative.ownedIds.filter(
        (id) => !team.ownedIds.includes(id),
      );
      if (out.length !== 1 || incoming.length !== 1) return [];
      const componentDeltas = Object.fromEntries(
        (Object.keys(team.components!) as (keyof ScoreComponents)[]).map(
          (key) => [key, alternative.components![key] - team.components![key]],
        ),
      ) as unknown as ScoreComponents;
      return [
        {
          outId: out[0]!,
          inId: incoming[0]!,
          alternativeKey: alternative.key,
          total: alternative.total!,
          delta: alternative.total! - team.total!,
          componentDeltas,
        },
      ];
    })
    .sort(
      (a, b) =>
        b.total - a.total || (a.alternativeKey < b.alternativeKey ? -1 : 1),
    )
    .slice(0, 3);
}

export function optimize(request: OptimizationRequest): OptimizationResult {
  const errors = validateRequest(request);
  const result: OptimizationResult = {
    teams: [],
    errors,
    warnings: [...MODEL_WARNINGS],
    rejectedExamples: [],
    rejectionCounts: {},
    search: {
      possible: 0,
      evaluated: 0,
      eligible: 0,
      rejected: 0,
      limit: request.maxCandidates,
      truncated: false,
      summary: 'Search not run.',
    },
  };
  if (errors.length) return result;
  for (const mechanic of request.scenario.mechanics.filter(
    (m) => m.status === 'unsupported',
  ))
    result.warnings.push(
      `Unsupported scenario mechanic: ${mechanic.description}`,
    );
  const generated = generateCandidates(
    request.owned,
    request.leaderInstanceId,
    request.maxCandidates,
  );
  const eligible: Evaluation[] = [];
  for (const candidate of generated.candidates) {
    const evaluated = evaluateCandidate(candidate, request);
    if (evaluated.eligible) eligible.push(evaluated);
    else {
      if (result.rejectedExamples.length < 3)
        result.rejectedExamples.push(evaluated);
      for (const reason of new Set(evaluated.reasons))
        result.rejectionCounts[reason] =
          (result.rejectionCounts[reason] ?? 0) + 1;
    }
  }
  eligible.sort(
    (a, b) =>
      b.total! - a.total! || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  result.teams = eligible.slice(0, request.resultLimit).map((team) => ({
    ...team,
    replacements: replacementsFor(team, eligible),
  }));
  result.search = {
    possible: generated.possible,
    evaluated: generated.candidates.length,
    eligible: eligible.length,
    rejected: generated.candidates.length - eligible.length,
    limit: request.maxCandidates,
    truncated: generated.truncated,
    summary: generated.truncated
      ? `Truncated: evaluated ${generated.candidates.length} of ${generated.possible} combinations. Best among evaluated candidates only; global optimum is not established.`
      : `Complete: evaluated all ${generated.possible} combinations and 105 layouts per eligible team under the synthetic model.`,
  };
  if (generated.truncated) result.warnings.push(result.search.summary);
  return result;
}
