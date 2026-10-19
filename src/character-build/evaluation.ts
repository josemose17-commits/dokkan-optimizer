import {
  SLOTS,
  type Build,
  type BuildRequest,
  type CharacterCatalog,
  type Evaluation,
  type Metric,
  type Metrics,
  type Skill,
} from './domain';
import { buildErrors, requestErrors } from './legality';

// Recorded with saved builds; matches the catalog state's evaluatorId.
export const EVALUATOR_VERSION = 'goku-initial-check-v1';

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

export function evaluateBuild(
  build: Build,
  request: BuildRequest,
  catalog: CharacterCatalog,
): Evaluation {
  const errors = [
    ...requestErrors(request, catalog),
    ...buildErrors(build, request, catalog),
  ];
  if (errors.length) throw new Error(errors.join(' '));
  const stats = { ...catalog.card.baseStats };
  for (const key of ['hp', 'attack', 'defense'] as const)
    stats[key] += catalog.profile.statBonus[key];
  const skills = { ...catalog.profile.fixedSkills };
  for (const [id, skill] of Object.entries(build.choices))
    skills[skill] += catalog.profile.nodes.find((n) => n.id === id)!.levels;
  for (const slot of SLOTS) {
    const orb = catalog.orbs.find((o) => o.id === build.equips[slot]);
    if (!orb) continue;
    for (const key of ['hp', 'attack', 'defense'] as const)
      stats[key] += orb.stats[key] ?? 0;
    for (const key of ['additional', 'critical', 'evasion'] as const)
      skills[key] += orb.skills[key] ?? 0;
  }
  const stat = (value: number): Metric => ({
    value,
    unit: 'stat',
    evidenceIds: [
      'card-stats',
      'base-board',
      'raw-stat-addition',
      'bronze-items',
    ],
    reason:
      'Card stat including activated potential and equips. No combat multipliers.',
  });
  const probability = (
    value: number,
    evidenceId: string,
    reason: string,
  ): Metric => ({
    value,
    unit: 'probability',
    evidenceIds: [evidenceId, 'base-board', 'silver-items'],
    reason,
  });
  const trigger = hiddenPotentialChance(skills.additional, 'additional');
  const metrics: Metrics = {
    attack: stat(stats.attack),
    defense: stat(stats.defense),
    hp: stat(stats.hp),
    additionalTrigger: probability(
      trigger,
      'aa-initial-check',
      'Initial eligible attack: Hidden Potential trigger chance. Not a full-turn attack distribution.',
    ),
    additionalSuper: probability(
      trigger * 0.5,
      'aa-initial-check',
      'Initial check triggers and yields a Super: trigger × 50%. No passive chain model.',
    ),
    critical: probability(
      hiddenPotentialChance(skills.critical, 'critical'),
      'critical-check',
      'Hidden Potential critical chance per eligible attack; no native/external critical effects.',
    ),
    evasion: probability(
      request.context.evasionAllowed
        ? hiddenPotentialChance(skills.evasion, 'evasion')
        : 0,
      'evasion-check',
      request.context.evasionAllowed
        ? 'Per eligible incoming attack; not a survival probability.'
        : 'The explicit context assumes evasion is disabled.',
    ),
    damage: {
      value: null,
      unit: 'damage',
      evidenceIds: ['damage-gate'],
      reason:
        'Unavailable: outgoing damage stages, critical damage, enemy interactions and rounding are not verified.',
    },
    battleDefense: {
      value: null,
      unit: 'stat',
      evidenceIds: ['eza-kit'],
      reason:
        'Unavailable: battle DEF/passive stages are outside the admitted card-stat model.',
    },
  };
  return {
    stats,
    skills,
    metrics,
    comparisonKey: JSON.stringify([
      catalog.revision,
      request.cardStateId,
      request.level,
      request.superAttackLevel,
      request.progression.profileId,
      [...request.progression.routes].sort(),
      [...request.progression.activatedNodes].sort(),
      request.context,
    ]),
  };
}
