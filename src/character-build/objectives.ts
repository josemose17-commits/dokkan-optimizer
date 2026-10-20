import {
  KIT_MECHANIC_LABELS,
  METRIC_LABELS,
  type AvailableMetric,
  type BuildRequest,
  type EvaluatorEntry,
} from './domain';
import { evaluatorFor, objectivesFor } from './execution';
import { SEQUENCE_METRICS, type SequenceMetric } from './mechanics/domain';
import { sequenceObjectiveGates } from './mechanics/support';

export interface Gate {
  code: string;
  message: string;
}

// Shared pure gates: capability display, recommendation and the event adapter
// use the same objective-specific evidence and mechanic coverage.
const evidenceOk = (entry: EvaluatorEntry, ids: string[]) =>
  ids.length > 0 &&
  ids.every((id) =>
    entry.model.evidence.some((e) => e.id === id && e.status !== 'unresolved'),
  );

// Objective-specific requirements. Kit mechanics that could change the
// objective must be declared absent or be modeled; "unknown" fails closed.
export function objectiveGates(
  entry: EvaluatorEntry,
  metric: AvailableMetric,
  request?: BuildRequest,
): Gate[] {
  const gates: Gate[] = [];
  const evaluator = evaluatorFor(entry, request);
  const model = evaluator?.objectiveModels[metric];
  if (!objectivesFor(entry, request).includes(metric) || !model)
    return [
      {
        code: 'objective-model',
        message: `${METRIC_LABELS[metric]} is not calculated for this state.`,
      },
    ];
  const support =
    request?.context.id === 'event-sequence-v1'
      ? entry.sequence?.recommendationSupport[metric]
      : entry.recommendationSupport?.[metric];
  if (!support)
    gates.push({
      code: 'effect-coverage',
      message:
        'No objective-specific kit/effect coverage declaration exists for this character state. Its text or another character’s evaluator cannot supply one.',
    });
  else {
    gates.push(
      ...support.blockers.map((message) => ({
        code: 'missing-mechanic',
        message,
      })),
    );
    if (!evidenceOk(entry, support.evidenceIds))
      gates.push({
        code: 'evidence',
        message: 'Required objective/kit evidence is missing or unresolved.',
      });
  }
  for (const mechanic of model.mechanics) {
    const declared = entry.model.kit[mechanic];
    const label = KIT_MECHANIC_LABELS[mechanic];
    if (declared.status === 'unknown')
      gates.push({
        code: 'kit-mechanic',
        message: `${label}: unknown for this state. It could change this result.`,
      });
    else if (
      declared.status === 'present' &&
      !evaluator!.mechanics.includes(mechanic)
    )
      gates.push({
        code: 'kit-mechanic',
        message: `${label}: part of this kit but not modeled. It could change this result.`,
      });
  }
  if (
    request?.context.id === 'event-sequence-v1' &&
    entry.sequence &&
    SEQUENCE_METRICS.includes(metric as SequenceMetric)
  ) {
    const context = request.context;
    const scenario = entry.sequence.scenarios.find(
      (s) => s.id === context.scenarioId,
    );
    if (!scenario || context.modelRevision !== entry.sequence.model.revision)
      gates.push({
        code: 'event-context',
        message: 'The pinned event scenario or model revision is unavailable.',
      });
    else
      gates.push(
        ...sequenceObjectiveGates(
          entry.sequence.model,
          scenario,
          metric as SequenceMetric,
        ).map((message) => ({ code: 'event-effect', message })),
      );
  }
  return gates;
}
