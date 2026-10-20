import {
  AVAILABLE_METRICS,
  SKILLS,
  SLOTS,
  type Build,
  type BuildRequest,
  type CharacterCatalog,
  type EvaluatorEntry,
  type Orb,
  type Restriction,
  type Slot,
} from './domain';
import { evaluatorFor, objectivesFor } from './execution';
import { scenarioErrors, sequenceModelErrors } from './mechanics/support';
import { allEffects } from './mechanics/domain';
import { CUSTOM_PROFILE_ID, ROUTES, customPotentialErrors } from './allocation';

const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
const sameSet = (a: string[], b: string[]) =>
  new Set(a).size === a.length &&
  new Set(b).size === b.length &&
  a.length === b.length &&
  a.every((id) => b.includes(id));

function restrictionError(
  rule: Restriction,
  catalog: CharacterCatalog,
): string | null {
  switch (rule.kind) {
    case 'type':
      return rule.value === catalog.card.type
        ? null
        : `restricted to type ${rule.value}.`;
    case 'category':
      return catalog.card.categories.includes(rule.value)
        ? null
        : `requires documented category ${rule.value}.`;
    case 'cardState':
      return rule.value === catalog.card.id
        ? null
        : `restricted to character state ${rule.value}.`;
    case 'unsupported':
      return `unsupported requirement: ${rule.description}.`;
    default:
      return 'unknown restriction; compatibility cannot be established.';
  }
}

export function orbErrors(
  orb: Orb,
  slot: Slot,
  request: BuildRequest,
  catalog: CharacterCatalog,
): string[] {
  const errors: string[] = [];
  if (orb.support !== 'supported')
    errors.push(`${orb.label}: unsupported item.`);
  if (!orb.slots.includes(slot)) errors.push(`${orb.label}: wrong equip slot.`);
  if (request.superAttackLevel < orb.minSuperAttackLevel)
    errors.push(`${orb.label}: requires SA ${orb.minSuperAttackLevel}.`);
  const requiredRoutes = Math.max(orb.minRoutes, slot === 'gold' ? 2 : 0);
  if (request.progression.routes.length < requiredRoutes)
    errors.push(`${orb.label}: requires ${requiredRoutes} unlocked routes.`);
  if (slot === 'silver' && request.superAttackLevel < 10)
    errors.push('Silver slot requires SA 10.');
  if (!['UR', 'LR'].includes(catalog.card.rarity))
    errors.push('UR/LR required.');
  for (const rule of orb.restrictions) {
    const reason = restrictionError(rule, catalog);
    if (reason) errors.push(`${orb.label}: ${reason}`);
  }
  for (const [key, value] of Object.entries(orb.stats)) {
    if (!['hp', 'attack', 'defense'].includes(key) || !integer(value))
      errors.push(`${orb.label}: unknown or invalid stat effect.`);
  }
  for (const [key, value] of Object.entries(orb.skills)) {
    if (!(SKILLS as readonly string[]).includes(key) || !integer(value))
      errors.push(`${orb.label}: unknown or invalid skill effect.`);
  }
  if (!integer(orb.minRoutes) || !integer(orb.minSuperAttackLevel))
    errors.push(`${orb.label}: invalid prerequisites.`);
  if (!orb.evidenceIds.length) errors.push(`${orb.label}: missing evidence.`);
  return errors;
}

export function equipCounts(build: Build): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const slot of SLOTS) {
    const id = build.equips[slot];
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export function missingInventory(build: Build, request: BuildRequest) {
  // An ordinary attached item can be retained in place. It is not a free copy
  // that can be unequipped/reused elsewhere; EX transfer economics are deferred.
  const retained: Record<string, number> = {};
  for (const slot of SLOTS) {
    const id = build.equips[slot];
    if (id && request.current.equips[slot] === id)
      retained[id] = (retained[id] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(equipCounts(build))
      .map(([id, needed]) => [
        id,
        Math.max(
          0,
          needed - (request.inventory[id] ?? 0) - (retained[id] ?? 0),
        ),
      ])
      .filter(([, count]) => Number(count) > 0),
  ) as Record<string, number>;
}

export function buildErrors(
  build: Build,
  request: BuildRequest,
  catalog: CharacterCatalog,
  enforceInventory = request.mode === 'inventory',
): string[] {
  const errors: string[] = [];
  const active = request.progression.activatedNodes;
  if (!sameSet(Object.keys(build.choices), active))
    errors.push('Choose exactly one option for every activated choice node.');
  for (const id of active) {
    const node = catalog.profile.nodes.find((n) => n.id === id);
    if (!node || !node.options.includes(build.choices[id]!))
      errors.push(`Unknown or unsupported choice at ${id}.`);
  }
  if (!sameSet(Object.keys(build.equips), [...SLOTS]))
    errors.push('Exactly bronze, silver and gold slots are required.');
  for (const slot of SLOTS) {
    const id = build.equips[slot];
    if (id === null) continue;
    const orb = catalog.orbs.find((o) => o.id === id);
    if (!orb) errors.push(`Unknown equip in ${slot}: ${id}.`);
    else errors.push(...orbErrors(orb, slot, request, catalog));
  }
  if (enforceInventory && Object.keys(missingInventory(build, request)).length)
    errors.push('Insufficient unequipped inventory/current copies.');
  return errors;
}

// Entry-level checks: the entry binds ONE exact state to its model, contexts
// and objectives. Nothing here falls back to another entry or state.
export function entryErrors(entry: EvaluatorEntry): string[] {
  const errors: string[] = [];
  const { model } = entry;
  if (
    model.card.id !== entry.stateId ||
    model.profile.cardStateId !== entry.stateId
  )
    errors.push(
      `Evaluator ${entry.id} is inconsistent: its data does not describe state ${entry.stateId}.`,
    );
  if (
    !entry.objectives.length ||
    new Set(entry.objectives).size !== entry.objectives.length ||
    !entry.objectives.every((m) => AVAILABLE_METRICS.includes(m))
  )
    errors.push(`Evaluator ${entry.id} declares no valid objectives.`);
  if (
    !entry.contexts.length ||
    new Set(entry.contexts.map((c) => c.id)).size !== entry.contexts.length ||
    !entry.contexts.every(
      (c) =>
        c.evasionOptions.length > 0 &&
        c.evasionOptions.every((o) => typeof o === 'boolean'),
    )
  )
    errors.push(`Evaluator ${entry.id} declares no valid contexts.`);
  errors.push(...(entry.evaluator.entryErrors?.(entry) ?? []));
  if (entry.sequence) {
    const { model: events, scenarios, evaluator, objectives } = entry.sequence;
    if (evaluator.version !== String(events.schemaVersion))
      errors.push('The event context must pin its evaluator schema/version.');
    if (
      events.stateId !== entry.stateId ||
      events.cardId !== entry.catalogCardId ||
      events.dataRevision !== model.revision
    )
      errors.push('Event model must bind the exact card/state/data revision.');
    if (
      !scenarios.length ||
      new Set(scenarios.map((s) => s.id)).size !== scenarios.length ||
      !objectives.length ||
      new Set(objectives).size !== objectives.length ||
      !objectives.every(
        (m) => AVAILABLE_METRICS.includes(m) && evaluator.objectiveModels[m],
      )
    )
      errors.push('Event scenarios/objectives are missing or ambiguous.');
    if (
      allEffects(events).some(
        (effect) =>
          effect.source.status !== 'source-documented' ||
          !events.evidence.some((e) => e.reference === effect.source.reference),
      )
    )
      errors.push(
        'Registered event effects require field-level dated source references.',
      );
    errors.push(...sequenceModelErrors(events));
    for (const scenario of scenarios) {
      errors.push(...scenarioErrors(scenario));
      if (scenario.initial.state !== entry.stateId)
        errors.push('Event scenario names another state.');
    }
    errors.push(...(evaluator.entryErrors?.(entry) ?? []));
  }
  return errors;
}

export function requestErrors(
  request: BuildRequest,
  entry: EvaluatorEntry,
): string[] {
  const catalog = entry.model;
  const errors: string[] = entryErrors(entry);
  if (
    catalog.card.support !== 'supported' ||
    catalog.profile.support !== 'supported'
  )
    errors.push('Card/profile support is unavailable.');
  if (
    ![catalog.card.baseStats, catalog.profile.statBonus].every(
      (stats) =>
        Object.values(stats).every(integer) &&
        sameSet(Object.keys(stats), ['hp', 'attack', 'defense']),
    ) ||
    !sameSet(Object.keys(catalog.profile.fixedSkills), [...SKILLS]) ||
    !SKILLS.every((skill) => integer(catalog.profile.fixedSkills[skill]))
  )
    errors.push('Invalid or unsupported card/profile facts.');
  if (
    request.cardStateId !== entry.stateId ||
    request.level !== catalog.card.level ||
    request.superAttackLevel !== catalog.card.superAttackLevel
  )
    errors.push(
      `Settings are for ${request.cardStateId} (Lv.${request.level}/SA${request.superAttackLevel}), not ${entry.stateId}; exact states (including EZA and SEZA) are never substituted.`,
    );
  if (request.customPotential) {
    // User-entered totals replace the documented profile; board requirements
    // are not checked, so the evaluator must accept such input explicitly.
    if (!evaluatorFor(entry, request)?.customPotential)
      errors.push('This evaluator cannot use your own potential values.');
    if (request.progression.profileId !== CUSTOM_PROFILE_ID)
      errors.push('Your own potential values need the custom progression.');
    if (request.progression.activatedNodes.length)
      errors.push(
        'Your own potential values already include every node; none can be activated separately.',
      );
    if (
      new Set(request.progression.routes).size !==
        request.progression.routes.length ||
      !request.progression.routes.every((r) => ROUTES.includes(r))
    )
      errors.push('Unknown or duplicate unlocked route.');
    errors.push(...customPotentialErrors(request.customPotential));
  } else if (
    request.progression.profileId !== catalog.profile.id ||
    !sameSet(request.progression.routes, catalog.profile.routes)
  )
    errors.push(
      'Unsupported progression: only the catalog profile is admitted.',
    );
  if (request.progression.systemUnlocked !== true)
    errors.push(
      'Hidden Potential must already be unlocked. Unlock/investment costs are not modeled.',
    );
  const nodes = catalog.profile.nodes;
  if (nodes.length > 8 || new Set(nodes.map((n) => n.id)).size !== nodes.length)
    errors.push('Unsupported or duplicate choice graph.');
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function cyclic(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    if (nodes.find((node) => node.id === id)?.prerequisites.some(cyclic))
      return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  if (nodes.some((node) => cyclic(node.id)))
    errors.push('Cyclic choice prerequisites are unsupported.');
  if (
    new Set(request.progression.activatedNodes).size !==
    request.progression.activatedNodes.length
  )
    errors.push('Duplicate activated node.');
  for (const id of request.progression.activatedNodes) {
    const node = nodes.find((n) => n.id === id);
    if (
      !node ||
      node.support !== 'supported' ||
      !node.evidenceIds.length ||
      !integer(node.levels) ||
      node.levels === 0 ||
      !node.options.length ||
      new Set(node.options).size !== node.options.length ||
      !node.options.every((s) => SKILLS.includes(s)) ||
      !request.progression.routes.includes(node.route) ||
      request.superAttackLevel < node.minSuperAttackLevel ||
      !node.prerequisites.every((p) =>
        request.progression.activatedNodes.includes(p),
      )
    )
      errors.push(`Unsupported node or unmet prerequisite: ${id}.`);
  }
  const context = request.context;
  const definition = entry.contexts.find((c) => c.id === context.id);
  if (context.id === 'event-sequence-v1') {
    if (
      !sameSet(Object.keys(context), [
        'id',
        'modelRevision',
        'scenarioId',
        'evasionAllowed',
      ]) ||
      !entry.sequence ||
      context.modelRevision !== entry.sequence.model.revision ||
      !entry.sequence.scenarios.some((s) => s.id === context.scenarioId) ||
      typeof context.evasionAllowed !== 'boolean'
    )
      errors.push(
        'Unsupported event context: exact model revision and reviewed scenario are required.',
      );
  } else if (
    !sameSet(Object.keys(context), [
      'id',
      'battleTurn',
      'appearance',
      'initialAttack',
      'externalEffects',
      'evasionAllowed',
    ]) ||
    context.id !== 'initial-check-v1' ||
    !definition ||
    context.battleTurn !== 1 ||
    context.appearance !== 1 ||
    context.initialAttack !== 'super' ||
    context.externalEffects !== 'none' ||
    typeof context.evasionAllowed !== 'boolean'
  )
    errors.push(
      'Unsupported context: only the initial eligible check without external effects is modeled.',
    );
  else if (!definition.evasionOptions.includes(context.evasionAllowed))
    errors.push(
      `Unsupported context option: evasion ${context.evasionAllowed ? 'allowed' : 'disabled'} is not declared for this evaluator.`,
    );
  if (request.mode !== 'inventory' && request.mode !== 'catalog')
    errors.push('Unknown equipment mode.');
  // Only objectives this entry offers; a metric unsupported here is never
  // ranked even if another evaluator supports it.
  if (!objectivesFor(entry, request).includes(request.objective))
    errors.push('Unsupported objective.');
  if (
    !request.frontierMetrics.length ||
    new Set(request.frontierMetrics).size !== request.frontierMetrics.length ||
    !request.frontierMetrics.every((m) =>
      objectivesFor(entry, request).includes(m),
    )
  )
    errors.push('Select distinct supported frontier metrics.');
  if (
    !Number.isSafeInteger(request.maxCandidates) ||
    request.maxCandidates < 1 ||
    request.maxCandidates > 20000
  )
    errors.push('Search limit must be an integer from 1 to 20000.');
  if (new Set(catalog.orbs.map((o) => o.id)).size !== catalog.orbs.length)
    errors.push('Duplicate catalog item IDs.');
  for (const [id, count] of Object.entries(request.inventory)) {
    if (
      !catalog.orbs.some((o) => o.id === id) ||
      !integer(count) ||
      count > 999
    )
      errors.push(`Unknown item or invalid inventory quantity: ${id}.`);
  }
  errors.push(...buildErrors(request.current, request, catalog, false));
  return errors;
}
