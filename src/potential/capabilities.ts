import {
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
import { evaluatorFor, objectivesFor } from '../character-build/execution';
import { objectiveGates, type Gate } from '../character-build/objectives';
export { objectiveGates };
export type { Gate };
import { resolveProgression, type ProgressionCatalog } from './progression';

// What one exact state can actually evaluate, resolved before any search:
// allocation modes, equipment, and each objective's model status. The UI and
// the recommendation gates read the same records, so a mode or objective is
// never offered and then refused only after a failed run.

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

export function objectiveCapability(
  entry: EvaluatorEntry,
  metric: AvailableMetric,
  request?: BuildRequest,
): ObjectiveCapability {
  const model = evaluatorFor(entry, request)?.objectiveModels[metric];
  const gates = objectiveGates(entry, metric, request);
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
  const evaluator = evaluatorFor(entry, request);
  const objectives = (
    Object.keys(evaluator?.objectiveModels ?? {}) as AvailableMetric[]
  )
    .filter((m) => objectivesFor(entry, request).includes(m))
    .map((m) => objectiveCapability(entry, m, request));
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
      custom: { available: evaluator?.customPotential ?? false },
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
    gaps: evaluator?.gaps ?? [],
    counts,
  };
}
