import {
  KIT_MECHANIC_LABELS,
  METRIC_LABELS,
  SLOTS,
  type AvailableMetric,
  type BuildRequest,
  type EvaluatorEntry,
  type ModelStatus,
  type ObjectiveModel,
  type Slot,
} from '../character-build/domain';
import { orbErrors } from '../character-build/legality';
import { resolveProgression, type ProgressionCatalog } from './progression';

// What one exact state can actually evaluate, resolved before any search:
// allocation modes, equipment, and each objective's model status. The UI and
// the recommendation gates read the same records, so a mode or objective is
// never offered and then refused only after a failed run.

export interface Gate {
  code: string;
  message: string;
}
export type ObjectiveStatus = ModelStatus | 'unavailable';
export interface ObjectiveCapability {
  metric: AvailableMetric;
  label: string;
  group: ObjectiveModel['group'];
  status: ObjectiveStatus;
  summary: string;
  basis: string;
  // Every reason the objective cannot be recommended (empty when available).
  gates: Gate[];
}

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
): Gate[] {
  const gates: Gate[] = [];
  const model = entry.evaluator.objectiveModels[metric];
  if (!entry.objectives.includes(metric) || !model)
    return [
      {
        code: 'objective-model',
        message: `${METRIC_LABELS[metric]} is not calculated for this state.`,
      },
    ];
  const support = entry.recommendationSupport?.[metric];
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
      !entry.evaluator.mechanics.includes(mechanic)
    )
      gates.push({
        code: 'kit-mechanic',
        message: `${label}: part of this kit but not modeled. It could change this result.`,
      });
  }
  return gates;
}

export function objectiveCapability(
  entry: EvaluatorEntry,
  metric: AvailableMetric,
): ObjectiveCapability {
  const model = entry.evaluator.objectiveModels[metric];
  const gates = objectiveGates(entry, metric);
  return {
    metric,
    label: METRIC_LABELS[metric],
    group: model?.group ?? 'card-stats',
    status: gates.length || !model ? 'unavailable' : model.status,
    summary: model?.summary ?? '',
    basis: model?.basis ?? '',
    gates,
  };
}

export interface Capabilities {
  allocation: {
    // The documented progression and how many allocations it allows.
    documented: {
      label: string;
      origin: 'fixed-profile' | 'choice-graph';
      choiceNodes: number;
    };
    // Searching every attainable allocation of the whole board.
    full: { available: boolean; missing: string[] };
    // User-entered current totals (board requirements not checked).
    custom: { available: boolean };
  };
  equipment: { slot: Slot; items: number; reason: string | null }[];
  objectives: ObjectiveCapability[];
  gaps: { label: string; reason: string }[];
  counts: Record<ObjectiveStatus, number>;
}

export function resolveCapabilities(
  entry: EvaluatorEntry,
  progressions: ProgressionCatalog,
  request: BuildRequest = entry.defaults(),
): Capabilities {
  const resolved = resolveProgression(entry, progressions);
  const objectives = (
    Object.keys(entry.evaluator.objectiveModels) as AvailableMetric[]
  )
    .filter((m) => entry.objectives.includes(m))
    .map((m) => objectiveCapability(entry, m));
  const counts: Record<ObjectiveStatus, number> = {
    supported: 0,
    experimental: 0,
    unavailable: 0,
  };
  for (const o of objectives) counts[o.status]++;
  return {
    allocation: {
      documented: {
        label: entry.model.profile.label,
        origin: entry.model.profile.nodes.length
          ? 'choice-graph'
          : 'fixed-profile',
        choiceNodes: entry.model.profile.nodes.length,
      },
      full: {
        available:
          resolved.ok &&
          resolved.template.coverage === 'complete-for-progression',
        missing: resolved.ok ? resolved.template.missing : [resolved.reason],
      },
      custom: { available: entry.evaluator.customPotential },
    },
    equipment: SLOTS.map((slot) => {
      const fitting = entry.model.orbs.filter((o) => o.slots.includes(slot));
      const usable = fitting.filter(
        (o) => !orbErrors(o, slot, request, entry.model).length,
      );
      return {
        slot,
        items: usable.length,
        reason: usable.length
          ? null
          : fitting.length
            ? (orbErrors(fitting[0]!, slot, request, entry.model)[0] ?? null)
            : `No ${slot} items are recorded for this state.`,
      };
    }),
    objectives,
    gaps: entry.evaluator.gaps,
    counts,
  };
}
