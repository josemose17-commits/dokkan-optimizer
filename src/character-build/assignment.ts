import { inspectCondition } from '../character-definitions/evaluation';
import type { SnapshotContext } from '../character-definitions/domain';
import { kitEffects, type ReviewedKit, type KitEffect } from './kit';

export interface KitReason {
  text: string;
  effectIds: string[];
}
export interface Assignment {
  position: '1' | 'flexible' | 'insufficient information';
  secondary: string[];
  rotation: 'main rotation' | 'flexible' | 'insufficient information';
  role: 'defender' | 'support' | 'damage dealer' | 'insufficient information';
  secondaryRole: string | null;
  reasons: KitReason[];
  conditions: KitReason[];
  basis: 'reviewed kit inference';
}
const documented = (e: KitEffect) =>
  e.representation === 'structured' && e.source.status === 'source-documented';
export function lastingSuperDefense(kit: ReviewedKit) {
  return kitEffects(kit).filter(
    (e) =>
      documented(e) &&
      e.abilityKind === 'super' &&
      e.target === 'self' &&
      e.family === 'percent-stat' &&
      e.stat === 'defense' &&
      e.amount !== null &&
      e.amount > 0 &&
      (e.duration.kind === 'permanent' ||
        (e.duration.kind === 'turns' &&
          e.duration.count !== null &&
          e.duration.count > 1)),
  );
}

/** Reviewed qualitative patterns, not a tier list or magnitude-based score.
 * Conditions remain conditional. No enemy damage benchmark is an input. */
export function inferAssignment(
  kit: ReviewedKit,
  context: SnapshotContext,
): Assignment {
  const effects = kitEffects(kit).filter(documented);
  const guards = effects.filter(
    (e) =>
      e.family === 'guard' &&
      e.target === 'self' &&
      ['start-of-turn', 'before-hit'].includes(e.timing) &&
      inspectCondition(e.condition, context).state === 'met',
  );
  const lasting = lastingSuperDefense(kit).filter(
    (e) => inspectCondition(e.condition, context).state === 'met',
  );
  const support = effects.filter(
    (e) =>
      e.family === 'support' &&
      ['allies-including-self', 'other-allies'].includes(e.target) &&
      inspectCondition(e.condition, context).state === 'met',
  );
  const offensive = effects.filter(
    (e) =>
      e.target === 'self' &&
      e.stat === 'attack' &&
      e.amount !== null &&
      e.amount > 0 &&
      e.dependencies.includes('guard-activation'),
  );
  const base: Assignment = {
    position: 'insufficient information',
    secondary: [],
    rotation: 'insufficient information',
    role: 'insufficient information',
    secondaryRole: null,
    reasons: [],
    conditions: [],
    basis: 'reviewed kit inference',
  };
  if (context.state !== kit.stateId) return base;
  if (kit.policy === 'guard-buildup-v1' && guards.length && lasting.length)
    return {
      ...base,
      position: '1',
      secondary: ['2 when another unit takes the opening attacks'],
      rotation: 'main rotation',
      role: 'defender',
      secondaryRole: offensive.length ? 'damage dealer' : null,
      reasons: [
        {
          text: 'Guard is available before attacking; it supports a front-position assignment without relying on a current boss benchmark.',
          effectIds: guards.map((e) => e.id),
        },
        {
          text: 'Repeated appearances give the lasting Super DEF effect more opportunities to develop. This supports a main-rotation buildup role.',
          effectIds: lasting.map((e) => e.id),
        },
      ],
      conditions: [
        {
          text: 'A Super effect obtained after attacking does not protect against attacks that arrived before that Super.',
          effectIds: lasting.map((e) => e.id),
        },
        ...(offensive.length
          ? [
              {
                text: 'The secondary offense role refers to guard-triggered ATK effects. Their event semantics and contribution are not evaluated by this guidance.',
                effectIds: offensive.map((e) => e.id),
              },
            ]
          : []),
      ],
    };
  if (kit.policy === 'ally-support-v1' && support.length)
    return {
      ...base,
      position: 'flexible',
      rotation: 'flexible',
      role: 'support',
      reasons: [
        {
          text: 'Ally support is the kit contribution used by this policy. The kit does not establish a permanent floater assignment.',
          effectIds: support.map((e) => e.id),
        },
      ],
      conditions: support
        .filter((e) => e.abilityKind === 'super')
        .map((e) => ({
          text: 'A same-turn Super support effect needs the intended beneficiary to act after it; verify repeated-effect stacking before prioritizing Additional for support.',
          effectIds: [e.id],
        })),
    };
  const guarantees = effects.filter(
    (e) =>
      e.family === 'evasion' &&
      e.amount === 1 &&
      e.unit === 'probability' &&
      ['before-hit', 'start-of-turn'].includes(e.timing),
  );
  if (kit.policy === 'conditional-evasion-v1' && guarantees.length)
    return {
      ...base,
      position: 'flexible',
      rotation: 'flexible',
      role: offensive.length ? 'damage dealer' : 'insufficient information',
      conditions: guarantees.map((e) => ({
        text: `Slot 1 is a conditional option while the documented evasion guarantee is active and the incoming attack is evadable (condition: ${inspectCondition(e.condition, context).state}). Outside that window this pattern does not assign slot 1.`,
        effectIds: [e.id],
      })),
    };
  return base;
}
