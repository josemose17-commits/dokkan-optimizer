import {
  SKILLS,
  SLOTS,
  emptyConfiguration,
  emptySkills,
  emptyValues,
  userSource,
  type Configuration,
  type DefinitionDocument,
  type Equipment,
  type Requirement,
} from './domain';
import { equipmentChecks } from './evaluation';
import { NumberField, SourceFields, StatFields } from './fields';
import { newId } from './AbilityEditor';

const zeros = () => ({ hp: 0, attack: 0, defense: 0 });
const zeroSkills = () => ({ additional: 0, critical: 0, evasion: 0 });
function RequirementEditor({
  value,
  onChange,
}: {
  value: Requirement;
  onChange: (value: Requirement) => void;
}) {
  return (
    <div className="definition-grid">
      <label>
        Requirement kind
        <select
          aria-label="Requirement kind"
          value={value.kind}
          onChange={(e) => {
            const kind = e.target.value as Requirement['kind'];
            onChange(
              kind === 'other'
                ? { kind, description: '' }
                : kind === 'routes' || kind === 'sa'
                  ? { kind, minimum: 1 }
                  : { kind, value: '' },
            );
          }}
        >
          {['type', 'category', 'state', 'routes', 'sa', 'other'].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      {value.kind === 'other' ? (
        <label>
          Unsupported requirement wording
          <input
            aria-label="Unsupported requirement wording"
            value={value.description}
            onChange={(e) =>
              onChange({ ...value, description: e.target.value })
            }
          />
        </label>
      ) : value.kind === 'routes' || value.kind === 'sa' ? (
        <NumberField
          label={
            value.kind === 'routes'
              ? 'Required unlocked routes'
              : 'Required SA level'
          }
          value={value.minimum}
          max={value.kind === 'routes' ? 4 : Number.MAX_SAFE_INTEGER}
          onChange={(n) => onChange({ ...value, minimum: n ?? 0 })}
        />
      ) : (
        <label>
          Required exact value / state ID
          <input
            aria-label="Required exact value / state ID"
            value={value.value}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
          />
        </label>
      )}
    </div>
  );
}
export default function BuildEditor({
  document: doc,
  onChange,
}: {
  document: DefinitionDocument;
  onChange: (doc: DefinitionDocument) => void;
}) {
  const setBuild = (index: number, value: Configuration) =>
    onChange({
      ...doc,
      configurations: doc.configurations.map((b, i) =>
        i === index ? value : b,
      ),
    });
  const setEquip = (index: number, value: Equipment) =>
    onChange({
      ...doc,
      equipment: doc.equipment.map((b, i) => (i === index ? value : b)),
    });
  return (
    <section>
      <h2>Build configurations</h2>
      <p className="definition-notice">
        <strong>Custom allocation — board compatibility not checked.</strong>{' '}
        Totals are user assertions, not necessarily attainable. Slot
        availability and unlock counts are also entered explicitly. Resource
        costs, inventory ownership and affordability are not evaluated.
      </p>
      <p className="definition-muted">
        Nonnegative whole stat/skill values are accepted up to JavaScript’s
        safe-integer bound for exact arithmetic; it is a technical precision
        limit, not a game maximum. HP% is bounded 0–100; slots 1–3; route counts
        0–4 refer to the four route labels, not a reconstructed node graph.
      </p>
      {doc.configurations.map((b, i) => (
        <details
          key={b.id}
          className="definition-card"
          open={i === doc.configurations.length - 1}
        >
          <summary>
            {b.name}
            {b.id === doc.baselineId ? ' · Current baseline' : ''}
          </summary>
          <div className="definition-grid">
            <label>
              Configuration name
              <input
                aria-label="Configuration name"
                value={b.name}
                onChange={(e) => setBuild(i, { ...b, name: e.target.value })}
              />
            </label>
            <label>
              Comparison baseline
              <input
                aria-label="Comparison baseline"
                type="radio"
                name="definition-baseline"
                checked={b.id === doc.baselineId}
                onChange={() => onChange({ ...doc, baselineId: b.id })}
              />
              Use as current build
            </label>
          </div>
          <StatFields
            label="Hidden Potential additions"
            value={b.potentialStats}
            onChange={(potentialStats) => setBuild(i, { ...b, potentialStats })}
          />
          <fieldset>
            <legend>Entered Hidden Potential skill levels</legend>
            <div className="definition-grid three">
              {SKILLS.map((skill) => (
                <NumberField
                  key={skill}
                  label={`${skill} level`}
                  value={b.skills[skill]}
                  onChange={(n) =>
                    setBuild(i, { ...b, skills: { ...b.skills, [skill]: n } })
                  }
                />
              ))}
            </div>
            <p className="definition-muted">
              These levels are recorded and totaled with equipment. They do not
              enable probability or damage rankings.
            </p>
          </fieldset>
          <button
            type="button"
            onClick={() =>
              setBuild(i, {
                ...b,
                potentialStats: zeros(),
                skills: zeroSkills(),
              })
            }
          >
            Set no potential additions or skill levels (0)
          </button>
          <NumberField
            label="Unlocked route count"
            value={b.unlockedRoutes}
            max={4}
            onChange={(unlockedRoutes) => setBuild(i, { ...b, unlockedRoutes })}
          />
          {SLOTS.map((slot) => {
            const equipped = doc.equipment.find((e) => e.id === b.equips[slot]);
            const errors = equipped
              ? equipmentChecks(equipped, slot, doc.definition, b)
              : [];
            return (
              <fieldset key={slot}>
                <legend>{slot} slot</legend>
                <div className="definition-grid">
                  <label>
                    {slot} availability
                    <select
                      aria-label={`${slot} availability`}
                      value={b.slots[slot]}
                      onChange={(e) =>
                        setBuild(i, {
                          ...b,
                          slots: {
                            ...b.slots,
                            [slot]: e.target
                              .value as Configuration['slots'][typeof slot],
                          },
                        })
                      }
                    >
                      <option value="unknown">Unknown</option>
                      <option value="available">
                        Available (user asserted)
                      </option>
                      <option value="unavailable">Unavailable</option>
                    </select>
                  </label>
                  <label>
                    {slot} equipment
                    <select
                      aria-label={`${slot} equipment`}
                      value={b.equips[slot] ?? ''}
                      onChange={(e) =>
                        setBuild(i, {
                          ...b,
                          equips: {
                            ...b.equips,
                            [slot]: e.target.value || null,
                          },
                        })
                      }
                    >
                      <option value="">No equipment</option>
                      {doc.equipment
                        .filter((e) => e.slot === slot)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                {equipped && (
                  <p
                    className={
                      errors.length ? 'definition-notice' : 'definition-support'
                    }
                  >
                    {errors.length
                      ? errors.join(' ')
                      : 'Entered requirements met: slot, exact declared restrictions, route/SA prerequisites. This does not verify the item or slot against the game.'}
                  </p>
                )}
              </fieldset>
            );
          })}
          <label>
            Build assumptions / notes
            <textarea
              aria-label="Build assumptions / notes"
              value={b.notes}
              onChange={(e) => setBuild(i, { ...b, notes: e.target.value })}
            />
          </label>
          <div className="definition-actions">
            <button
              type="button"
              disabled={doc.configurations.length >= 30}
              onClick={() =>
                onChange({
                  ...doc,
                  configurations: [
                    ...doc.configurations,
                    {
                      ...structuredClone(b),
                      id: newId(),
                      name: `${b.name} (alternative)`,
                    },
                  ],
                })
              }
            >
              Duplicate configuration
            </button>
            <button
              type="button"
              disabled={
                doc.configurations.length <= 1 || b.id === doc.baselineId
              }
              onClick={() =>
                onChange({
                  ...doc,
                  configurations: doc.configurations.filter(
                    (x) => x.id !== b.id,
                  ),
                })
              }
            >
              Remove configuration
            </button>
          </div>
        </details>
      ))}
      <button
        type="button"
        disabled={doc.configurations.length >= 30}
        onClick={() =>
          onChange({
            ...doc,
            configurations: [
              ...doc.configurations,
              emptyConfiguration(newId(), 'Alternative build'),
            ],
          })
        }
      >
        Add configuration
      </button>
      <h2>Equipment records</h2>
      <p>
        Enter text/numeric effects and known restrictions for equipment you want
        to compare. These are user records, kept separate from the admitted orb
        catalog. No verified-only claim is made. Unresolved silver records are
        not imported.
      </p>
      {doc.equipment.map((item, i) => (
        <details
          key={item.id}
          className="definition-card"
          open={i === doc.equipment.length - 1}
        >
          <summary>
            {item.name} · {item.slot}
          </summary>
          <div className="definition-grid">
            <label>
              Equipment name
              <input
                aria-label="Equipment name"
                value={item.name}
                onChange={(e) => setEquip(i, { ...item, name: e.target.value })}
              />
            </label>
            <label>
              Equipment slot
              <select
                aria-label="Equipment slot"
                value={item.slot}
                onChange={(e) =>
                  setEquip(i, {
                    ...item,
                    slot: e.target.value as Equipment['slot'],
                  })
                }
              >
                {SLOTS.map((slot) => (
                  <option key={slot}>{slot}</option>
                ))}
              </select>
            </label>
          </div>
          <StatFields
            label="Flat equipment additions"
            value={item.stats}
            onChange={(stats) => setEquip(i, { ...item, stats })}
          />
          <fieldset>
            <legend>Equipment skill levels</legend>
            <div className="definition-grid three">
              {SKILLS.map((skill) => (
                <NumberField
                  key={skill}
                  label={`Equipment ${skill} level`}
                  value={item.skills[skill]}
                  onChange={(n) =>
                    setEquip(i, {
                      ...item,
                      skills: { ...item.skills, [skill]: n },
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={() =>
              setEquip(i, { ...item, stats: zeros(), skills: zeroSkills() })
            }
          >
            Set all equipment bonuses to 0
          </button>
          <h3>Declared restrictions</h3>
          <label>
            Other equipment effects (recorded only)
            <textarea
              aria-label="Other equipment effects (recorded only)"
              value={item.otherEffects}
              onChange={(e) =>
                setEquip(i, { ...item, otherEffects: e.target.value })
              }
            />
          </label>
          {item.otherEffects.trim() && (
            <p className="definition-notice">
              These additional effects are recorded, not calculated. Equipped
              builds retain the flat stat subtotal; modeled snapshot totals are
              unavailable.
            </p>
          )}
          {item.requirements.map((r, ri) => (
            <div key={ri}>
              <RequirementEditor
                value={r}
                onChange={(next) =>
                  setEquip(i, {
                    ...item,
                    requirements: item.requirements.map((v, j) =>
                      j === ri ? next : v,
                    ),
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  setEquip(i, {
                    ...item,
                    requirements: item.requirements.filter((_, j) => j !== ri),
                  })
                }
              >
                Remove requirement
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={item.requirements.length >= 20}
            onClick={() =>
              setEquip(i, {
                ...item,
                requirements: [
                  ...item.requirements,
                  { kind: 'type', value: doc.definition.type ?? '' },
                ],
              })
            }
          >
            Add requirement
          </button>
          <details>
            <summary>Equipment source / notes</summary>
            <SourceFields
              value={item.source}
              onChange={(source) => setEquip(i, { ...item, source })}
            />
            <code>{item.id}</code>
          </details>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...doc,
                equipment: doc.equipment.filter((e) => e.id !== item.id),
                configurations: doc.configurations.map((b) => ({
                  ...b,
                  equips: Object.fromEntries(
                    SLOTS.map((s) => [
                      s,
                      b.equips[s] === item.id ? null : b.equips[s],
                    ]),
                  ) as Configuration['equips'],
                })),
              })
            }
          >
            Remove equipment and detach it from builds
          </button>
        </details>
      ))}
      <button
        type="button"
        disabled={doc.equipment.length >= 60}
        onClick={() =>
          onChange({
            ...doc,
            equipment: [
              ...doc.equipment,
              {
                id: newId(),
                name: 'New user equipment',
                slot: 'bronze',
                stats: emptyValues(),
                skills: emptySkills(),
                requirements: [],
                otherEffects: '',
                source: userSource('equipment'),
              },
            ],
          })
        }
      >
        Add equipment
      </button>
    </section>
  );
}
