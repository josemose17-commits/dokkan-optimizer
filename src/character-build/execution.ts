import type { Build, BuildRequest, EvaluatorEntry } from './domain';

// Selection is explicit and is reused by search, baseline, explanations,
// capabilities and the workspace. A missing context never falls back to v1.
export function evaluatorFor(
  entry: EvaluatorEntry,
  request?: Pick<BuildRequest, 'context'>,
) {
  if (request?.context.id === 'event-sequence-v1')
    return entry.sequence?.evaluator ?? null;
  return !request || request.context.id === 'initial-check-v1'
    ? entry.evaluator
    : null;
}
export const objectivesFor = (
  entry: EvaluatorEntry,
  request?: Pick<BuildRequest, 'context'>,
) =>
  request?.context.id === 'event-sequence-v1'
    ? (entry.sequence?.objectives ?? [])
    : !request || request.context.id === 'initial-check-v1'
      ? entry.objectives
      : [];
export function evaluateRegisteredBuild(
  build: Build,
  request: BuildRequest,
  entry: EvaluatorEntry,
) {
  const evaluator = evaluatorFor(entry, request);
  if (!evaluator)
    throw new Error('No evaluator is registered for this exact state/context.');
  return evaluator.evaluate(build, request, entry);
}
export const sequenceNullMetrics = (
  reason = 'Not calculated by the initial-check evaluator.',
) => ({
  expectedAttacks: {
    value: null,
    unit: 'count' as const,
    evidenceIds: [],
    reason,
  },
  expectedSupers: {
    value: null,
    unit: 'count' as const,
    evidenceIds: [],
    reason,
  },
  criticalAttacks: {
    value: null,
    unit: 'count' as const,
    evidenceIds: [],
    reason,
  },
  evadedAttacks: {
    value: null,
    unit: 'count' as const,
    evidenceIds: [],
    reason,
  },
  effectiveAttacks: {
    value: null,
    unit: 'count' as const,
    evidenceIds: [],
    reason,
  },
  attackRaise: { value: null, unit: 'ratio' as const, evidenceIds: [], reason },
  defenseRaise: {
    value: null,
    unit: 'ratio' as const,
    evidenceIds: [],
    reason,
  },
});
