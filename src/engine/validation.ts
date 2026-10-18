import type { OptimizationRequest } from '../domain/types';
import { AXES } from './scoring';

export const ENGINE_LIMITS = {
  maxOwned: 30,
  maxCandidates: 2000,
  maxResults: 10,
} as const;

export function validateRequest(request: OptimizationRequest): string[] {
  const errors: string[] = [];
  const { catalog, owned, scenario } = request;
  if (owned.length < 6)
    errors.push('Own at least six fixture units to generate a team.');
  if (owned.length > ENGINE_LIMITS.maxOwned)
    errors.push(
      `Reference engine accepts at most ${ENGINE_LIMITS.maxOwned} owned instances.`,
    );
  if (new Set(owned.map((i) => i.id)).size !== owned.length)
    errors.push('Duplicate owned instance IDs in collection.');
  if (owned.some((i) => !i.id || !catalog.units.some((u) => u.id === i.unitId)))
    errors.push('Collection contains unknown units or empty instance IDs.');
  const leader = owned.find((i) => i.id === request.leaderInstanceId);
  if (
    !leader ||
    !catalog.units.find((u) => u.id === leader.unitId)?.leaderSkill
  )
    errors.push('Select an owned leader with a leader skill.');
  if (!catalog.units.find((u) => u.id === request.friendUnitId)?.leaderSkill)
    errors.push('Select a friend with a leader skill.');
  if (
    !Number.isInteger(request.maxCandidates) ||
    request.maxCandidates < 1 ||
    request.maxCandidates > ENGINE_LIMITS.maxCandidates
  )
    errors.push(`Candidate limit must be 1–${ENGINE_LIMITS.maxCandidates}.`);
  if (
    !Number.isInteger(request.resultLimit) ||
    request.resultLimit < 1 ||
    request.resultLimit > ENGINE_LIMITS.maxResults
  )
    errors.push(`Result limit must be 1–${ENGINE_LIMITS.maxResults}.`);
  const records = [...catalog.units, ...catalog.links, scenario];
  if (new Set(records.map((record) => record.id)).size !== records.length)
    errors.push('Catalog/scenario record IDs must be globally unique.');
  if (
    records.some(
      (record) =>
        record.provenance.kind !== 'synthetic' ||
        record.provenance.verifiedAt !== null,
    )
  )
    errors.push(
      'This reference evaluator accepts only unverified synthetic records. Verified data requires a verified evaluator.',
    );
  for (const unit of catalog.units) {
    if (
      unit.linkIds.some((id) => !catalog.links.some((link) => link.id === id))
    )
      errors.push(`${unit.name} references an unknown link.`);
    if (
      AXES.some(
        (axis) =>
          !Number.isFinite(unit.syntheticRatings[axis]) ||
          unit.syntheticRatings[axis] < 0 ||
          unit.syntheticRatings[axis] > 100,
      )
    )
      errors.push(`${unit.name} has invalid synthetic ratings.`);
    if (
      unit.effects.some((effect) =>
        AXES.some(
          (axis) =>
            effect.syntheticBonus[axis] !== undefined &&
            !Number.isFinite(effect.syntheticBonus[axis]),
        ),
      )
    )
      errors.push(`${unit.name} has invalid synthetic bonuses.`);
  }
  if (
    catalog.links.some(
      (link) =>
        !Number.isFinite(link.syntheticWeight) || link.syntheticWeight < 0,
    )
  )
    errors.push('Synthetic link weights must be finite and nonnegative.');
  if (
    AXES.some(
      (axis) =>
        !Number.isFinite(scenario.ratingWeights[axis]) ||
        scenario.ratingWeights[axis] < 0,
    ) ||
    AXES.reduce((sum, axis) => sum + scenario.ratingWeights[axis], 0) <= 0
  )
    errors.push(
      'Scenario weights must be finite, nonnegative, and have a positive sum.',
    );
  if (
    !Number.isInteger(scenario.turn) ||
    scenario.turn < 1 ||
    !Number.isFinite(scenario.hpPercent) ||
    scenario.hpPercent < 0 ||
    scenario.hpPercent > 100
  )
    errors.push('Context requires turn ≥ 1 and HP from 0 to 100%.');
  for (const mechanic of scenario.mechanics.filter(
    (m) => m.scope === 'eligibility' && m.status !== 'supported',
  ))
    errors.push(`Unsupported scenario eligibility: ${mechanic.description}`);
  return [...new Set(errors)];
}
