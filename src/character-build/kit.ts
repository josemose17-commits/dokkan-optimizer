import type {
  Ability,
  Effect,
  SnapshotContext,
} from '../character-definitions/domain';
import type { CatalogSnapshot } from '../character-data/domain';

// Reuse the maintenance effect/condition language. Recorded source text is
// data, never an executable evaluator or a reviewed recommendation policy.
export interface KitReference {
  id: string;
  label: string;
  url: string;
  reviewedAt: string;
  independentConfirmation: string | null;
}
export interface ReviewedKit {
  stateId: string;
  cardId: string;
  revision: string;
  // Reviewed policy admission is separate from having structured effects.
  // New/imported kits do not acquire advice from matching a family name.
  policy: 'guard-buildup-v1' | 'conditional-evasion-v1' | 'ally-support-v1';
  identity: {
    type: string;
    rarity: string;
    level: number;
    sa: number;
    awakening: 'eza';
    step: number | null;
    region: string | null;
    gameVersion: string | null;
  };
  abilities: Ability[];
  references: KitReference[];
  // Each effect must retain its own source, including unresolved wording.
  notes: string[];
  buildGaps: string[];
}
export type KitEffect = Effect & {
  abilityId: string;
  abilityKind: Ability['kind'];
};
export function kitEffects(kit: ReviewedKit): KitEffect[] {
  return kit.abilities.flatMap((a) =>
    a.effects.map((e) => ({ ...e, abilityId: a.id, abilityKind: a.kind })),
  );
}

export function resolveKit(
  snapshot: CatalogSnapshot,
  kits: readonly ReviewedKit[],
  stateId: string,
): { ok: true; kit: ReviewedKit } | { ok: false; reason: string } {
  const state = snapshot.states.find((s) => s.id === stateId);
  const matches = kits.filter((k) => k.stateId === stateId);
  if (!state || matches.length !== 1)
    return {
      ok: false,
      reason: 'No unique reviewed kit is bound to this exact state.',
    };
  const kit = matches[0]!,
    i = kit.identity;
  if (
    state.cardId !== kit.cardId ||
    state.fields.type.value !== i.type ||
    state.fields.rarity.value !== i.rarity ||
    state.fields.level.value !== i.level ||
    state.fields.superAttackLevel.value !== i.sa ||
    state.awakening.kind !== i.awakening ||
    state.awakening.step !== i.step ||
    state.region !== i.region ||
    state.gameVersion !== i.gameVersion
  )
    return {
      ok: false,
      reason:
        'The reviewed kit and catalog state disagree; no other form or awakening is substituted.',
    };
  const effects = kitEffects(kit);
  if (
    !effects.length ||
    new Set(effects.map((e) => e.id)).size !== effects.length ||
    !kit.references.length ||
    effects.some(
      (e) =>
        !e.source.reference ||
        e.source.status !== 'source-documented' ||
        !kit.references.some((r) => r.url === e.source.reference),
    )
  )
    return {
      ok: false,
      reason:
        'The kit needs unique effects with field-level source references.',
    };
  return { ok: true, kit };
}

export const guidanceContext = (stateId: string): SnapshotContext => ({
  provenance: 'manual',
  phase: 'before-attack',
  values: { battleTurn: 3, appearance: 2, slot: 1 },
  allies: [],
  state: stateId,
});
