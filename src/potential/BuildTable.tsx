import { SKILLS } from '../character-build/domain';
import type { SourceBreakdown } from '../character-build/explanation';
import { SKILL_NAMES, STAT_NAMES } from './result';

const number = (n: number) => n.toLocaleString('en-US');

// Skill levels by source, so a total never hides whether equipment is in it.
export function SkillTable({
  breakdown,
  caption,
}: {
  breakdown: SourceBreakdown;
  caption: string;
}) {
  const { skills } = breakdown;
  const chosen = SKILLS.some((s) => skills.chosen[s] !== 0);
  return (
    <table className="po-table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Skill</th>
          <th scope="col">Hidden Potential</th>
          {chosen && <th scope="col">Chosen nodes</th>}
          <th scope="col">Equipment</th>
          <th scope="col">Total</th>
        </tr>
      </thead>
      <tbody>
        {SKILLS.map((skill) => (
          <tr key={skill}>
            <th scope="row">{SKILL_NAMES[skill]}</th>
            <td>{skills.fixed[skill]}</td>
            {chosen && <td>{skills.chosen[skill]}</td>}
            <td>
              {skills.equipment[skill] ? `+${skills.equipment[skill]}` : 0}
            </td>
            <td>
              <strong>{skills.total[skill]}</strong>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Card stats: card base, Hidden Potential, equipment and total.
export function StatLine({ breakdown }: { breakdown: SourceBreakdown }) {
  const { stats } = breakdown;
  return (
    <dl className="po-stat-line">
      {(['attack', 'defense', 'hp'] as const).map((key) => (
        <div key={key}>
          <dt>{STAT_NAMES[key]}</dt>
          <dd>
            <strong>{number(stats.total[key])}</strong>
            <span>
              {number(stats.card[key])} card + {number(stats.potential[key])}{' '}
              potential
              {stats.equipment[key]
                ? ` + ${number(stats.equipment[key])} equipment`
                : ''}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
