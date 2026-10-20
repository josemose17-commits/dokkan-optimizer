import type { SnapshotContext } from '../character-definitions/domain';
import { inspectCondition } from '../character-definitions/evaluation';
import {
  inferAssignment,
  lastingSuperDefense,
  type KitReason,
} from './assignment';
import { kitEffects, type ReviewedKit } from './kit';

export type GuidanceFocus = 'buildup' | 'opening-protection';
export interface KitGuidance {
  method: 'reviewed character-aware rule';
  assignment: ReturnType<typeof inferAssignment>;
  emphasis: string;
  why: KitReason[];
  equipment: KitReason[];
  conflicts: KitReason[];
  exactBuild: { available: false; reasons: string[] };
}
/** Advice is deliberately separate from numerical ranking. It never returns
 * arbitrary AA/Crit/Evasion totals, item IDs, probabilities or a fake winner. */
export function kitGuidance(
  kit: ReviewedKit,
  context: SnapshotContext,
  focus: GuidanceFocus = 'buildup',
  evasionAllowed = true,
): KitGuidance {
  const assignment = inferAssignment(kit, context);
  const lasting = lastingSuperDefense(kit);
  const effects = kitEffects(kit);
  const knownLasting = lasting.filter(
    (e) => inspectCondition(e.condition, context).state === 'met',
  );
  const guards = effects.filter(
    (e) =>
      e.family === 'guard' &&
      e.target === 'self' &&
      ['start-of-turn', 'before-hit'].includes(e.timing) &&
      e.representation === 'structured' &&
      e.source.status === 'source-documented' &&
      inspectCondition(e.condition, context).state === 'met',
  );
  const hit = effects.filter((e) =>
    e.dependencies.includes('guard-activation'),
  );
  const initial: KitGuidance = {
    method: 'reviewed character-aware rule',
    assignment,
    emphasis: 'Cannot determine an emphasis from the supported kit facts.',
    why: [],
    equipment: [],
    conflicts: [],
    exactBuild: { available: false, reasons: [...kit.buildGaps] },
  };
  if (context.state !== kit.stateId) {
    initial.exactBuild.reasons.push(
      'The context does not name this exact state. No advice is substituted.',
    );
    return initial;
  }
  if (
    kit.policy === 'guard-buildup-v1' &&
    guards.length &&
    knownLasting.length
  ) {
    const ids = knownLasting.map((e) => e.id);
    if (focus === 'buildup') {
      initial.emphasis =
        'Additional-led priorities for the untransformed defensive buildup role.';
      initial.why = [
        {
          text: 'A further qualifying Super can apply the lasting DEF effect again. This reviewed policy prioritizes that opportunity over personal critical-hit contribution; it does not calculate how much DEF or survival the build gains.',
          effectIds: ids,
        },
      ];
      initial.equipment = [
        {
          text: 'Look for compatible Additional skill-level effects to support the same buildup priority; compare them jointly with potential choices once the attainable set is established.',
          effectIds: ids,
        },
        {
          text: 'Treat flat DEF equipment as a meaningful alternative when protection before the first Super matters more. Raw DEF alone does not establish survival.',
          effectIds: guards.map((e) => e.id),
        },
      ];
    } else {
      initial.emphasis =
        'Opening protection first; Additional does not improve protection before the first Super.';
      initial.why = [
        {
          text: 'The lasting DEF effect is obtained after attacking. The opening-protection override changes the priority, not the kit-based position or rotation assignment.',
          effectIds: ids,
        },
      ];
      initial.equipment = [
        {
          text: 'Compare compatible flat DEF effects and eligible avoidance effects for the opening window. Their relative value is unavailable without the relevant incoming-attack model; no numeric winner is supplied.',
          effectIds: [...ids, ...guards.map((e) => e.id)],
        },
      ];
    }
    if (hit.length && evasionAllowed)
      initial.conflicts.push({
        text: 'Evasion may postpone the guard-triggered ATK benefit. The guard/received-attack activation ordering remains unresolved, so this policy does not automatically fill remaining choices with Evasion or Critical.',
        effectIds: hit.map((e) => e.id),
      });
  }
  if (!evasionAllowed)
    initial.conflicts.push({
      text: 'The supplied context disables evasion; do not prioritize Evasion for this context. This is not a claim about a named boss.',
      effectIds: [],
    });
  const guarantee = effects.filter(
    (e) =>
      e.family === 'evasion' &&
      e.target === 'self' &&
      e.amount === 1 &&
      e.unit === 'probability' &&
      inspectCondition(e.condition, context).state === 'met',
  );
  if (kit.policy === 'conditional-evasion-v1' && guarantee.length) {
    initial.emphasis = evasionAllowed
      ? 'Additional Evasion cannot improve an active native evasion guarantee; keep the remaining build tradeoff unresolved.'
      : 'The supplied context disables evasion, including the native guarantee; no exact alternate allocation is established.';
    initial.why = [
      {
        text: 'This policy applies only while the documented native guarantee is active. It does not infer a full Additional/Critical split or extend entry-turn protection to later appearances.',
        effectIds: guarantee.map((e) => e.id),
      },
    ];
    initial.equipment = [
      {
        text: 'Evaluate equipment for the other supported job only after the native attack chain, critical interactions and attainable choices are admitted. No exact item recommendation is made here.',
        effectIds: guarantee.map((e) => e.id),
      },
    ];
  }
  const native = effects.filter((e) =>
    ['additional-attack', 'additional-super'].includes(e.family),
  );
  if (native.length)
    initial.conflicts.push({
      text: 'Native additional attacks are already part of this kit. Their interaction with Hidden Potential determines the marginal benefit; the initial-check Goku formula is not borrowed for this character.',
      effectIds: native.map((e) => e.id),
    });
  if (!initial.why.length)
    initial.exactBuild.reasons.push(
      'No reviewed emphasis rule applies to this kit/context. Unknown contributions are not treated as zero.',
    );
  return initial;
}
