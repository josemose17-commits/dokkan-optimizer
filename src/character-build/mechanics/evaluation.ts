import type {
  Effect,
  SnapshotContext,
} from '../../character-definitions/domain';
import { inspectCondition } from '../../character-definitions/evaluation';
import {
  allEffects,
  SEQUENCE_METRICS,
  type Attack,
  type Branch,
  type Buff,
  type Event,
  type Rule,
  type SequenceInput,
  type SequenceMetric,
  type SequenceModel,
  type SequenceResult,
} from './domain';
import {
  BOUNDS,
  inputErrors,
  requiredEffects,
  sequenceObjectiveGates,
} from './support';

const unavailable = (reasons: string[]): SequenceResult => ({
  status: 'unavailable',
  reasons: [...new Set(reasons)],
  metrics: Object.fromEntries(SEQUENCE_METRICS.map((m) => [m, null])) as Record<
    SequenceMetric,
    null
  >,
  branches: [],
  probabilityMass: null,
});
const copy = (b: Branch): Branch => ({
  ...b,
  counters: { ...b.counters },
  totals: { ...b.totals },
  buffs: b.buffs.map((v) => ({ ...v })),
  attempts: { ...b.attempts },
  activations: { ...b.activations },
  activated: [...b.activated],
  pending: b.pending.map((v) => ({ ...v })),
  trace: [...b.trace],
});
export function raiseFactor(
  branch: Pick<Branch, 'buffs'>,
  stat: 'attack' | 'defense',
): number {
  const groups = new Map<string, Buff[]>();
  for (const buff of branch.buffs.filter(
    (b) => b.family === 'percent-stat' && b.stat === stat,
  )) {
    const group = groups.get(buff.group) ?? [];
    group.push(buff);
    groups.set(buff.group, group);
  }
  let result = 1;
  for (const group of groups.values()) {
    const additive = group
      .filter((b) => b.stacking !== 'multiplicative')
      .reduce((s, b) => s + b.amount, 0);
    result *=
      (1 + additive) *
      group
        .filter((b) => b.stacking === 'multiplicative')
        .reduce((p, b) => p * (1 + b.amount), 1);
  }
  if (!Number.isFinite(result))
    throw new Error('Effect-factor arithmetic overflowed.');
  return result;
}

function nativeChance(branch: Branch, family: 'critical' | 'evasion'): number {
  const byEffect = new Map<string, Buff[]>();
  for (const buff of branch.buffs.filter((b) => b.family === family)) {
    const group = byEffect.get(buff.effectId) ?? [];
    group.push(buff);
    byEffect.set(buff.effectId, group);
  }
  let additive = 0,
    miss = 1,
    maximum = 0;
  for (const group of byEffect.values()) {
    const chance = group.reduce((s, b) => s + b.amount, 0);
    if (chance > 1 + 1e-12)
      throw new Error(
        'Native probability buildup exceeds 100%; no implicit cap is inferred.',
      );
    if (group[0]!.combine === 'additive') additive += chance;
    else if (group[0]!.combine === 'maximum')
      maximum = Math.max(maximum, chance);
    else miss *= 1 - chance;
  }
  if (additive > 1 + 1e-12)
    throw new Error(
      'Native additive overlap exceeds 100%; the overlap/cap rule is missing.',
    );
  return Math.max(maximum, 1 - (1 - additive) * miss);
}

/** Enumerates the explicit sequence. It never estimates enemy damage, a
 * damage index or survival. Every nonzero branch is retained or the entire
 * evaluation is unavailable when a budget/unknown condition is reached. */
export function evaluateSequence(
  model: SequenceModel,
  input: SequenceInput,
  objectives: readonly SequenceMetric[] = SEQUENCE_METRICS,
): SequenceResult {
  const errors = inputErrors(model, input);
  if (
    !objectives.length ||
    new Set(objectives).size !== objectives.length ||
    !objectives.every((m) => SEQUENCE_METRICS.includes(m))
  )
    errors.push('Select distinct implemented sequence objectives.');
  for (const metric of objectives)
    errors.push(...sequenceObjectiveGates(model, input.scenario, metric));
  if (errors.length) return unavailable(errors);
  const effects = allEffects(model);
  const required = requiredEffects(model, input.scenario, objectives);
  const rules = model.rules.filter((r) => required.has(r.effectId));
  let eventCount = 0;
  let suppliedValues = { ...input.scenario.initial.values };
  const guard = (branches: Branch[]) => {
    if (branches.length > input.maxBranches)
      throw new Error(
        'Branch budget reached; no partial result or optimum is reported.',
      );
    return branches;
  };
  const log = (
    b: Branch,
    event: Event,
    attack: Attack | null,
    ids: string[] = [],
    note = '',
  ) => {
    if (++eventCount > input.maxEvents)
      throw new Error('Event budget reached; no partial result is reported.');
    b.trace.push({
      index: b.trace.length,
      event,
      turn: b.turn,
      appearance: b.appearance,
      attack: attack ? { source: attack.source, kind: attack.kind } : null,
      effectIds: ids,
      note,
      probability: b.probability,
      attackFactor: raiseFactor(b, 'attack'),
      defenseFactor: raiseFactor(b, 'defense'),
      counters: { ...b.counters },
    });
  };
  const split = (
    b: Branch,
    chance: number,
  ): { success: boolean; branch: Branch }[] => {
    if (!Number.isFinite(chance) || chance < 0 || chance > 1)
      throw new Error('Invalid branch probability; input is not clamped.');
    return [
      ...(chance > 0
        ? [
            {
              success: true,
              branch: { ...copy(b), probability: b.probability * chance },
            },
          ]
        : []),
      ...(chance < 1
        ? [
            {
              success: false,
              branch: { ...copy(b), probability: b.probability * (1 - chance) },
            },
          ]
        : []),
    ];
  };
  const context = (
    b: Branch,
    event: Event,
    attack: Attack | null,
  ): SnapshotContext => ({
    ...input.scenario.initial,
    phase: event,
    values: {
      ...suppliedValues,
      battleTurn: b.turn,
      appearance: b.appearance,
      ...b.counters,
      ...(attack ? { ki: attack.ki } : {}),
      hpPercent: b.hpPercent,
    },
  });
  const activate = (b: Branch, effect: Effect) => {
    b.activations[effect.id] = (b.activations[effect.id] ?? 0) + 1;
    if (!b.activated.includes(effect.id)) b.activated.push(effect.id);
  };
  const addBuff = (b: Branch, effect: Effect, rule: Rule) => {
    const previous = b.buffs.filter((x) => x.effectId === effect.id);
    if (effect.stacking === 'once' && previous.length) return;
    const operation = rule.operation;
    let amount = effect.amount! / (operation.kind === 'raise' ? 100 : 1);
    if (effect.cap !== null) {
      const cap = effect.cap / (operation.kind === 'raise' ? 100 : 1);
      amount = Math.min(
        amount,
        Math.max(0, cap - previous.reduce((s, x) => s + x.amount, 0)),
      );
    }
    b.buffs.push({
      effectId: effect.id,
      family: effect.family,
      stat: effect.stat,
      amount,
      group: operation.kind === 'raise' ? operation.group : effect.id,
      combine:
        operation.kind === 'critical' || operation.kind === 'evasion'
          ? operation.combine
          : 'maximum',
      stacking: effect.stacking,
      expiresAfterTurn:
        effect.duration.kind === 'turns'
          ? b.turn + effect.duration.count! - 1
          : null,
      expiresAfterAppearance:
        effect.duration.kind === 'appearances'
          ? b.appearance + effect.duration.count! - 1
          : null,
    });
    activate(b, effect);
  };
  const phase = (
    initial: Branch[],
    event: Event,
    attack: Attack | null,
  ): Branch[] => {
    let branches = initial;
    for (const rule of rules.filter((r) => r.event === event)) {
      const effect = effects.find((e) => e.id === rule.effectId)!;
      const next: Branch[] = [];
      for (const b of branches) {
        const matches =
          !rule.attack ||
          (attack &&
            rule.attack.sources.includes(attack.source) &&
            rule.attack.kinds.includes(attack.kind));
        if (
          !b.alive ||
          (!b.enemyAlive &&
            (event !== 'after-attack' ||
              rule.operation.kind === 'additional')) ||
          !matches ||
          (b.attempts[effect.id] ?? 0) >= rule.maxAttemptsPerTurn ||
          (rule.maxActivations !== null &&
            (b.activations[effect.id] ?? 0) >= rule.maxActivations) ||
          !effect.dependencies.every(
            (id) =>
              b.activated.includes(id) ||
              b.buffs.some((x) => x.effectId === id),
          )
        ) {
          next.push(b);
          continue;
        }
        const condition = inspectCondition(
          effect.condition,
          context(b, event, attack),
        );
        if (condition.state === 'unknown')
          throw new Error(
            `${effect.label}: ${condition.reason} No branch condition is guessed.`,
          );
        if (condition.state === 'unmet') {
          next.push(b);
          continue;
        }
        b.attempts[effect.id] = (b.attempts[effect.id] ?? 0) + 1;
        if (rule.operation.kind === 'additional') {
          for (const outcome of split(b, rule.operation.chance)) {
            if (!outcome.success) {
              log(
                outcome.branch,
                event,
                attack,
                [],
                `${effect.label}: activation failed (${rule.operation.chance}).`,
              );
              next.push(outcome.branch);
              continue;
            }
            activate(outcome.branch, effect);
            for (const superOutcome of split(
              outcome.branch,
              rule.operation.superChance,
            )) {
              superOutcome.branch.pending.push({
                source: 'native',
                kind: superOutcome.success
                  ? rule.operation.superKind
                  : 'normal',
                ki: superOutcome.success
                  ? rule.operation.superKind === '18-ki'
                    ? 18
                    : rule.operation.superKind === '12-ki'
                      ? 12
                      : null
                  : 0,
                enemySurvives: attack?.enemySurvives ?? true,
              });
              log(
                superOutcome.branch,
                event,
                attack,
                [effect.id],
                `${effect.label}: native ${superOutcome.success ? rule.operation.superKind : 'normal'} queued; activation ${rule.operation.chance}, Super conversion ${rule.operation.superChance}.`,
              );
              next.push(superOutcome.branch);
            }
          }
        } else {
          addBuff(b, effect, rule);
          log(
            b,
            event,
            attack,
            [effect.id],
            `${effect.label}: applied at ${event}.`,
          );
          next.push(b);
        }
      }
      branches = guard(next);
    }
    for (const b of branches)
      if (b.alive && (b.enemyAlive || event === 'after-attack'))
        log(b, event, attack);
    return branches;
  };
  const removeSnapshotBuffs = (b: Branch) => {
    b.buffs = b.buffs.filter(
      (x) =>
        effects.find((e) => e.id === x.effectId)!.duration.kind !== 'snapshot',
    );
  };
  const hpChance = (family: 'critical' | 'evasion') =>
    model.potential[family] === 'independent'
      ? input.skills[family] * (family === 'critical' ? 0.02 : 0.01)
      : 0;
  const combinedChance = (b: Branch, family: 'critical' | 'evasion') =>
    1 - (1 - nativeChance(b, family)) * (1 - hpChance(family));
  const perform = (branch: Branch, attack: Attack): Branch[] => {
    branch.activated = branch.activated.filter((id) => id !== 'event:critical');
    let branches = phase([branch], 'before-attack', attack);
    branches = phase(branches, 'attack-activation', attack);
    if (attack.kind !== 'normal')
      branches = phase(branches, 'super-activation', attack);
    const criticalOutcomes: Branch[] = [];
    for (const b of branches)
      for (const outcome of split(b, combinedChance(b, 'critical'))) {
        // This flag is for this attack; previous criticals cannot satisfy an
        // on-critical dependency on the next attack by accident.
        outcome.branch.activated = outcome.branch.activated.filter(
          (id) => id !== 'event:critical',
        );
        if (outcome.success) {
          outcome.branch.totals.critical++;
          outcome.branch.activated.push('event:critical');
        }
        if (outcome.branch.buffs.some((x) => x.family === 'type-effectiveness'))
          outcome.branch.totals.effective++;
        criticalOutcomes.push(outcome.branch);
      }
    branches = phase(guard(criticalOutcomes), 'damage-calculation', attack);
    for (const b of branches) {
      b.counters.attacksPerformed++;
      b.totals.attacks++;
      if (attack.kind !== 'normal') {
        b.counters.supersPerformed++;
        b.totals.supers++;
      }
      // A supplied kill ends this branch before another attack is released.
      b.enemyAlive = attack.enemySurvives;
      if (
        attack.source !== 'potential' &&
        model.potential.additional === 'independent-per-attack-once'
      )
        b.potentialMiss *= 1 - input.skills.additional * 0.02;
    }
    branches = phase(branches, 'after-attack', attack);
    branches.forEach(removeSnapshotBuffs);
    return branches;
  };
  const attackChain = (branches: Branch[], attack: Attack): Branch[] => {
    for (const b of branches)
      if (b.alive && b.enemyAlive) b.pending.unshift({ ...attack });
    let rounds = 0;
    while (
      branches.some(
        (b) =>
          b.alive && b.enemyAlive && (b.pending.length || !b.potentialReleased),
      )
    ) {
      if (++rounds > BOUNDS.attacks + 1)
        throw new Error(
          'Attack-chain bound reached; recursive/dependent attacks are not truncated into a result.',
        );
      const next: Branch[] = [];
      for (const b of branches) {
        if (!b.alive || !b.enemyAlive) {
          b.pending = [];
          next.push(b);
          continue;
        }
        const current = b.pending.shift();
        if (current) next.push(...perform(b, current));
        else if (!b.potentialReleased) {
          b.potentialReleased = true;
          const chance =
            model.potential.additional === 'independent-per-attack-once'
              ? 1 - b.potentialMiss
              : 0;
          for (const outcome of split(b, chance)) {
            if (!outcome.success) {
              next.push(outcome.branch);
              continue;
            }
            for (const superOutcome of split(
              outcome.branch,
              model.potential.superChance,
            )) {
              superOutcome.branch.pending.push({
                source: 'potential',
                kind: superOutcome.success
                  ? model.potential.superKind
                  : 'normal',
                ki: superOutcome.success
                  ? model.potential.superKind === '18-ki'
                    ? 18
                    : model.potential.superKind === '12-ki'
                      ? 12
                      : null
                  : 0,
                enemySurvives: true,
              });
              next.push(superOutcome.branch);
            }
          }
        } else next.push(b);
      }
      branches = guard(next);
    }
    for (const b of branches) if (!b.alive || !b.enemyAlive) b.pending = [];
    return branches;
  };
  try {
    const values = input.scenario.initial.values;
    let branches: Branch[] = [
      {
        probability: 1,
        alive: input.scenario.hp === null || input.scenario.hp > 0,
        enemyAlive: true,
        hp: input.scenario.hp,
        hpPercent:
          input.scenario.hp !== null && input.scenario.maxHp !== null
            ? (input.scenario.hp / input.scenario.maxHp) * 100
            : (values.hpPercent ?? null),
        turn: values.battleTurn!,
        appearance: values.appearance!,
        counters: {
          attacksPerformed: values.attacksPerformed!,
          supersPerformed: values.supersPerformed!,
          attacksReceived: values.attacksReceived!,
          evasions: values.evasions!,
        },
        totals: { attacks: 0, supers: 0, critical: 0, evaded: 0, effective: 0 },
        buffs: [],
        attempts: {},
        activations: {},
        activated: [],
        potentialMiss: 1,
        potentialReleased: false,
        pending: [],
        trace: [],
      },
    ];
    branches = phase(branches, 'appearance-start', null);
    branches = phase(branches, 'start-of-turn', null);
    for (const action of input.scenario.actions) {
      if (action.kind === 'attack')
        branches = attackChain(branches, {
          source: 'initial',
          kind: action.attack,
          ki: action.ki,
          enemySurvives: action.enemySurvives,
        });
      else if (action.kind === 'incoming') {
        branches = phase(branches, 'before-hit', null);
        const next: Branch[] = [];
        for (const b of branches) {
          if (!b.alive || !b.enemyAlive) {
            next.push(b);
            continue;
          }
          const chance =
            input.evasionAllowed && action.evadable
              ? combinedChance(b, 'evasion')
              : 0;
          for (const outcome of split(b, chance)) {
            const value = outcome.branch;
            value.activated = value.activated.filter(
              (id) => !['event:hit', 'event:evade', 'event:guard'].includes(id),
            );
            if (outcome.success) {
              value.counters.evasions++;
              value.totals.evaded++;
              value.activated.push('event:evade');
              next.push(...phase([value], 'after-evade', null));
            } else {
              if (
                action.damageOnHit === null ||
                (action.damageOnHit > 0 && value.hp === null)
              )
                throw new Error(
                  'A hit has an unknown resolved HP/death outcome; later actions and hit effects cannot be evaluated.',
                );
              value.counters.attacksReceived++;
              value.activated.push('event:hit');
              if (action.guarded) value.activated.push('event:guard');
              if (value.hp !== null) {
                value.hp = Math.max(0, value.hp - action.damageOnHit);
                value.alive = value.hp > 0;
              }
              if (action.damageOnHit > 0)
                value.hpPercent =
                  value.hp !== null && input.scenario.maxHp !== null
                    ? (value.hp / input.scenario.maxHp) * 100
                    : null;
              if (!value.alive)
                log(
                  value,
                  'after-hit',
                  null,
                  [],
                  'Resolved lethal hit: this branch takes no further actions.',
                );
              next.push(...phase([value], 'after-hit', null));
            }
            removeSnapshotBuffs(value);
          }
        }
        branches = guard(next);
      } else {
        branches = phase(branches, 'turn-end', null);
        for (const b of branches) {
          if (!b.alive || !b.enemyAlive) continue;
          const expired = b.buffs.filter(
            (x) =>
              (x.expiresAfterTurn !== null &&
                x.expiresAfterTurn < action.battleTurn) ||
              (x.expiresAfterAppearance !== null &&
                x.expiresAfterAppearance < action.appearance),
          );
          b.buffs = b.buffs.filter((x) => !expired.includes(x));
          const newAppearance = action.appearance > b.appearance;
          b.turn = action.battleTurn;
          b.appearance = action.appearance;
          b.attempts = {};
          b.activated = [];
          b.potentialMiss = 1;
          b.potentialReleased = false;
          b.pending = [];
          if (expired.length)
            log(
              b,
              'turn-end',
              null,
              expired.map((x) => x.effectId),
              'Expired before the next supplied appearance/action.',
            );
          if (newAppearance) b.activated.push('event:new-appearance');
        }
        suppliedValues = { ...suppliedValues, ...action.values };
        const atAppearance = branches.filter(
          (b) => b.alive && b.activated.includes('event:new-appearance'),
        );
        const others = branches.filter((b) => !atAppearance.includes(b));
        branches = guard([
          ...phase(
            phase(atAppearance, 'appearance-start', null),
            'start-of-turn',
            null,
          ),
          ...others,
        ]);
      }
    }
    const mass = branches.reduce((s, b) => s + b.probability, 0);
    if (!Number.isFinite(mass) || Math.abs(mass - 1) > 1e-9)
      return unavailable([
        'Branch probability mass is not normalized; no result is retained.',
      ]);
    // Canonicalize floating summation noise without dropping small nonzero
    // results. Unrelated critical/evasion splits must not invent a tie-break.
    // Branch probabilities themselves are neither rounded nor renormalized.
    const expected = (f: (b: Branch) => number) =>
      Number(
        branches.reduce((s, b) => s + b.probability * f(b), 0).toPrecision(14),
      );
    const metrics: Record<SequenceMetric, number | null> = {
      expectedAttacks: expected((b) => b.totals.attacks),
      expectedSupers: expected((b) => b.totals.supers),
      criticalAttacks: expected((b) => b.totals.critical),
      evadedAttacks: expected((b) => b.totals.evaded),
      effectiveAttacks: expected((b) => b.totals.effective),
      attackRaise: expected((b) => raiseFactor(b, 'attack') - 1),
      defenseRaise: expected((b) => raiseFactor(b, 'defense') - 1),
    };
    for (const key of SEQUENCE_METRICS)
      if (!objectives.includes(key)) metrics[key] = null;
    return {
      status: 'evaluated',
      reasons: [],
      metrics,
      branches,
      probabilityMass: mass,
    };
  } catch (error) {
    return unavailable([
      error instanceof Error
        ? error.message
        : 'Event evaluation failed closed.',
    ]);
  }
}
