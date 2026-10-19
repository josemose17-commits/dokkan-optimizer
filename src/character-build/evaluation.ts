import {
  SLOTS,
  type Build,
  type BuildRequest,
  type CalculationTrace,
  type Contribution,
  type Evaluation,
  type EvaluatorEntry,
  type EvaluatorImplementation,
  type Metric,
  type Metrics,
  type ProbabilityStep,
  type Skill,
  type Skills,
  type Stats,
} from './domain';
import { potentialContributions } from './allocation';
import { buildErrors, requestErrors } from './legality';

export function hiddenPotentialChance(level: number, skill: Skill): number {
  const p = level * (skill === 'evasion' ? 0.01 : 0.02);
  if (!Number.isSafeInteger(level) || level < 0 || p > 1)
    throw new Error('Invalid probability level; do not clamp illegal input.');
  return p;
}

// Probability arithmetic only; this does not assert that two game effects are independent.
export function independentChecks(a: number, b: number): number {
  if (![a, b].every((p) => Number.isFinite(p) && p >= 0 && p <= 1))
    throw new Error('Probabilities must lie in [0, 1].');
  return 1 - (1 - a) * (1 - b);
}

// Rule claims the initial-check implementation relies on. An entry using it
// must carry evidence records with these IDs, or it fails closed.
export const INITIAL_CHECK_RULES = {
  statAddition: 'raw-stat-addition',
  additional: 'aa-initial-check',
  critical: 'critical-check',
  evasion: 'evasion-check',
  damage: 'damage-gate',
} as const;
const SUPER_CONVERSION = 0.5;

const STAT_KEYS = ['hp', 'attack', 'defense'] as const;
const nonZero = <K extends string>(values: Partial<Record<K, number>>) =>
  Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== 0 && v !== undefined),
  ) as Partial<Record<K, number>>;

export function evaluateBuild(
  build: Build,
  request: BuildRequest,
  entry: EvaluatorEntry,
): Evaluation {
  const catalog = entry.model;
  const errors = [
    ...requestErrors(request, entry),
    ...buildErrors(build, request, catalog),
  ];
  if (errors.length) throw new Error(errors.join(' '));
  const { card } = catalog;

  // Every addition is recorded with its source; totals are summed from the
  // same records the explanation shows.
  const trace: CalculationTrace = { stats: [], skills: [], probabilities: [] };
  const statSource = (c: Contribution<Partial<Stats>>) => trace.stats.push(c);
  const skillSource = (c: Contribution<Partial<Skills>>) =>
    trace.skills.push(c);
  statSource({
    source: 'card',
    label: `Card base stats (Lv.${card.level})`,
    slot: null,
    itemId: null,
    nodeId: null,
    values: { ...card.baseStats },
    evidenceIds: card.evidenceIds,
  });
  // Fixed profile, selected choices or user-entered totals.
  const potential = potentialContributions(build, request, entry);
  potential.stats.forEach(statSource);
  potential.skills.forEach(skillSource);
  for (const slot of SLOTS) {
    const orb = catalog.orbs.find((o) => o.id === build.equips[slot]);
    if (!orb) continue;
    const base = { slot, itemId: orb.id, nodeId: null };
    const label = `${slot[0]!.toUpperCase()}${slot.slice(1)} equip: ${orb.label}`;
    if (Object.keys(nonZero(orb.stats)).length)
      statSource({
        ...base,
        source: 'equip',
        label,
        values: nonZero(orb.stats),
        evidenceIds: orb.evidenceIds,
      });
    if (Object.keys(nonZero(orb.skills)).length)
      skillSource({
        ...base,
        source: 'equip',
        label,
        values: nonZero(orb.skills),
        evidenceIds: orb.evidenceIds,
      });
  }
  const stats: Stats = { hp: 0, attack: 0, defense: 0 };
  for (const c of trace.stats)
    for (const key of STAT_KEYS) stats[key] += c.values[key] ?? 0;
  const skills: Skills = { additional: 0, critical: 0, evasion: 0 };
  for (const c of trace.skills)
    for (const key of ['additional', 'critical', 'evasion'] as const)
      skills[key] += c.values[key] ?? 0;

  const sourceEvidence = (
    contributions: Contribution<Partial<Record<string, number>>>[],
    key: string,
  ) =>
    contributions
      .filter((c) => (c.values[key] ?? 0) !== 0)
      .flatMap((c) => c.evidenceIds);
  const unique = (ids: string[]) => [...new Set(ids)];

  const step = (
    metric: ProbabilityStep['metric'],
    factors: ProbabilityStep['factors'],
    value: number,
    evidenceIds: string[],
    note: string,
  ) => {
    trace.probabilities.push({ metric, factors, value, evidenceIds, note });
    return value;
  };
  const perLevel = (skill: Skill, label: string) => {
    const rate = skill === 'evasion' ? 0.01 : 0.02;
    return step(
      skill === 'additional' ? 'additionalTrigger' : skill,
      [
        { label: `${label} levels`, value: skills[skill], kind: 'level' },
        { label: 'chance per level', value: rate, kind: 'rate' },
      ],
      hiddenPotentialChance(skills[skill], skill),
      unique([
        INITIAL_CHECK_RULES[skill],
        ...sourceEvidence(trace.skills, skill),
      ]),
      `${label}: Hidden Potential level × ${rate * 100}% per level.`,
    );
  };
  const trigger = perLevel('additional', 'Additional Attack');
  const extraSuper = step(
    'additionalSuper',
    [
      { label: 'Initial AA trigger', value: trigger, kind: 'rate' },
      { label: 'Super conversion', value: SUPER_CONVERSION, kind: 'rate' },
    ],
    trigger * SUPER_CONVERSION,
    unique([
      INITIAL_CHECK_RULES.additional,
      ...sourceEvidence(trace.skills, 'additional'),
    ]),
    'The initial check triggers and the extra attack is a Super. No passive chain model.',
  );
  const critical = perLevel('critical', 'Critical Hit');
  const evasion = request.context.evasionAllowed
    ? perLevel('evasion', 'Evasion')
    : step(
        'evasion',
        [],
        0,
        [INITIAL_CHECK_RULES.evasion],
        'Fixed at 0 by the explicit context: evasion disabled.',
      );

  const stat = (key: (typeof STAT_KEYS)[number]): Metric => ({
    value: stats[key],
    unit: 'stat',
    evidenceIds: unique([
      ...sourceEvidence(trace.stats, key),
      INITIAL_CHECK_RULES.statAddition,
    ]),
    reason:
      'Card stat including activated potential and equips. No combat multipliers.',
  });
  const probability = (
    metric: ProbabilityStep['metric'],
    value: number,
    reason: string,
  ): Metric => ({
    value,
    unit: 'probability',
    evidenceIds: trace.probabilities.find((p) => p.metric === metric)!
      .evidenceIds,
    reason,
  });
  const metrics: Metrics = {
    attack: stat('attack'),
    defense: stat('defense'),
    hp: stat('hp'),
    additionalTrigger: probability(
      'additionalTrigger',
      trigger,
      'Initial eligible attack: Hidden Potential trigger chance. Not a full-turn attack distribution.',
    ),
    additionalSuper: probability(
      'additionalSuper',
      extraSuper,
      'Initial check triggers and yields a Super: trigger × 50%. No passive chain model.',
    ),
    critical: probability(
      'critical',
      critical,
      'Hidden Potential critical chance per eligible attack; no native/external critical effects.',
    ),
    evasion: probability(
      'evasion',
      evasion,
      request.context.evasionAllowed
        ? 'Per eligible incoming attack; not a survival probability.'
        : 'The explicit context assumes evasion is disabled.',
    ),
    damage: {
      value: null,
      unit: 'damage',
      evidenceIds: [INITIAL_CHECK_RULES.damage],
      reason:
        'Unavailable: outgoing damage stages, critical damage, enemy interactions and rounding are not verified.',
    },
    battleDefense: {
      value: null,
      unit: 'stat',
      evidenceIds: card.evidenceIds,
      reason:
        'Unavailable: battle DEF/passive stages are outside the admitted card-stat model.',
    },
  };
  return {
    stats,
    skills,
    metrics,
    trace,
    comparisonKey: JSON.stringify([
      entry.id,
      entry.evaluator.id,
      entry.evaluator.version,
      catalog.revision,
      request.cardStateId,
      request.level,
      request.superAttackLevel,
      request.progression.profileId,
      [...request.progression.routes].sort(),
      [...request.progression.activatedNodes].sort(),
      request.customPotential ?? null,
      request.context,
    ]),
  };
}

// The order of a skill-chance objective depends only on that skill's total
// level: any convention in which the chance rises with level ranks builds the
// same way. Only the displayed percentage depends on the source model.
const levelBasis = (skill: string) =>
  `Total ${skill} levels decide the order; any convention where the chance rises with level gives the same winner. The percentage uses the source model.`;

const cardStat = (name: string) => ({
  group: 'card-stats' as const,
  status: 'supported' as const,
  summary: `${name} shown on the card: base stats plus Hidden Potential and equipment, before any battle modifier.`,
  basis: `Documented stat additions are summed. Not a damage or survival estimate.`,
  mechanics: [],
});

export const initialCheckEvaluator: EvaluatorImplementation = {
  id: 'hidden-potential-initial-check',
  version: '1',
  label: 'Card stats and initial-check Hidden Potential probabilities',
  verification:
    'Arithmetic is covered by independent unit tests with hand-computed expected values. Tests check this implementation, not game behavior.',
  objectiveModels: {
    attack: cardStat('ATK'),
    defense: cardStat('DEF'),
    hp: cardStat('HP'),
    additionalSuper: {
      group: 'skill-chances',
      status: 'experimental',
      summary:
        'Chance that the first attack triggers a Hidden Potential additional attack that is a Super.',
      basis: levelBasis('Additional Attack'),
      mechanics: ['nativeAdditional'],
    },
    critical: {
      group: 'skill-chances',
      status: 'experimental',
      summary: 'Hidden Potential critical-hit chance on an eligible attack.',
      basis: levelBasis('Critical Hit'),
      mechanics: ['nativeCritical'],
    },
    evasion: {
      group: 'skill-chances',
      status: 'experimental',
      summary:
        'Hidden Potential chance to evade an eligible incoming attack, when the context allows evasion.',
      basis: levelBasis('Evasion'),
      mechanics: ['nativeEvasion'],
    },
  },
  gaps: [
    {
      label: 'Expected damage',
      reason:
        'Needs verified damage stages, critical damage, enemy DEF interactions and rounding.',
    },
    {
      label: 'Damage taken and survival',
      reason:
        'Needs battle DEF stages, damage reduction and enemy attack models.',
    },
  ],
  mechanics: [],
  customPotential: true,
  entryErrors: (entry) =>
    Object.values(INITIAL_CHECK_RULES)
      .filter((id) => !entry.model.evidence.some((e) => e.id === id))
      .map(
        (id) =>
          `Evaluator ${entry.id} lacks the "${id}" rule evidence required by this implementation.`,
      ),
  evaluate: evaluateBuild,
};
