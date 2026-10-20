import {
  METRIC_KEYS,
  type EvaluatorImplementation,
  type Metric,
  type Metrics,
} from '../domain';
import { collectBuildContributions } from '../evaluation';
import { objectiveGates } from '../objectives';
import { SEQUENCE_METRICS, type SequenceMetric } from './domain';
import { evaluateSequence } from './evaluation';

const descriptions: Record<SequenceMetric, string> = {
  expectedAttacks:
    'Probability-weighted number of completed attacks in the supplied sequence.',
  expectedSupers:
    'Probability-weighted number of completed Super Attacks in the supplied sequence.',
  criticalAttacks:
    'Probability-weighted number of critical attacks, with explicitly bound native and potential checks.',
  evadedAttacks:
    'Probability-weighted number of evaded incoming attacks. This is not survival probability.',
  effectiveAttacks:
    'Probability-weighted number of attacks with the all-type-effectiveness property. No damage multiplier is calculated.',
  attackRaise:
    'Expected remaining ATK effect factor minus one under the declared grouping model. This is not battle ATK or damage.',
  defenseRaise:
    'Expected remaining DEF effect factor minus one under the declared grouping model. This is not battle DEF or survival.',
};
export const sequenceEvaluator: EvaluatorImplementation = {
  id: 'character-event-sequence',
  version: '1',
  label: 'Explicit character event sequence v1',
  verification:
    'Independent arithmetic and event-order tests check this declared model, not actual game RNG, stage rounding or combat behavior.',
  objectiveModels: Object.fromEntries(
    SEQUENCE_METRICS.map((metric) => [
      metric,
      {
        group: 'event-sequence',
        status: 'experimental',
        summary: descriptions[metric],
        basis:
          'Enumerate every nonzero branch of the admitted sequence; compare only the chosen metric, with no hidden role weights.',
        mechanics:
          metric === 'evadedAttacks'
            ? ['nativeEvasion']
            : metric === 'criticalAttacks'
              ? ['nativeAdditional', 'nativeCritical']
              : ['nativeAdditional'],
      },
    ]),
  ) as EvaluatorImplementation['objectiveModels'],
  gaps: [
    {
      label: 'Damage',
      reason:
        'No damage formula, type multiplier, enemy DEF interaction or damage index is implemented.',
    },
    {
      label: 'Survival',
      reason:
        'Incoming damage must be supplied as a resolved outcome; no survival approximation is implemented.',
    },
  ],
  mechanics: [
    'nativeAdditional',
    'nativeCritical',
    'nativeEvasion',
    'attackTriggered',
    'buildup',
    'conditional',
  ],
  customPotential: true,
  evaluate(build, request, entry) {
    const extension = entry.sequence,
      context = request.context;
    if (!extension || context.id !== 'event-sequence-v1')
      throw new Error(
        'No versioned event model is bound to this state/context.',
      );
    const scenario = extension.scenarios.find(
      (s) => s.id === context.scenarioId,
    );
    if (!scenario || context.modelRevision !== extension.model.revision)
      throw new Error('The exact event scenario/revision is unavailable.');
    const { stats, skills, trace } = collectBuildContributions(
      build,
      request,
      entry,
    );
    const requested = [
      ...new Set([request.objective, ...request.frontierMetrics]),
    ].filter((m): m is SequenceMetric =>
      SEQUENCE_METRICS.includes(m as SequenceMetric),
    );
    const gated = new Map(
      requested.map((metric) => [
        metric,
        objectiveGates(entry, metric, request).map((g) => g.message),
      ]),
    );
    const primaryGates = objectiveGates(entry, request.objective, request);
    if (primaryGates.length)
      throw new Error(primaryGates.map((g) => g.message).join(' '));
    const supported = requested.filter((metric) => !gated.get(metric)?.length);
    const result = evaluateSequence(
      extension.model,
      {
        schemaVersion: 1,
        modelRevision: context.modelRevision,
        scenario,
        skills,
        evasionAllowed: context.evasionAllowed,
        maxBranches: 4096,
        maxEvents: 50000,
      },
      supported,
    );
    if (result.status !== 'evaluated')
      throw new Error(result.reasons.join(' '));
    trace.sequence = {
      modelId: extension.model.id,
      modelRevision: extension.model.revision,
      scenario: scenario.label,
      assumptions: [...extension.model.assumptions, ...scenario.assumptions],
      result,
    };
    const unavailable = (reason: string): Metric => ({
      value: null,
      unit: 'stat',
      evidenceIds: [],
      reason,
    });
    const metrics = Object.fromEntries(
      METRIC_KEYS.map((key) => [
        key,
        unavailable(
          'Outside this event evaluator; unknown values do not rank as zero.',
        ),
      ]),
    ) as Metrics;
    for (const key of SEQUENCE_METRICS)
      metrics[key] = {
        value: result.metrics[key],
        unit:
          key === 'attackRaise' || key === 'defenseRaise' ? 'ratio' : 'count',
        evidenceIds: extension.recommendationSupport[key]?.evidenceIds ?? [],
        reason: gated.get(key)?.length
          ? gated.get(key)!.join(' ')
          : descriptions[key],
      };
    metrics.damage = {
      ...unavailable('Damage is unavailable; no approximate index is used.'),
      unit: 'damage',
    };
    return {
      stats,
      skills,
      metrics,
      trace,
      comparisonKey: JSON.stringify([
        entry.id,
        sequenceEvaluator.id,
        sequenceEvaluator.version,
        entry.model.revision,
        extension.model.revision,
        entry.stateId,
        request.progression,
        request.customPotential ?? null,
        request.context,
        requested,
      ]),
    };
  },
};
