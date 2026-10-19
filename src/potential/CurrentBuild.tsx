import {
  SKILLS,
  SLOTS,
  type BuildRequest,
  type CustomPotential,
  type Evaluation,
  type EvaluatorEntry,
  type Skill,
} from '../character-build/domain';
import {
  CUSTOM_POTENTIAL_LIMITS,
  CUSTOM_PROFILE_ID,
  customFromCurrent,
} from '../character-build/allocation';
import { sourceBreakdown } from '../character-build/explanation';
import { orbErrors } from '../character-build/legality';
import { SkillTable, StatLine } from './BuildTable';
import type { Capabilities } from './capabilities';
import { IntegerField } from './fields';
import { SKILL_NAMES, SLOT_NAMES, STAT_NAMES } from './result';

const number = (n: number) => n.toLocaleString('en-US');

// Step 2: the build the character has now. Hidden Potential comes from the
// documented profile (shown as a summary when it has no real choice) or from
// the user's entered values; current equipment is separate.
export default function CurrentBuild({
  entry,
  request,
  capabilities,
  evaluation,
  onChange,
}: {
  entry: EvaluatorEntry;
  request: BuildRequest;
  capabilities: Capabilities;
  evaluation: Evaluation | null;
  onChange: (request: BuildRequest) => void;
}) {
  const profile = entry.model.profile;
  const custom = request.customPotential;
  const useCustom = (on: boolean) => {
    if (on)
      onChange({
        ...request,
        progression: {
          ...request.progression,
          profileId: CUSTOM_PROFILE_ID,
          activatedNodes: [],
          routes: [],
        },
        current: { ...request.current, choices: {} },
        customPotential: customFromCurrent(request, entry),
      });
    else {
      const defaults = entry.defaults();
      const { customPotential: _entered, ...documented } = request;
      onChange({
        ...documented,
        progression: { ...defaults.progression },
        current: {
          ...request.current,
          choices: { ...defaults.current.choices },
        },
      });
    }
  };
  const setCustom = (next: CustomPotential) =>
    onChange({ ...request, customPotential: next });
  const goldReason = capabilities.equipment.find((e) => e.slot === 'gold')!;
  return (
    <section className="po-card" aria-labelledby="po-current-title">
      <h2 id="po-current-title">
        <span className="po-step">2</span> Current build
      </h2>
      <fieldset className="po-group">
        <legend>Hidden Potential</legend>
        <div className="po-choice-row">
          <label className="po-radio">
            <input
              type="radio"
              name="potential-source"
              checked={!custom}
              onChange={() => useCustom(false)}
            />
            Documented profile
          </label>
          {capabilities.allocation.custom.available && (
            <label className="po-radio">
              <input
                type="radio"
                name="potential-source"
                checked={!!custom}
                onChange={() => useCustom(true)}
              />
              My current values
            </label>
          )}
        </div>
        {!custom ? (
          <div className="po-profile">
            <p>
              <strong>{profile.label}</strong>
            </p>
            <p className="po-muted">
              {SKILLS.map(
                (s) => `${SKILL_NAMES[s]} ${profile.fixedSkills[s]}`,
              ).join(' · ')}{' '}
              ·{' '}
              {(['hp', 'attack', 'defense'] as const)
                .map((k) => `${STAT_NAMES[k]} +${number(profile.statBonus[k])}`)
                .join(' · ')}
            </p>
            {profile.nodes.length === 0 ? (
              <p className="po-muted">
                One fixed allocation: no selectable choice nodes are documented
                for this profile.
              </p>
            ) : (
              <ChoiceNodes
                entry={entry}
                request={request}
                onChange={onChange}
              />
            )}
          </div>
        ) : (
          <div className="po-custom">
            <p className="po-note">Board requirements not checked.</p>
            <div className="po-grid-3">
              {SKILLS.map((skill) => (
                <IntegerField
                  key={skill}
                  label={`${SKILL_NAMES[skill]} levels`}
                  value={custom.skills[skill]}
                  min={0}
                  max={CUSTOM_POTENTIAL_LIMITS.skillLevel}
                  onChange={(n) =>
                    setCustom({
                      ...custom,
                      skills: { ...custom.skills, [skill]: n },
                    })
                  }
                />
              ))}
            </div>
            <div className="po-grid-3">
              {(['hp', 'attack', 'defense'] as const).map((key) => (
                <IntegerField
                  key={key}
                  label={`${STAT_NAMES[key]} addition`}
                  value={custom.stats[key]}
                  min={0}
                  max={CUSTOM_POTENTIAL_LIMITS.stat}
                  onChange={(n) =>
                    setCustom({
                      ...custom,
                      stats: { ...custom.stats, [key]: n },
                    })
                  }
                />
              ))}
            </div>
            <p className="po-muted">
              Enter the totals your Hidden Potential gives today, without
              equipment. They are compared as entered, not proven attainable.
            </p>
          </div>
        )}
      </fieldset>
      <fieldset className="po-group">
        <legend>Equipped now</legend>
        <div className="po-grid-3">
          {SLOTS.map((slot) => {
            const fitting = entry.model.orbs.filter((o) =>
              o.slots.includes(slot),
            );
            return (
              <label key={slot} className="po-field">
                <span>{SLOT_NAMES[slot]}</span>
                <select
                  aria-label={`Current ${slot} equipment`}
                  value={request.current.equips[slot] ?? ''}
                  disabled={!fitting.length && !request.current.equips[slot]}
                  onChange={(e) =>
                    onChange({
                      ...request,
                      current: {
                        ...request.current,
                        equips: {
                          ...request.current.equips,
                          [slot]: e.target.value || null,
                        },
                      },
                    })
                  }
                >
                  <option value="">Empty</option>
                  {fitting.map((o) => {
                    const reason = orbErrors(o, slot, request, entry.model)[0];
                    return (
                      <option key={o.id} value={o.id} disabled={!!reason}>
                        {reason ? `${o.label} — ${reason}` : o.label}
                      </option>
                    );
                  })}
                </select>
              </label>
            );
          })}
        </div>
        {goldReason.reason && goldReason.items === 0 && (
          <p className="po-muted">Gold: {goldReason.reason}</p>
        )}
      </fieldset>
      {evaluation && (
        <div className="po-current-totals">
          <SkillTable
            breakdown={sourceBreakdown(evaluation)}
            caption="Current skill levels by source"
          />
          <StatLine breakdown={sourceBreakdown(evaluation)} />
        </div>
      )}
    </section>
  );
}

// Choice nodes of a documented template: which are unlocked and the option
// chosen at each. Only appears when a template supplies real choice nodes.
function ChoiceNodes({
  entry,
  request,
  onChange,
}: {
  entry: EvaluatorEntry;
  request: BuildRequest;
  onChange: (request: BuildRequest) => void;
}) {
  return (
    <ul className="po-nodes">
      {entry.model.profile.nodes.map((node) => {
        const active = request.progression.activatedNodes.includes(node.id);
        return (
          <li key={node.id}>
            <label className="po-check">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => {
                  const choices = { ...request.current.choices };
                  if (e.target.checked) choices[node.id] = node.options[0]!;
                  else delete choices[node.id];
                  onChange({
                    ...request,
                    progression: {
                      ...request.progression,
                      activatedNodes: e.target.checked
                        ? [...request.progression.activatedNodes, node.id]
                        : request.progression.activatedNodes.filter(
                            (id) => id !== node.id,
                          ),
                    },
                    current: { ...request.current, choices },
                  });
                }}
              />
              {node.id} unlocked · +{node.levels} to{' '}
              {node.options.map((o) => SKILL_NAMES[o]).join(' or ')}
              {node.prerequisites.length
                ? ` · requires ${node.prerequisites.join(', ')}`
                : ''}
            </label>
            {active && (
              <label className="po-field po-field-compact">
                <span>{node.id}: current choice</span>
                <select
                  value={request.current.choices[node.id]}
                  onChange={(e) =>
                    onChange({
                      ...request,
                      current: {
                        ...request.current,
                        choices: {
                          ...request.current.choices,
                          [node.id]: e.target.value as Skill,
                        },
                      },
                    })
                  }
                >
                  {node.options.map((o) => (
                    <option key={o} value={o}>
                      {SKILL_NAMES[o]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </li>
        );
      })}
    </ul>
  );
}
