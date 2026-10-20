import type { Effect } from '../../character-definitions/domain';
import { inspectCondition } from '../../character-definitions/evaluation';
import {
  allEffects,
  EVENTS,
  SEQUENCE_METRICS,
  SEQUENCE_VERSION,
  type MechanicSupport,
  type Rule,
  type Scenario,
  type SequenceInput,
  type SequenceMetric,
  type SequenceModel,
} from './domain';

const finite = (v: number) => typeof v === 'number' && Number.isFinite(v);
const probability = (v: number) => finite(v) && v >= 0 && v <= 1;
const integer = (v: number, min: number, max: number) =>
  Number.isSafeInteger(v) && v >= min && v <= max;
export const BOUNDS = {
  rules: 64,
  effects: 128,
  actions: 16,
  branches: 4096,
  events: 50000,
  attacks: 16,
} as const;

// A reviewed exclusion binds the whole scenario, not just a user-copyable ID.
// This is a deterministic data fingerprint, not a claim to a source-page hash.
export function scenarioSignature(scenario: Scenario): string {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([k, v]) => [k, canonical(v)]),
          )
        : value;
  return JSON.stringify(canonical(scenario));
}
export const excludedFor = (
  coverage: SequenceModel['coverage'][number],
  scenario: Scenario,
) =>
  !!coverage.exclusion?.reason &&
  coverage.exclusion.scenarioIds.includes(scenario.id) &&
  coverage.exclusion.scenarioSignatures[scenario.id] ===
    scenarioSignature(scenario);

// Four distinct statuses; structural support does not admit a real card or
// establish that all effects affecting an objective have been covered.
export function inspectSequenceEffect(
  effect: Effect,
  rule: Rule | undefined,
): MechanicSupport {
  const structured = effect.representation === 'structured';
  const implemented =
    !!rule &&
    structured &&
    ((rule.operation.kind === 'additional' &&
      ['additional-attack', 'additional-super'].includes(effect.family)) ||
      (rule.operation.kind === 'raise' && effect.family === 'percent-stat') ||
      (rule.operation.kind === 'effective' &&
        effect.family === 'type-effectiveness') ||
      (rule.operation.kind === 'critical' && effect.family === 'critical') ||
      (rule.operation.kind === 'evasion' && effect.family === 'evasion'));
  const reasons: string[] = [];
  if (!structured) reasons.push('Recorded only; no structured interpretation.');
  if (!implemented)
    reasons.push(`No bound event implementation for ${effect.family}.`);
  if (!rule)
    return {
      recorded: true,
      structured,
      implemented,
      supported: false,
      reasons,
    };
  if (effect.target !== 'self')
    reasons.push('Only self effects are implemented by event-sequence-v1.');
  if (effect.timing !== rule.event)
    reasons.push('Effect timing and bound event disagree.');
  if (effect.reset || effect.stacking === 'unknown')
    reasons.push('Reset or stacking semantics are unresolved.');
  if (
    effect.duration.kind === 'other' ||
    (['turns', 'appearances'].includes(effect.duration.kind) &&
      !integer(effect.duration.count!, 1, 999))
  )
    reasons.push('A known bounded duration is required.');
  if (effect.condition.kind === 'other')
    reasons.push('Activation condition has no executable interpretation.');
  if (rule.operation.kind === 'additional') {
    if (
      !probability(rule.operation.chance) ||
      !probability(rule.operation.superChance)
    )
      reasons.push('Additional-attack probabilities must be in [0, 1].');
    if (
      !['12-ki', '18-ki', 'unspecified-super'].includes(
        rule.operation.superKind,
      )
    )
      reasons.push(
        'Additional Super kind or its explicit unknown status is required.',
      );
    if (effect.unit !== 'count' || effect.amount !== 1)
      reasons.push('One attack per admitted additional rule is required.');
    if (
      effect.duration.kind !== 'snapshot' ||
      effect.stacking !== 'once' ||
      effect.cap !== null
    )
      reasons.push(
        'Additional rules require once-per-event, snapshot semantics without a buff cap.',
      );
    if (
      !['after-attack', 'appearance-start', 'before-attack'].includes(
        rule.event,
      )
    )
      reasons.push(
        'Additional release timing is not implemented for this phase.',
      );
  } else if (rule.operation.kind === 'raise') {
    if (
      !['attack', 'defense'].includes(effect.stat!) ||
      effect.unit !== 'percent' ||
      !finite(effect.amount!) ||
      effect.amount! < 0 ||
      effect.amount! > 10000 ||
      !rule.operation.group ||
      rule.operation.group.length > 80
    )
      reasons.push(
        'A known ATK/DEF percentage and explicit arithmetic group are required.',
      );
    if (
      effect.cap !== null &&
      (!finite(effect.cap) || effect.cap < 0 || effect.cap > 10000)
    )
      reasons.push('Invalid percentage buildup cap.');
    if (effect.cap !== null && effect.stacking === 'multiplicative')
      reasons.push(
        'Multiplicative buildup with a cap needs a separate convention.',
      );
  } else if (
    rule.operation.kind === 'critical' ||
    rule.operation.kind === 'evasion'
  ) {
    if (effect.unit !== 'probability' || !probability(effect.amount!))
      reasons.push(
        'A numeric native probability is required; chance wording alone is insufficient.',
      );
    if (
      !['independent', 'additive', 'maximum'].includes(rule.operation.combine)
    )
      reasons.push('Probability overlap semantics are required.');
    if (
      effect.stacking === 'multiplicative' ||
      (effect.cap !== null && !probability(effect.cap))
    )
      reasons.push(
        'Probability stacking/cap is outside the supported contract.',
      );
    if (
      rule.operation.kind === 'critical' &&
      rule.event === 'damage-calculation'
    )
      reasons.push(
        'Critical activation at damage resolution is not implemented; properties must be established before that check.',
      );
  } else if (
    effect.unit !== 'probability' ||
    effect.amount !== 1 ||
    effect.cap !== null ||
    effect.stacking !== 'once'
  )
    reasons.push(
      'Effectiveness needs an explicit boolean guarantee. No damage multiplier is inferred.',
    );
  if (
    rule.operation.kind === 'effective' &&
    rule.event === 'damage-calculation'
  )
    reasons.push(
      'Effectiveness activation at damage resolution is not implemented; earlier activation must be explicit.',
    );
  return {
    recorded: true,
    structured,
    implemented,
    supported: reasons.length === 0,
    reasons,
  };
}

export function sequenceModelErrors(model: SequenceModel): string[] {
  const errors: string[] = [];
  if (model.schemaVersion !== SEQUENCE_VERSION)
    errors.push('Unknown event model schema version.');
  if (
    ![
      model.id,
      model.revision,
      model.stateId,
      model.cardId,
      model.dataRevision,
    ].every((v) => typeof v === 'string' && v.length > 0 && v.length <= 200)
  )
    errors.push('Exact model/state/revision identity is required.');
  const effects = allEffects(model),
    ids = effects.map((e) => e.id);
  if (
    effects.length > BOUNDS.effects ||
    model.rules.length > BOUNDS.rules ||
    model.coverage.length > BOUNDS.effects
  )
    errors.push('Event model exceeds technical size bounds.');
  if (
    new Set(ids).size !== ids.length ||
    new Set(model.rules.map((r) => r.effectId)).size !== model.rules.length ||
    new Set(model.coverage.map((r) => r.effectId)).size !==
      model.coverage.length
  )
    errors.push('Duplicate event effect, rule or coverage identity.');
  for (const rule of model.rules) {
    const effect = effects.find((e) => e.id === rule.effectId);
    if (!effect) {
      errors.push(`Rule refers to unknown effect ${rule.effectId}.`);
      continue;
    }
    if (
      !EVENTS.includes(rule.event) ||
      !integer(rule.maxAttemptsPerTurn, 1, 32) ||
      (rule.maxActivations !== null && !integer(rule.maxActivations, 1, 256))
    )
      errors.push(`Invalid event or trigger limit for ${rule.effectId}.`);
    if (
      rule.attack &&
      (!rule.attack.sources.length ||
        !rule.attack.kinds.length ||
        !rule.attack.sources.every((x) =>
          ['initial', 'native', 'potential'].includes(x),
        ) ||
        !rule.attack.kinds.every((x) =>
          ['normal', '12-ki', '18-ki'].includes(x),
        ))
    )
      errors.push(`Invalid attack filter for ${rule.effectId}.`);
    if (
      rule.attack &&
      [
        'appearance-start',
        'start-of-turn',
        'before-hit',
        'after-hit',
        'after-evade',
        'turn-end',
      ].includes(rule.event)
    )
      errors.push(`Attack filter cannot apply to ${rule.event}.`);
    errors.push(
      ...inspectSequenceEffect(effect, rule).reasons.map(
        (r) => `${rule.effectId}: ${r}`,
      ),
    );
    for (const dependency of effect.dependencies) {
      const phase =
        dependency === 'event:critical'
          ? ['damage-calculation', 'after-attack']
          : dependency === 'event:hit' || dependency === 'event:guard'
            ? ['after-hit']
            : dependency === 'event:evade'
              ? ['after-evade']
              : null;
      if (phase && !phase.includes(rule.event))
        errors.push(
          `${effect.id}: an event dependency is only valid at its own resolved phase; persistent history needs a bound effect or counter.`,
        );
    }
  }
  for (const effect of effects) {
    const coverage = model.coverage.find((c) => c.effectId === effect.id);
    if (
      !coverage ||
      !coverage.affects.length ||
      !coverage.affects.every((m) => SEQUENCE_METRICS.includes(m))
    )
      errors.push(`Missing objective coverage for ${effect.id}.`);
    if (
      coverage?.exclusion &&
      (!coverage.exclusion.reason ||
        !coverage.exclusion.scenarioIds.length ||
        coverage.exclusion.scenarioIds.some(
          (id) => !coverage.exclusion!.scenarioSignatures[id],
        ))
    )
      errors.push(
        `Reviewed exclusion for ${effect.id} needs a complete scenario fingerprint and reason.`,
      );
    if (
      model.rules.some((r) => r.effectId === effect.id) &&
      effect.dependencies.some(
        (id) =>
          !ids.includes(id) &&
          ![
            'event:hit',
            'event:evade',
            'event:guard',
            'event:critical',
          ].includes(id),
      )
    )
      errors.push(`Unknown activation dependency for ${effect.id}.`);
  }
  const visited = new Set<string>(),
    visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) {
      errors.push('Cyclic activation dependencies are not admitted.');
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const effect = effects.find((e) => e.id === id);
    for (const dependency of effect?.dependencies ?? [])
      if (
        !dependency.startsWith('event:') &&
        model.rules.some((r) => r.effectId === dependency)
      )
        visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  model.rules.forEach((r) => visit(r.effectId));
  if (model.coverage.some((c) => !ids.includes(c.effectId)))
    errors.push('Coverage refers to an unknown effect.');
  if (
    !['independent-per-attack-once', 'disabled', 'unknown'].includes(
      model.potential.additional,
    ) ||
    !['independent', 'disabled', 'unknown'].includes(
      model.potential.critical,
    ) ||
    !['independent', 'disabled', 'unknown'].includes(model.potential.evasion) ||
    !probability(model.potential.superChance) ||
    !['12-ki', '18-ki', 'unspecified-super'].includes(model.potential.superKind)
  )
    errors.push('Unknown Hidden Potential convention.');
  if (
    new Set(model.evidence.map((e) => e.id)).size !== model.evidence.length ||
    model.evidence.some((e) => !e.reference || !e.reviewedAt)
  )
    errors.push('Event rules need dated unique evidence references.');
  if (
    model.potential.evidenceIds.some(
      (id) => !model.evidence.some((e) => e.id === id),
    )
  )
    errors.push('Hidden Potential rule evidence is missing.');
  return errors;
}

export function scenarioErrors(s: Scenario): string[] {
  const errors: string[] = [];
  const ctx = s.initial;
  if (!s.id || s.id.length > 200 || s.actions.length > BOUNDS.actions)
    errors.push('Invalid scenario identity/action bound.');
  if (
    !integer(ctx.values.battleTurn!, 1, 10000) ||
    !integer(ctx.values.appearance!, 1, 1000) ||
    ctx.values.appearance! > ctx.values.battleTurn!
  )
    errors.push('Initial battle turn and appearance must be explicit.');
  if (s.hp !== null && (!finite(s.hp) || s.hp < 0 || s.hp > 1e9))
    errors.push('Invalid supplied HP.');
  if (
    s.maxHp !== null &&
    (!finite(s.maxHp) ||
      s.maxHp <= 0 ||
      s.maxHp > 1e9 ||
      (s.hp !== null && s.hp > s.maxHp))
  )
    errors.push('Invalid supplied maximum HP.');
  for (const key of [
    'attacksPerformed',
    'supersPerformed',
    'attacksReceived',
    'evasions',
  ] as const)
    if (!integer(ctx.values[key]!, 0, 1000000))
      errors.push(`Initial ${key} must be explicitly supplied.`);
  let turn = ctx.values.battleTurn!,
    appearance = ctx.values.appearance!;
  let attacked = false;
  for (const action of s.actions) {
    if (action.kind === 'advance') {
      if (
        !integer(action.battleTurn, turn + 1, 10000) ||
        !integer(action.appearance, appearance, appearance + 1) ||
        action.appearance > action.battleTurn
      )
        errors.push(
          'Advance must move battle time forward with a consistent appearance.',
        );
      if (
        Object.keys(action.values).some((k) =>
          [
            'battleTurn',
            'appearance',
            'attacksPerformed',
            'supersPerformed',
            'attacksReceived',
            'evasions',
          ].includes(k),
        )
      )
        errors.push('Later inputs cannot overwrite branch history or time.');
      turn = action.battleTurn;
      appearance = action.appearance;
      attacked = false;
    } else if (action.kind === 'attack') {
      if (attacked)
        errors.push(
          'Only one initial attack action per supplied turn is supported. Additional attacks come from bound rules.',
        );
      attacked = true;
      if (
        !['normal', '12-ki', '18-ki'].includes(action.attack) ||
        !integer(action.ki, 0, 24) ||
        (action.attack === '12-ki' && action.ki < 12) ||
        (action.attack === '18-ki' && action.ki < 18) ||
        typeof action.enemySurvives !== 'boolean'
      )
        errors.push(
          'Attack kind, Ki and resolved enemy outcome must be explicit.',
        );
    } else if (action.kind === 'incoming') {
      if (
        typeof action.evadable !== 'boolean' ||
        typeof action.guarded !== 'boolean' ||
        (action.damageOnHit !== null &&
          (!finite(action.damageOnHit) ||
            action.damageOnHit < 0 ||
            action.damageOnHit > 1e9))
      )
        errors.push('Invalid incoming attack outcome.');
    } else errors.push('Unknown sequence action.');
  }
  return errors;
}

export function inputErrors(
  model: SequenceModel,
  input: SequenceInput,
): string[] {
  const errors = [
    ...sequenceModelErrors(model),
    ...scenarioErrors(input.scenario),
  ];
  if (
    input.schemaVersion !== 1 ||
    input.modelRevision !== model.revision ||
    input.scenario.initial.state !== model.stateId
  )
    errors.push(
      'Sequence input does not bind this exact state/model revision.',
    );
  if (
    !integer(input.maxBranches, 1, BOUNDS.branches) ||
    !integer(input.maxEvents, 1, BOUNDS.events) ||
    typeof input.evasionAllowed !== 'boolean'
  )
    errors.push('Invalid event execution budget/context.');
  if (
    !integer(input.skills.additional, 0, 40) ||
    !integer(input.skills.critical, 0, 40) ||
    !integer(input.skills.evasion, 0, 40)
  )
    errors.push(
      'Skill totals must be integers from 0 to 40; this bound does not check the board.',
    );
  return errors;
}

export function requiredEffects(
  model: SequenceModel,
  scenario: Scenario,
  metrics: readonly SequenceMetric[],
): Set<string> {
  const effects = allEffects(model);
  const ids = new Set(
    model.coverage
      .filter(
        (c) =>
          c.affects.some((m) => metrics.includes(m)) &&
          !excludedFor(c, scenario),
      )
      .map((c) => c.effectId),
  );
  const hasAttacks = scenario.actions.some((a) => a.kind === 'attack');
  const needsAttacks = metrics.some((m) =>
    [
      'expectedAttacks',
      'expectedSupers',
      'criticalAttacks',
      'effectiveAttacks',
      'attackRaise',
      'defenseRaise',
    ].includes(m),
  );
  if (hasAttacks && needsAttacks)
    for (const effect of effects.filter((e) =>
      ['additional-attack', 'additional-super'].includes(e.family),
    ))
      ids.add(effect.id);
  // Zero-damage hits still change hit/evade counters and can activate effects.
  // Until counter dependencies are inferred, include native evasion for every
  // incoming sequence. Explicit scenario exclusions remain authoritative.
  const hasIncoming = scenario.actions.some((a) => a.kind === 'incoming');
  const incomingChangesBranch = scenario.actions.some(
    (a) => a.kind === 'incoming' && a.damageOnHit !== 0,
  );
  if (hasIncoming || metrics.includes('evadedAttacks'))
    for (const effect of effects.filter((e) => e.family === 'evasion')) {
      const coverage = model.coverage.find((c) => c.effectId === effect.id);
      if (!coverage || !excludedFor(coverage, scenario)) ids.add(effect.id);
    }
  if (incomingChangesBranch)
    for (const effect of effects.filter((e) => e.family === 'revival')) {
      const coverage = model.coverage.find((c) => c.effectId === effect.id);
      if (!coverage || !excludedFor(coverage, scenario)) ids.add(effect.id);
    }
  if (metrics.includes('criticalAttacks'))
    for (const effect of effects.filter((e) => e.family === 'critical'))
      ids.add(effect.id);
  let changed = true;
  while (changed) {
    changed = false;
    for (const effect of effects.filter((e) => ids.has(e.id))) {
      for (const dependency of effect.dependencies)
        if (!dependency.startsWith('event:') && !ids.has(dependency)) {
          ids.add(dependency);
          changed = true;
        }
      // Event dependencies also have providers. A count objective depending
      // on a critical must not run with native critical effects omitted.
      if (effect.dependencies.includes('event:critical'))
        for (const provider of effects.filter((e) => e.family === 'critical')) {
          const coverage = model.coverage.find(
            (c) => c.effectId === provider.id,
          );
          if (
            (!coverage || !excludedFor(coverage, scenario)) &&
            !ids.has(provider.id)
          ) {
            ids.add(provider.id);
            changed = true;
          }
        }
    }
  }
  return ids;
}

export function sequenceObjectiveGates(
  model: SequenceModel,
  scenario: Scenario,
  metric: SequenceMetric,
): string[] {
  const gates = [...sequenceModelErrors(model), ...scenarioErrors(scenario)];
  const effects = allEffects(model);
  const required = requiredEffects(model, scenario, [metric]);
  for (const id of required) {
    const effect = effects.find((e) => e.id === id);
    if (!effect) {
      gates.push(`Required activation dependency ${id} is not implemented.`);
      continue;
    }
    const coverage = model.coverage.find((c) => c.effectId === id);
    if (!model.rules.some((r) => r.effectId === effect.id))
      gates.push(
        `${effect.label}: ${coverage?.reason || 'No event implementation is bound.'}`,
      );
    // A top-level unknown condition can only be excluded by a reviewed scope.
    if (
      effect.condition.kind === 'other' &&
      inspectCondition(effect.condition, scenario.initial).state === 'unknown'
    )
      gates.push(`${effect.label}: activation remains unknown.`);
  }
  const rules = model.potential;
  if (
    [
      'attackRaise',
      'defenseRaise',
      'criticalAttacks',
      'effectiveAttacks',
    ].includes(metric) &&
    (model.rules.some(
      (r) =>
        r.operation.kind === 'additional' &&
        r.operation.superKind === 'unspecified-super',
    ) ||
      (rules.additional === 'independent-per-attack-once' &&
        rules.superKind === 'unspecified-super'))
  )
    gates.push(
      'The additional-Super variant is unresolved and can change this objective; no 12-Ki/18-Ki effect is substituted.',
    );
  if (
    [
      'expectedAttacks',
      'expectedSupers',
      'attackRaise',
      'defenseRaise',
      'criticalAttacks',
      'effectiveAttacks',
    ].includes(metric) &&
    rules.additional === 'unknown'
  )
    gates.push('Hidden Potential attack-chain check ordering is not admitted.');
  if (metric === 'criticalAttacks' && rules.critical === 'unknown')
    gates.push('Native/Hidden Potential critical overlap is unknown.');
  if (metric === 'evadedAttacks' && rules.evasion === 'unknown')
    gates.push('Native/Hidden Potential evasion overlap is unknown.');
  if (
    effects.some(
      (e) => required.has(e.id) && e.dependencies.includes('event:critical'),
    ) &&
    rules.critical === 'unknown'
  )
    gates.push(
      'A critical-dependent effect needs the unresolved critical overlap convention.',
    );
  if (
    scenario.actions.some((a) => a.kind === 'incoming' && a.evadable) &&
    rules.evasion === 'unknown'
  )
    gates.push(
      'Incoming hit/evade events depend on unresolved evasion overlap, even when supplied damage is zero.',
    );
  return [...new Set(gates)];
}
