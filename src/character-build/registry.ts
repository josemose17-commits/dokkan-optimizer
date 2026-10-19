import { resolveState } from '../character-data/catalog';
import type { CatalogSnapshot, CatalogState } from '../character-data/domain';
import type { EvaluatorEntry } from './domain';
import { entryErrors } from './legality';

// Pure selection of an evaluator for an exact catalog state. Data modules
// supply the registry; this module never imports data and never substitutes
// one character, state or evaluator for another.

export const WORKING_SETTINGS_KEY = 'dokkan.character-builds.v1';
// New entries get their own working-settings key; the original Goku entry
// keeps exactly `dokkan.character-builds.v1` so existing saves stay readable.
export const workingSettingsKey = (entryId: string) =>
  `${WORKING_SETTINGS_KEY}:${entryId}`;

export function registryErrors(registry: readonly EvaluatorEntry[]): string[] {
  const errors: string[] = [];
  const duplicates = (values: string[], what: string) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value))
        errors.push(`Duplicate ${what} in registry: ${value}.`);
      seen.add(value);
    }
  };
  duplicates(
    registry.map((e) => e.id),
    'evaluator ID',
  );
  duplicates(
    registry.map((e) => e.stateId),
    'state binding',
  );
  duplicates(
    registry.map((e) => e.storageKey),
    'working-settings key',
  );
  for (const entry of registry) errors.push(...entryErrors(entry));
  return errors;
}

export type Resolution =
  | { ok: true; entry: EvaluatorEntry; state: CatalogState }
  | {
      ok: false;
      code:
        | 'invalid-registry'
        | 'unknown-state'
        | 'not-supported'
        | 'no-implementation'
        | 'binding-mismatch'
        | 'data-mismatch';
      reason: string;
      state: CatalogState | null;
    };

/**
 * Resolves the evaluator the catalog state itself names. Every refusal gives
 * the exact reason; there is no default, name match or fallback entry.
 */
export function resolveEvaluator(
  registry: readonly EvaluatorEntry[],
  snapshot: CatalogSnapshot,
  stateId: string,
): Resolution {
  const problems = registryErrors(registry);
  if (problems.length)
    return {
      ok: false,
      code: 'invalid-registry',
      reason: `The evaluator registry is inconsistent, so nothing is evaluated: ${problems.join(' ')}`,
      state: null,
    };
  const state = resolveState(snapshot, stateId);
  if (!state)
    return {
      ok: false,
      code: 'unknown-state',
      reason: `State ${stateId} is not in this catalog. No other state is substituted.`,
      state: null,
    };
  const evaluatorId = state.optimization.evaluatorId;
  if (state.optimization.status !== 'limited' || evaluatorId === null)
    return {
      ok: false,
      code: 'not-supported',
      reason: state.optimization.reason,
      state,
    };
  const entry = registry.find((e) => e.id === evaluatorId);
  if (!entry)
    return {
      ok: false,
      code: 'no-implementation',
      reason: `The catalog names evaluator ${evaluatorId} for this state, but this app has no such evaluator. Optimization is unavailable.`,
      state,
    };
  if (entry.stateId !== state.id || entry.catalogCardId !== state.cardId)
    return {
      ok: false,
      code: 'binding-mismatch',
      reason: `Evaluator ${entry.id} is bound to ${entry.stateId}, not ${state.id}. An evaluator is never reused for another card or state.`,
      state,
    };
  const card = snapshot.cards.find((c) => c.id === state.cardId);
  const model = entry.model.card;
  const mismatched = [
    ['name', card?.name.value, model.name],
    ['title', card?.title.value, model.title],
    ['type', state.fields.type.value, model.type],
    ['rarity', state.fields.rarity.value, model.rarity],
    ['level', state.fields.level.value, model.level],
    [
      'Super Attack level',
      state.fields.superAttackLevel.value,
      model.superAttackLevel,
    ],
    ['region', state.region, model.region],
  ]
    .filter(
      ([, catalogValue, evaluatorValue]) => catalogValue !== evaluatorValue,
    )
    .map(([field]) => field);
  if (mismatched.length)
    return {
      ok: false,
      code: 'data-mismatch',
      reason: `The catalog and evaluator ${entry.id} disagree on ${mismatched.join(', ')}. Optimization is unavailable until they are reconciled.`,
      state,
    };
  return { ok: true, entry, state };
}

/** Exact state-ID lookup for saved settings; aliases and names never match. */
export function entryForState(
  registry: readonly EvaluatorEntry[],
  stateId: string,
): EvaluatorEntry | null {
  return registry.find((e) => e.stateId === stateId) ?? null;
}

/** Registered states that resolve against this catalog, in registry order. */
export function optimizableStates(
  registry: readonly EvaluatorEntry[],
  snapshot: CatalogSnapshot,
) {
  return registry.flatMap((entry) => {
    const resolution = resolveEvaluator(registry, snapshot, entry.stateId);
    return resolution.ok ? [resolution] : [];
  });
}
