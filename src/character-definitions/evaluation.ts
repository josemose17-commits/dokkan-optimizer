import {
  CONTEXT_FIELDS,
  SLOTS,
  STATS,
  type CharacterDefinition,
  type Condition,
  type Configuration,
  type DefinitionDocument,
  type Effect,
  type Equipment,
  type SnapshotContext,
  type Stat,
  type Values,
} from './domain';

export interface ConditionTrace {
  state: 'met' | 'unmet' | 'unknown';
  reason: string;
  children: ConditionTrace[];
}
const result = (
  state: ConditionTrace['state'],
  reason: string,
  children: ConditionTrace[] = [],
): ConditionTrace => ({ state, reason, children });
export function inspectCondition(
  condition: Condition,
  context: SnapshotContext,
): ConditionTrace {
  if (condition.kind === 'always') return result('met', 'Unconditional.');
  if (condition.kind === 'other')
    return result(
      'unknown',
      `Recorded condition has no implementation: ${condition.description}`,
    );
  if (condition.kind === 'all' || condition.kind === 'any') {
    const children = condition.children.map((c) =>
      inspectCondition(c, context),
    );
    const states = children.map((c) => c.state);
    const state =
      condition.kind === 'all'
        ? states.includes('unmet')
          ? 'unmet'
          : states.includes('unknown')
            ? 'unknown'
            : 'met'
        : states.includes('met')
          ? 'met'
          : states.includes('unknown')
            ? 'unknown'
            : 'unmet';
    return result(
      state,
      `${condition.kind === 'all' ? 'AND' : 'OR'} condition (${state}).`,
      children,
    );
  }
  if (condition.kind === 'state')
    return context.state === null
      ? result(
          'unknown',
          `Current form/state is unknown; requires ${condition.value}.`,
        )
      : result(
          context.state === condition.value ? 'met' : 'unmet',
          `Manually specified state ${context.state}; requires ${condition.value}.`,
        );
  if (condition.kind === 'ally') {
    const entry = context.allies.find(
      (a) =>
        a.scope === condition.scope &&
        a.includeSelf === condition.includeSelf &&
        a.match === condition.match &&
        a.value === condition.value,
    );
    const label = `${condition.scope}, ${condition.includeSelf ? 'self included' : 'other allies only'}, ${condition.match} “${condition.value}”`;
    return entry?.count == null
      ? result('unknown', `Matching ally count unknown (${label}).`)
      : result(
          entry.count >= condition.minimum ? 'met' : 'unmet',
          `Manual count ${entry.count} ≥ ${condition.minimum} (${label}).`,
        );
  }
  const value = context.values[condition.field];
  if (value == null)
    return result(
      'unknown',
      `${CONTEXT_FIELDS[condition.field].label} is unspecified.`,
    );
  const expected = condition.value;
  const met =
    condition.operator === '>='
      ? value >= expected
      : condition.operator === '>'
        ? value > expected
        : condition.operator === '='
          ? value === expected
          : condition.operator === '<='
            ? value <= expected
            : value < expected;
  return result(
    met ? 'met' : 'unmet',
    `Manual ${CONTEXT_FIELDS[condition.field].label}: ${value} ${condition.operator} ${expected} is ${met ? 'true' : 'false'}.`,
  );
}
export const CAPABILITIES = {
  'flat-stat': {
    id: 'manual-flat-snapshot-v1',
    description:
      'Integer flat additions to self at one explicitly selected snapshot. Add each active record once. This is an authored arithmetic model, not a verified Dokkan battle formula.',
  },
} as const;
export interface EffectSupport {
  recorded: true;
  structured: boolean;
  implemented: boolean;
  supported: boolean;
  reasons: string[];
  condition: ConditionTrace;
}
export function inspectEffect(
  effect: Effect,
  context: SnapshotContext,
): EffectSupport {
  const structured = effect.representation === 'structured',
    implemented = structured && effect.family === 'flat-stat';
  const reasons: string[] = [];
  if (!structured)
    reasons.push(
      'Ability recorded only; no structured interpretation selected.',
    );
  else if (!implemented) reasons.push(`No calculation for ${effect.family}.`);
  if (effect.target !== 'self')
    reasons.push(
      `Recipient ${effect.target} is recorded; only self additions are evaluated.`,
    );
  if (effect.stat === null || effect.amount === null || effect.unit !== 'flat')
    reasons.push('A known stat and integer flat amount are required.');
  if (
    effect.timing === 'other' ||
    (effect.timing !== 'snapshot' && effect.timing !== context.phase)
  )
    reasons.push(
      `Timing ${effect.timing} is outside the selected ${context.phase} snapshot; no event history is simulated.`,
    );
  if (effect.duration.kind !== 'snapshot')
    reasons.push(
      `Duration ${effect.duration.kind} needs history that is not modeled.`,
    );
  if (
    effect.stacking !== 'once' ||
    effect.cap !== null ||
    effect.reset ||
    effect.dependencies.length
  )
    reasons.push(
      'Stacking, cap, reset or dependencies require an unavailable implementation.',
    );
  const condition = inspectCondition(effect.condition, context);
  if (condition.state === 'unknown')
    reasons.push('Activation cannot be established from the supplied context.');
  return {
    recorded: true,
    structured,
    implemented,
    supported: reasons.length === 0,
    reasons,
    condition,
  };
}
export function equipmentChecks(
  item: Equipment,
  slot: (typeof SLOTS)[number],
  definition: CharacterDefinition,
  build: Configuration,
): string[] {
  const errors: string[] = [];
  if (item.slot !== slot)
    errors.push(`Slot mismatch: ${item.name} belongs in ${item.slot}.`);
  if (build.slots[slot] !== 'available')
    errors.push(
      `${slot} slot ${build.slots[slot] === 'unavailable' ? 'unavailable' : 'availability unknown'}.`,
    );
  for (const rule of item.requirements) {
    if (rule.kind === 'other')
      errors.push(`Unsupported requirement: ${rule.description}`);
    else if (rule.kind === 'type' && definition.type !== rule.value)
      errors.push(
        definition.type === null
          ? 'Character type unknown.'
          : `Character type restriction not met: ${rule.value}.`,
      );
    else if (
      rule.kind === 'category' &&
      !definition.categories?.includes(rule.value)
    )
      errors.push(
        definition.categories === null
          ? 'Character categories unknown.'
          : `Character category restriction not met: ${rule.value}.`,
      );
    else if (rule.kind === 'state' && definition.id !== rule.value)
      errors.push('Exact character state restriction not met.');
    else if (
      rule.kind === 'routes' &&
      (build.unlockedRoutes === null || build.unlockedRoutes < rule.minimum)
    )
      errors.push(
        `Requires ${rule.minimum} unlocked routes; ${build.unlockedRoutes === null ? 'count unknown' : `${build.unlockedRoutes} entered`}.`,
      );
    else if (
      rule.kind === 'sa' &&
      (definition.superAttackLevel === null ||
        definition.superAttackLevel < rule.minimum)
    )
      errors.push(
        `Requires SA level ${rule.minimum}; requirement not established.`,
      );
  }
  return errors;
}
const safeSum = (values: (number | null)[]) => {
  if (values.some((v) => v === null)) return null;
  const total = (values as number[]).reduce((a, b) => a + b, 0);
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
};
const mapStats = (f: (stat: Stat) => number | null): Values => ({
  hp: f('hp'),
  attack: f('attack'),
  defense: f('defense'),
});
export interface StatTrace {
  layer: 'raw' | 'potential' | 'equipment' | 'effect';
  label: string;
  stat: Stat;
  value: number | null;
  effectId: string | null;
}
export interface DefinitionEvaluation {
  configurationId: string;
  key: string;
  equipmentProblems: string[];
  layers: {
    raw: Values;
    potential: Values;
    equipment: Values;
    preEffect: Values;
    modeled: Values;
  };
  skills: {
    additional: number | null;
    critical: number | null;
    evasion: number | null;
  };
  effects: {
    id: string;
    name: string;
    ability: string;
    support: EffectSupport;
  }[];
  unstructuredAbilities: string[];
  trace: StatTrace[];
  unavailable: string[];
}
/** Pure: consumes any validated definition, with no data imports or fallback. */
export function evaluateDefinition(
  doc: DefinitionDocument,
  build: Configuration,
): DefinitionEvaluation {
  const d = doc.definition;
  const equipmentProblems: string[] = [],
    equipped: Equipment[] = [];
  for (const slot of SLOTS) {
    const id = build.equips[slot];
    if (id === null) continue;
    const item = doc.equipment.find((e) => e.id === id);
    if (!item) equipmentProblems.push(`Unknown equipment ${id}.`);
    else {
      equipmentProblems.push(...equipmentChecks(item, slot, d, build));
      equipped.push(item);
    }
  }
  const trace: StatTrace[] = [];
  for (const stat of STATS) {
    trace.push({
      layer: 'raw',
      label: 'Raw character value',
      stat,
      value: d.rawStats[stat],
      effectId: null,
    });
    trace.push({
      layer: 'potential',
      label:
        'Custom Hidden Potential addition — board compatibility not checked',
      stat,
      value: build.potentialStats[stat],
      effectId: null,
    });
    for (const item of equipped)
      trace.push({
        layer: 'equipment',
        label: item.name,
        stat,
        value: item.stats[stat],
        effectId: null,
      });
  }
  const equipment = mapStats((stat) =>
    equipmentProblems.length
      ? null
      : safeSum(equipped.map((e) => e.stats[stat])),
  );
  const preEffect = mapStats((stat) =>
    safeSum([d.rawStats[stat], build.potentialStats[stat], equipment[stat]]),
  );
  const effects = d.abilities.flatMap((a) =>
    a.effects.map((e) => ({
      id: e.id,
      name: e.label,
      ability: a.name,
      support: inspectEffect(e, doc.context),
      effect: e,
    })),
  );
  const unstructuredAbilities = d.abilities
    .filter((a) => a.effects.length === 0)
    .map((a) => a.name);
  unstructuredAbilities.push(
    ...equipped
      .filter((e) => e.otherEffects.trim())
      .map((e) => `Equipment ${e.name}: ${e.otherEffects}`),
  );
  const modeled = mapStats((stat) => {
    const additions: (number | null)[] = [preEffect[stat]];
    if (unstructuredAbilities.length) additions.push(null);
    for (const entry of effects) {
      const { effect, support } = entry;
      if (support.condition.state === 'unmet') continue;
      // Other/unknown records may affect any stat. Never hide their omission.
      if (
        effect.family === 'other' ||
        effect.stat === stat ||
        effect.stat === null
      ) {
        if (!support.supported) additions.push(null);
        else if (effect.stat === stat) {
          additions.push(effect.amount);
          trace.push({
            layer: 'effect',
            label: `${entry.ability}: ${entry.name}`,
            stat,
            value: effect.amount,
            effectId: effect.id,
          });
        }
      }
    }
    return safeSum(additions);
  });
  const skills = {
    additional: safeSum([
      build.skills.additional,
      ...equipped.map((e) => e.skills.additional),
    ]),
    critical: safeSum([
      build.skills.critical,
      ...equipped.map((e) => e.skills.critical),
    ]),
    evasion: safeSum([
      build.skills.evasion,
      ...equipped.map((e) => e.skills.evasion),
    ]),
  };
  if (equipmentProblems.length)
    skills.additional = skills.critical = skills.evasion = null;
  return {
    configurationId: build.id,
    key: JSON.stringify([
      d,
      doc.equipment,
      doc.context,
      'manual-flat-snapshot-v1',
    ]),
    equipmentProblems,
    layers: {
      raw: d.rawStats,
      potential: build.potentialStats,
      equipment,
      preEffect,
      modeled,
    },
    skills,
    effects: effects.map(({ effect: _effect, ...entry }) => entry),
    unstructuredAbilities,
    trace,
    unavailable: [
      'Damage and battle-modifier stages',
      'Critical/AA/evasion probabilities for authored definitions',
      'Battle DEF, survival and clear-rate estimates',
      'Full-turn attack chains and event history',
    ],
  };
}
export type ComparisonMetric = `preEffect.${Stat}` | `modeled.${Stat}`;
export const COMPARISON_METRICS: ComparisonMetric[] = STATS.flatMap(
  (s) => [`preEffect.${s}`, `modeled.${s}`] as ComparisonMetric[],
);
export function metricValue(
  e: DefinitionEvaluation,
  metric: ComparisonMetric,
): number | null {
  const [layer, stat] = metric.split('.') as ['preEffect' | 'modeled', Stat];
  return e.layers[layer][stat];
}

export function configurationChanges(
  build: Configuration,
  current: Configuration,
  equipment: Equipment[],
): string[] {
  const changes: string[] = [];
  const value = (n: number | null) => (n === null ? 'unknown' : String(n));
  for (const stat of STATS)
    if (build.potentialStats[stat] !== current.potentialStats[stat])
      changes.push(
        `Potential ${stat}: ${value(current.potentialStats[stat])} → ${value(build.potentialStats[stat])}.`,
      );
  for (const skill of ['additional', 'critical', 'evasion'] as const)
    if (build.skills[skill] !== current.skills[skill])
      changes.push(
        `${skill} level: ${value(current.skills[skill])} → ${value(build.skills[skill])}.`,
      );
  const item = (id: string | null) =>
    id === null ? 'none' : (equipment.find((e) => e.id === id)?.name ?? id);
  for (const slot of SLOTS) {
    if (build.equips[slot] !== current.equips[slot])
      changes.push(
        `${slot} equipment: ${item(current.equips[slot])} → ${item(build.equips[slot])}.`,
      );
    if (build.slots[slot] !== current.slots[slot])
      changes.push(
        `${slot} availability assertion: ${current.slots[slot]} → ${build.slots[slot]}.`,
      );
  }
  if (build.unlockedRoutes !== current.unlockedRoutes)
    changes.push(
      `Unlocked routes assertion: ${value(current.unlockedRoutes)} → ${value(build.unlockedRoutes)}.`,
    );
  if (build.notes !== current.notes)
    changes.push(`Build notes differ: ${build.notes || '(empty)'}.`);
  return changes.length
    ? changes
    : ['Same entered choices as the current build.'];
}
export function compareDefinitions(
  doc: DefinitionDocument,
  metrics: ComparisonMetric[],
  limit = 30,
) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 30)
    throw new Error('Comparison limit must be 1–30.');
  const current = doc.configurations.find((b) => b.id === doc.baselineId);
  if (!current) throw new Error('Current configuration is missing.');
  const baseline = evaluateDefinition(doc, current);
  const candidates = doc.configurations
    .slice(0, limit)
    .map((b) => ({ build: b, evaluation: evaluateDefinition(doc, b) }));
  const common = [...new Set(metrics)].filter(
    (m) =>
      COMPARISON_METRICS.includes(m) &&
      metricValue(baseline, m) !== null &&
      candidates.every((c) => metricValue(c.evaluation, m) !== null),
  );
  const groups: {
    evaluation: DefinitionEvaluation;
    alternatives: Configuration[];
    frontier: boolean;
    deltas: Record<
      string,
      { absolute: number; relative: number | null } | null
    >;
  }[] = [];
  const equivalent = new Map<string, (typeof groups)[number]>();
  for (const candidate of candidates) {
    const signature = JSON.stringify([
      candidate.evaluation.key,
      candidate.evaluation.layers,
      candidate.evaluation.skills,
      candidate.evaluation.equipmentProblems,
      candidate.evaluation.effects,
      candidate.evaluation.unstructuredAbilities,
    ]);
    const existing = equivalent.get(signature);
    if (existing) existing.alternatives.push(candidate.build);
    else {
      const group: (typeof groups)[number] = {
        evaluation: candidate.evaluation,
        alternatives: [candidate.build],
        frontier: false,
        deltas: Object.fromEntries(
          COMPARISON_METRICS.map((m) => {
            const a = metricValue(candidate.evaluation, m),
              b = metricValue(baseline, m);
            return [
              m,
              a === null || b === null
                ? null
                : { absolute: a - b, relative: b === 0 ? null : (a - b) / b },
            ];
          }),
        ),
      };
      groups.push(group);
      equivalent.set(signature, group);
    }
  }
  const pool = [baseline, ...candidates.map((c) => c.evaluation)];
  for (const group of groups)
    group.frontier =
      common.length > 0 &&
      !pool.some(
        (e) =>
          common.every(
            (m) => metricValue(e, m)! >= metricValue(group.evaluation, m)!,
          ) &&
          common.some(
            (m) => metricValue(e, m)! > metricValue(group.evaluation, m)!,
          ),
      );
  return {
    baseline,
    groups,
    common,
    omitted: metrics.filter((m) => !common.includes(m)),
    search: {
      compared: candidates.length,
      available: doc.configurations.length,
      limit,
      truncated: candidates.length < doc.configurations.length,
    },
    context: doc.context,
  };
}

export function requiredConditions(doc: DefinitionDocument): Condition[] {
  const list: Condition[] = [];
  const visit = (c: Condition) => {
    if (c.kind === 'all' || c.kind === 'any') c.children.forEach(visit);
    else if (c.kind !== 'always' && c.kind !== 'other') list.push(c);
  };
  doc.definition.abilities.forEach((a) =>
    a.effects.forEach((e) => visit(e.condition)),
  );
  return list;
}
