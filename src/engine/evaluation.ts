import type {
  CoverageRow,
  Evaluation,
  OptimizationRequest,
  Participant,
  RuleResult,
} from '../domain/types';
import { enumerateRotations } from './rotations';
import { AXES, scoreLayout, sharedLinks } from './scoring';
import { evaluateRule } from './rules';
import { validateRequest } from './validation';

export const candidateKey = (ids: string[]) => JSON.stringify([...ids].sort());

/** Evaluate one candidate independently of how candidates were generated. */
export function evaluateCandidate(
  ownedIds: string[],
  request: OptimizationRequest,
): Evaluation {
  const result: Evaluation = {
    key: candidateKey(ownedIds),
    ownedIds: [...ownedIds],
    participants: [],
    eligible: false,
    reasons: [],
    warnings: [],
    coverage: [],
    layout: null,
    components: null,
    total: null,
    effects: [],
    explanations: [],
    weaknesses: [],
  };
  result.reasons.push(...validateRequest(request));
  if (result.reasons.length) return result;
  if (ownedIds.length !== 6)
    result.reasons.push('A team requires exactly six owned instances.');
  if (new Set(ownedIds).size !== ownedIds.length)
    result.reasons.push('Duplicate owned instance selected.');
  if (!ownedIds.includes(request.leaderInstanceId))
    result.reasons.push('Selected leader is missing.');
  const units = new Map(request.catalog.units.map((unit) => [unit.id, unit]));
  const instances = new Map(
    request.owned.map((instance) => [instance.id, instance]),
  );
  for (const id of ownedIds) {
    const instance = instances.get(id),
      unit = instance ? units.get(instance.unitId) : undefined;
    if (!unit) result.reasons.push(`Unknown owned instance ${id}.`);
    else result.participants.push({ id: `owned:${id}`, origin: 'owned', unit });
  }
  const friend = units.get(request.friendUnitId);
  const leaderInstance = instances.get(request.leaderInstanceId);
  const leader = leaderInstance ? units.get(leaderInstance.unitId) : undefined;
  if (!friend?.leaderSkill || !leader?.leaderSkill)
    result.reasons.push('Both selected leaders need a leader skill.');
  if (result.reasons.length || !friend || !leader) return result;
  result.participants.push({ id: 'friend', origin: 'friend', unit: friend });

  const coverageFrom = (
    self: Participant,
    source: typeof leader,
  ): RuleResult => {
    const unsupported = source.mechanics.filter(
      (m) => m.scope === 'eligibility' && m.status !== 'supported',
    );
    return unsupported.length
      ? {
          status: 'unsupported',
          reasons: unsupported.map((m) => m.description),
        }
      : evaluateRule(source.leaderSkill!.rule, {
          self,
          participants: result.participants,
          scenario: request.scenario,
          purpose: 'eligibility',
        });
  };
  result.coverage = result.participants.map((participant): CoverageRow => ({
    participant,
    leader: coverageFrom(participant, leader),
    friendLeader: coverageFrom(participant, friend),
  }));
  for (const row of result.coverage) {
    if (row.leader.status !== 'met')
      result.reasons.push(
        `${row.participant.unit.name} (${row.participant.origin}): selected-leader coverage ${row.leader.status}.`,
      );
    if (row.friendLeader.status !== 'met')
      result.reasons.push(
        `${row.participant.unit.name} (${row.participant.origin}): friend-leader coverage ${row.friendLeader.status}.`,
      );
  }
  for (const participant of result.participants) {
    const records = [
      participant.unit,
      ...request.catalog.links.filter((link) =>
        participant.unit.linkIds.includes(link.id),
      ),
    ];
    for (const record of records)
      for (const mechanic of record.mechanics.filter(
        (m) => m.status !== 'supported',
      )) {
        const message = `${participant.unit.name}: ${mechanic.description}`;
        if (mechanic.scope === 'eligibility')
          result.reasons.push(`Unsupported eligibility — ${message}`);
        else
          result.warnings.push(
            `Unsupported scoring — ${message} No benefit assumed.`,
          );
      }
    for (const rule of participant.unit.eligibilityRules) {
      const outcome = evaluateRule(rule, {
        self: participant,
        participants: result.participants,
        scenario: request.scenario,
        purpose: 'eligibility',
      });
      if (outcome.status !== 'met')
        result.reasons.push(
          `${participant.unit.name}: eligibility ${outcome.status}: ${outcome.reasons.join(' ')}`,
        );
    }
  }
  result.warnings = [...new Set(result.warnings)];
  if (result.reasons.length) return result; // Hard gate before any scoring or rotation search.

  let best: ReturnType<typeof scoreLayout> | undefined;
  for (const layout of enumerateRotations(
    result.participants.map((p) => p.id),
  )) {
    const scored = scoreLayout(
      result.participants,
      result.coverage,
      layout,
      request.catalog,
      request.scenario,
    );
    if (!best || scored.total > best.total + 1e-9) {
      best = scored;
      result.layout = layout;
    }
  }
  result.eligible = true;
  result.components = best!.components;
  result.total = best!.total;
  result.effects = best!.effects;
  for (const effect of result.effects.filter(
    (effect) => effect.outcome.status === 'unsupported',
  )) {
    result.warnings.push(
      `Unsupported condition: ${effect.label}. ${effect.outcome.reasons.join(' ')} No bonus applied.`,
    );
  }
  const lowestAxis = [...AXES].sort(
    (a, b) => best!.averages[a] - best!.averages[b],
  )[0]!;
  result.weaknesses.push(
    `Lowest hand-authored fixture axis: ${lowestAxis} ${best!.averages[lowestAxis].toFixed(1)}/100; not a combat calculation.`,
  );
  const unmet = result.effects.filter(
    (effect) => effect.outcome.status !== 'met',
  ).length;
  if (unmet)
    result.weaknesses.push(
      `${unmet} conditional effect(s) are unmet or unsupported in this target layout and context.`,
    );
  if (best!.components.links < 50)
    result.weaknesses.push(
      'Main pairs share less than half of the available synthetic link weight on average.',
    );
  result.explanations = result.participants.map((participant) => {
    const pair = result.layout!.pairs.find((ids) =>
      ids.includes(participant.id),
    );
    const partner = pair
      ? result.participants.find(
          (p) => p.id === pair.find((id) => id !== participant.id),
        )
      : undefined;
    const links = partner
      ? sharedLinks(participant, partner, request.catalog).map(
          (link) => link.name,
        )
      : [];
    const role = partner
      ? `Target partner: ${partner.unit.name}. Shared synthetic links: ${links.join(', ') || 'none'}.`
      : 'Target floater: no fixed partner condition is assumed.';
    const active = result.effects.filter(
      (effect) =>
        effect.participantId === participant.id &&
        effect.outcome.status === 'met',
    ).length;
    return {
      participantId: participant.id,
      text: `Covers both leader rules. ${role} ${active} active fixture effect(s).`,
    };
  });
  return result;
}
