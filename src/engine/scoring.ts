import type {
  Catalog,
  CoverageRow,
  EffectResult,
  Participant,
  Ratings,
  RotationLayout,
  Scenario,
  ScoreComponents,
} from '../domain/types';
import { evaluateRule } from './rules';

export const SCORE_WEIGHTS: ScoreComponents = {
  leaderCoverage: 0.2,
  links: 0.15,
  conditions: 0.25,
  scenario: 0.4,
};
export const SCORE_LABELS: Record<keyof ScoreComponents, string> = {
  leaderCoverage: 'Leader coverage',
  links: 'Synthetic link affinity',
  conditions: 'Condition fulfillment',
  scenario: 'Synthetic scenario fit',
};
export const AXES: (keyof Ratings)[] = ['pressure', 'sustain', 'utility'];
const clamp = (value: number) => Math.min(100, Math.max(0, value));

export function sharedLinks(
  first: Participant,
  second: Participant,
  catalog: Catalog,
) {
  if (first.unit.id === second.unit.id) return []; // Explicit demo convention, not a real same-name rule.
  return catalog.links.filter(
    (link) =>
      first.unit.linkIds.includes(link.id) &&
      second.unit.linkIds.includes(link.id) &&
      !link.mechanics.some((mechanic) => mechanic.status === 'unsupported'),
  );
}

export function scoreLayout(
  participants: Participant[],
  coverage: CoverageRow[],
  layout: RotationLayout,
  catalog: Catalog,
  scenario: Scenario,
) {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const partnerFor = new Map<string, Participant>();
  for (const [a, b] of layout.pairs) {
    partnerFor.set(a, byId.get(b)!);
    partnerFor.set(b, byId.get(a)!);
  }
  const effects: EffectResult[] = [];
  const adjusted: Ratings[] = [];
  for (const participant of participants) {
    const ratings = { ...participant.unit.syntheticRatings };
    for (const effect of participant.unit.effects) {
      const unsupported = participant.unit.mechanics.find(
        (mechanic) =>
          mechanic.id === effect.id && mechanic.status === 'unsupported',
      );
      const partner = partnerFor.get(participant.id);
      const outcome = unsupported
        ? { status: 'unsupported' as const, reasons: [unsupported.description] }
        : evaluateRule(effect.condition, {
            self: participant,
            participants,
            scenario,
            ...(partner ? { partner } : {}),
          });
      effects.push({
        participantId: participant.id,
        effectId: effect.id,
        label: effect.label,
        outcome,
      });
      if (outcome.status === 'met')
        for (const axis of AXES)
          ratings[axis] += effect.syntheticBonus[axis] ?? 0;
    }
    for (const axis of AXES) ratings[axis] = clamp(ratings[axis]);
    adjusted.push(ratings);
  }
  const linkDenominator = catalog.links
    .filter((link) => !link.mechanics.some((m) => m.status === 'unsupported'))
    .reduce((sum, link) => sum + link.syntheticWeight, 0);
  const links =
    linkDenominator === 0
      ? 0
      : (layout.pairs.reduce(
          (sum, [a, b]) =>
            sum +
            sharedLinks(byId.get(a)!, byId.get(b)!, catalog).reduce(
              (weight, link) => weight + link.syntheticWeight,
              0,
            ),
          0,
        ) /
          (2 * linkDenominator)) *
        100;
  const scenarioDenominator = AXES.reduce(
    (sum, axis) => sum + scenario.ratingWeights[axis],
    0,
  );
  const scenarioScore =
    adjusted.reduce(
      (sum, ratings) =>
        sum +
        AXES.reduce(
          (value, axis) => value + ratings[axis] * scenario.ratingWeights[axis],
          0,
        ) /
          scenarioDenominator,
      0,
    ) / participants.length;
  const components: ScoreComponents = {
    leaderCoverage:
      (coverage.reduce(
        (sum, row) =>
          sum +
          Number(row.leader.status === 'met') +
          Number(row.friendLeader.status === 'met'),
        0,
      ) /
        14) *
      100,
    links,
    conditions: effects.length
      ? (effects.filter((effect) => effect.outcome.status === 'met').length /
          effects.length) *
        100
      : 100,
    scenario: scenarioScore,
  };
  const total = (
    Object.keys(SCORE_WEIGHTS) as (keyof ScoreComponents)[]
  ).reduce((sum, key) => sum + components[key] * SCORE_WEIGHTS[key], 0);
  const averages = Object.fromEntries(
    AXES.map((axis) => [
      axis,
      adjusted.reduce((sum, ratings) => sum + ratings[axis], 0) /
        participants.length,
    ]),
  ) as Ratings;
  return { components, total, effects, averages };
}
