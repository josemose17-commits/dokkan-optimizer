import type { Participant, Rule, RuleResult, Scenario } from '../domain/types';

export interface RuleContext {
  self: Participant;
  participants: Participant[];
  partner?: Participant;
  scenario: Scenario;
  purpose?: 'eligibility' | 'effect';
}

export function evaluateRule(rule: Rule, ctx: RuleContext): RuleResult {
  const check = (ok: boolean, reason: string): RuleResult => ({
    status: ok ? 'met' : 'unmet',
    reasons: [reason],
  });
  switch (rule.kind) {
    case 'always':
      return check(true, 'Unconditional fixture effect.');
    case 'category':
      return check(
        ctx.self.unit.categories.includes(rule.categoryId),
        `Requires category ${rule.categoryId}.`,
      );
    case 'teamCategoryAtLeast': {
      const count = ctx.participants.filter((p) =>
        p.unit.categories.includes(rule.categoryId),
      ).length;
      return check(
        count >= rule.count,
        `${count}/${rule.count} participants in ${rule.categoryId} (self and friend included).`,
      );
    }
    case 'partnerCategory':
      if (ctx.purpose === 'eligibility')
        return {
          status: 'unsupported',
          reasons: [
            'Fixed-partner eligibility is unsupported before target rotations.',
          ],
        };
      return check(
        !!ctx.partner?.unit.categories.includes(rule.categoryId),
        ctx.partner
          ? `Fixed partner must have ${rule.categoryId}.`
          : `No fixed partner for this floater; ${rule.categoryId} is not assumed.`,
      );
    case 'turnAtLeast':
      return check(
        ctx.scenario.turn >= rule.turn,
        `Context turn ${ctx.scenario.turn}; requires turn ≥ ${rule.turn}.`,
      );
    case 'hpAtMost':
      return check(
        ctx.scenario.hpPercent <= rule.percent,
        `Context HP ${ctx.scenario.hpPercent}%; requires HP ≤ ${rule.percent}%.`,
      );
    case 'unsupported':
      return { status: 'unsupported', reasons: [rule.description] };
    case 'all':
    case 'any': {
      const outcomes = rule.rules.map((child) => evaluateRule(child, ctx));
      // Conservative even for an OR with a known true branch: no unknown eligibility semantics are accepted.
      if (outcomes.some((outcome) => outcome.status === 'unsupported')) {
        return {
          status: 'unsupported',
          reasons: outcomes.flatMap((outcome) => outcome.reasons),
        };
      }
      const ok =
        rule.kind === 'all'
          ? outcomes.every((outcome) => outcome.status === 'met')
          : outcomes.some((outcome) => outcome.status === 'met');
      return {
        status: ok ? 'met' : 'unmet',
        reasons: outcomes.flatMap((outcome) => outcome.reasons),
      };
    }
    default:
      return { status: 'unsupported', reasons: ['Unrecognized rule kind.'] };
  }
}
