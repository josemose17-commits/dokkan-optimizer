import type { CatalogSnapshot } from '../../character-data/domain';
import type { Scenario, SequenceMetric, SequenceModel } from './domain';
import { sequenceModelErrors } from './support';

// A mechanics record can support an effect preview without claiming an
// admitted potential board, equip catalog, or build-search evaluator.
export interface MechanicsRecord {
  id: string;
  revision: string;
  cardId: string;
  stateId: string;
  identity: {
    type: string;
    rarity: string;
    level: number;
    sa: number;
    region: string | null;
    awakening: 'base' | 'eza' | 'seza';
    step: number | null;
  };
  model: SequenceModel;
  scenarios: { scenario: Scenario; objectives: SequenceMetric[] }[];
  notes: string[];
}
export function resolveMechanics(
  snapshot: CatalogSnapshot,
  registry: readonly MechanicsRecord[],
  stateId: string,
): { ok: true; record: MechanicsRecord } | { ok: false; reason: string } {
  const state = snapshot.states.find((s) => s.id === stateId),
    matches = registry.filter((r) => r.stateId === stateId);
  if (!state || matches.length !== 1)
    return {
      ok: false,
      reason: 'No unique event-mechanics record is bound to this exact state.',
    };
  const record = matches[0]!,
    i = record.identity;
  if (
    record.cardId !== state.cardId ||
    record.model.stateId !== stateId ||
    record.model.cardId !== record.cardId ||
    record.model.dataRevision !== record.revision ||
    record.model.revision !== record.revision ||
    state.fields.type.value !== i.type ||
    state.fields.rarity.value !== i.rarity ||
    state.fields.level.value !== i.level ||
    state.fields.superAttackLevel.value !== i.sa ||
    state.region !== i.region ||
    state.awakening.kind !== i.awakening ||
    state.awakening.step !== i.step
  )
    return {
      ok: false,
      reason:
        'Exact-state identity or the pinned mechanics data revision disagrees; no substitution is made.',
    };
  const errors = sequenceModelErrors(record.model);
  if (errors.length) return { ok: false, reason: errors.join(' ') };
  const effects = record.model.abilities.flatMap((a) => a.effects);
  if (
    effects.some(
      (e) =>
        e.source.status !== 'source-documented' ||
        !record.model.evidence.some((r) => r.reference === e.source.reference),
    )
  )
    return {
      ok: false,
      reason: 'Every admitted effect needs its own dated source reference.',
    };
  if (
    !record.scenarios.length ||
    record.scenarios.some((s) => s.scenario.initial.state !== stateId)
  )
    return { ok: false, reason: 'Event scenarios must name this exact state.' };
  return { ok: true, record };
}
