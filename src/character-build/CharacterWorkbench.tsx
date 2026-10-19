import { useState, type FormEvent } from 'react';
import {
  characterCatalog as catalog,
  defaultRequest,
} from '../data/real/character-build/goku';
import { browserStorage } from '../storage/collection';
import { compareBuilds } from './comparison';
import {
  AVAILABLE_METRICS,
  type AvailableMetric,
  type Build,
  type BuildRequest,
  type ComparisonResult,
  type Metric,
  type MetricKey,
} from './domain';
import { loadCharacterState, saveCharacterState } from './storage';
import './character.css';

const labels: Record<MetricKey, string> = {
  attack: 'Card ATK',
  defense: 'Card DEF',
  hp: 'Card HP',
  additionalSuper: 'Initial extra Super',
  additionalTrigger: 'Initial AA trigger',
  critical: 'Critical chance',
  evasion: 'Evasion chance',
  damage: 'Damage',
  battleDefense: 'Battle DEF',
};
const shortOrb = (id: string | null) =>
  catalog.orbs.find((orb) => orb.id === id)?.label ?? 'Empty';
function format(metric: Metric): string {
  return metric.value === null
    ? 'Unavailable'
    : metric.unit === 'probability'
      ? `${(metric.value * 100).toFixed(1)}%`
      : metric.value.toLocaleString('en-US');
}
function delta(value: number | null, baseline: Metric): string {
  if (value === null || baseline.value === null) return 'Unavailable';
  if (Math.abs(value) < 1e-10) return 'No change';
  const sign = value > 0 ? '+' : '−';
  if (baseline.unit === 'probability')
    return `${sign}${Math.abs(value * 100).toFixed(1)} pp`;
  const relative =
    baseline.value === 0
      ? ''
      : ` (${sign}${Math.abs((value / baseline.value) * 100).toFixed(2)}%)`;
  return `${sign}${Math.abs(value).toLocaleString('en-US')}${relative}`;
}

function BuildLabel({ build }: { build: Build }) {
  return (
    <span>
      {shortOrb(build.equips.bronze)}
      <br />
      {shortOrb(build.equips.silver)}
    </span>
  );
}

export default function CharacterWorkbench() {
  const [initial] = useState(() =>
    loadCharacterState(browserStorage(), defaultRequest(), catalog),
  );
  const [request, setRequest] = useState(initial.state);
  const [notice, setNotice] = useState(initial.warning);
  const [result, setResult] = useState<ComparisonResult | null>(() =>
    compareBuilds(initial.state, catalog),
  );
  const [frontierOnly, setFrontierOnly] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  function change(next: BuildRequest) {
    setRequest(next);
    setResult(null);
    setFailure(null);
    setNotice(saveCharacterState(browserStorage(), next, catalog));
  }
  function compare(event: FormEvent) {
    event.preventDefault();
    try {
      setResult(compareBuilds(request, catalog));
      setFailure(null);
    } catch {
      setFailure(
        'The supplied build/context could not be evaluated. Check the supported profile and inputs.',
      );
    }
  }
  const displayed =
    result?.groups.filter((group) => !frontierOnly || group.frontier) ?? [];
  return (
    <main className="cb-workbench" id="character-workbench">
      <header className="cb-hero">
        <div>
          <p className="cb-eyebrow">
            CHARACTER BUILDS / LIMITED REAL-DATA WORKBENCH
          </p>
          <h1>
            Compare Goku’s
            <br />
            <span>skill-orb choices.</span>
          </h1>
          <p>
            See the card stats and Hidden Potential checks each equip changes.
            Keep the tradeoffs visible and compare against your current build.
          </p>
        </div>
        <div className="cb-scope-stamp">
          <strong>01</strong>
          <span>EXACT CARD STATE</span>
          <b>6 real orbs</b>
          <span>LIMITED CATALOG</span>
        </div>
      </header>

      <div className="cb-evidence-notice" role="note">
        <strong>
          Source-documented model · no independent in-game verification recorded
        </strong>
        <span>
          Mathematical tests validate the implementation, not actual game
          behavior. Damage is unavailable. Full node respec is deferred until
          the exact option/prerequisite graph is verified.
        </span>
      </div>
      {notice && (
        <p className="cb-notice" role="status">
          {notice}
        </p>
      )}

      <section className="cb-card cb-unit" aria-labelledby="unit-title">
        <div className="cb-type">
          SUPER
          <br />
          <strong>AGL</strong>
          <span>UR</span>
        </div>
        <div>
          <p className="cb-eyebrow">GLOBAL ENGLISH · MYSTERY SUPER TECHNIQUE</p>
          <h2 id="unit-title">Super Saiyan 3 Goku</h2>
          <p>
            Fully EZA step 7 · Lv.140 · SA15 ·{' '}
            <strong>without Super EZA</strong>
          </p>
          <p className="cb-muted">
            Database alias 1003211. The same alias can display a different
            awakening state elsewhere.
          </p>
        </div>
        <div className="cb-profile">
          <b>55% base board filled</b>
          <span>No duplicate routes · fixed AA5 / critical0 / evasion0</span>
          <span>
            No selectable allocation nodes in this profile. Other progression
            states are excluded.
          </span>
        </div>
      </section>

      <form onSubmit={compare} className="cb-controls">
        <div className="cb-control-grid">
          <section className="cb-card" aria-labelledby="current-title">
            <p className="cb-eyebrow">01 / COMPARISON BASELINE</p>
            <h2 id="current-title">Current build</h2>
            <p className="cb-muted">
              Select your matching current equips. Empty slots are the initial
              reference, not a claim about your account.
            </p>
            {(['bronze', 'silver'] as const).map((slot) => (
              <label className="cb-field" key={slot}>
                {slot === 'bronze'
                  ? 'Current bronze equip'
                  : 'Current silver equip'}
                <select
                  value={request.current.equips[slot] ?? ''}
                  onChange={(event) =>
                    change({
                      ...request,
                      current: {
                        ...request.current,
                        equips: {
                          ...request.current.equips,
                          [slot]: event.target.value || null,
                        },
                      },
                    })
                  }
                >
                  <option value="">Empty</option>
                  {catalog.orbs
                    .filter((orb) => orb.slots.includes(slot))
                    .map((orb) => (
                      <option key={orb.id} value={orb.id}>
                        {orb.label}
                      </option>
                    ))}
                </select>
              </label>
            ))}
            <p className="cb-lock">Gold locked · zero duplicate routes</p>
            <label className="cb-check">
              <input
                type="checkbox"
                checked={request.progression.systemUnlocked}
                onChange={(event) =>
                  change({
                    ...request,
                    progression: {
                      ...request.progression,
                      systemUnlocked: event.target.checked,
                    },
                  })
                }
              />
              Hidden Potential is already unlocked; the 55% base board is
              filled.
            </label>
            <p className="cb-muted">
              This comparison does not unlock nodes or equip anything in-game.
            </p>
          </section>

          <section className="cb-card" aria-labelledby="inventory-title">
            <p className="cb-eyebrow">02 / CATALOG & OWNERSHIP</p>
            <h2 id="inventory-title">Available equipment</h2>
            <fieldset className="cb-mode">
              <legend className="sr-only">Equipment ownership mode</legend>
              <label className="cb-check">
                <input
                  type="radio"
                  name="ownership-mode"
                  checked={request.mode === 'catalog'}
                  onChange={() => change({ ...request, mode: 'catalog' })}
                />
                Ownership ignored within this catalog
              </label>
              <label className="cb-check">
                <input
                  type="radio"
                  name="ownership-mode"
                  checked={request.mode === 'inventory'}
                  onChange={() => change({ ...request, mode: 'inventory' })}
                />
                Use my inventory quantities
              </label>
            </fieldset>
            <p
              className={request.mode === 'catalog' ? 'cb-notice' : 'cb-muted'}
            >
              {request.mode === 'catalog'
                ? 'Hypothetical ownership: these six items only, not every equip in the game.'
                : 'Unequipped copies only. Your current attached equips can also be retained.'}
            </p>
            <div className="cb-inventory">
              {catalog.orbs.map((orb) => (
                <label className="cb-inventory-row" key={orb.id}>
                  <span>{orb.label}</span>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    step="1"
                    aria-label={`Unequipped copies: ${orb.label}`}
                    value={request.inventory[orb.id] ?? 0}
                    onChange={(event) =>
                      change({
                        ...request,
                        inventory: {
                          ...request.inventory,
                          [orb.id]: event.target.valueAsNumber || 0,
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <p className="cb-muted">
              Legal target changes may consume items/resources. Replacement and
              respec costs or affordability are not evaluated.
            </p>
          </section>
        </div>

        <section className="cb-card cb-context" aria-labelledby="context-title">
          <div>
            <p className="cb-eyebrow">03 / CONTEXT & OBJECTIVE</p>
            <h2 id="context-title">State the comparison</h2>
            <p>
              Turn 1 · first appearance · initial Super available · no external
              effects.
            </p>
            <p className="cb-muted">
              Card stats are before leader, passive, link and support
              multipliers. Probabilities describe an eligible check, not a
              full-turn attack chain.
            </p>
          </div>
          <div className="cb-context-controls">
            <label className="cb-field">
              Incoming-attack assumption
              <select
                value={request.context.evasionAllowed ? 'allowed' : 'disabled'}
                onChange={(event) =>
                  change({
                    ...request,
                    context: {
                      ...request.context,
                      evasionAllowed: event.target.value === 'allowed',
                    },
                  })
                }
              >
                <option value="allowed">Evasion allowed</option>
                <option value="disabled">Evasion disabled</option>
              </select>
            </label>
            <label className="cb-field">
              Sort by supported objective
              <select
                value={request.objective}
                onChange={(event) =>
                  change({
                    ...request,
                    objective: event.target.value as AvailableMetric,
                  })
                }
              >
                {AVAILABLE_METRICS.map((key) => (
                  <option key={key} value={key}>
                    {labels[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="cb-frontier-options">
            <legend>Metrics defining non-dominated alternatives</legend>
            <div>
              {AVAILABLE_METRICS.map((key) => (
                <label className="cb-check" key={key}>
                  <input
                    type="checkbox"
                    checked={request.frontierMetrics.includes(key)}
                    onChange={(event) =>
                      change({
                        ...request,
                        frontierMetrics: event.target.checked
                          ? [...request.frontierMetrics, key]
                          : request.frontierMetrics.filter((m) => m !== key),
                      })
                    }
                  />
                  {labels[key]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="cb-submit-row">
            <label className="cb-field">
              Candidate limit
              <input
                type="number"
                min="1"
                max="20000"
                step="1"
                value={request.maxCandidates}
                onChange={(event) =>
                  change({
                    ...request,
                    maxCandidates: event.target.valueAsNumber || 1,
                  })
                }
              />
            </label>
            <button className="cb-primary" type="submit">
              Compare legal builds <span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>
      </form>

      {!result && !failure && (
        <p className="cb-notice" role="status">
          Inputs changed. Compare again to update the results.
        </p>
      )}
      {failure && (
        <p className="cb-error" role="alert">
          {failure}
        </p>
      )}
      {!!result?.errors.length && (
        <div className="cb-error" role="alert">
          <strong>Comparison unavailable</strong>
          <ul>
            {result.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {result?.current && (
        <section className="cb-results" aria-labelledby="results-title">
          <div className="cb-results-heading">
            <div>
              <p className="cb-eyebrow">04 / COMPARISON</p>
              <h2 id="results-title">Tradeoffs, without a universal score</h2>
            </div>
            <span className="cb-pill">
              {request.mode === 'catalog'
                ? 'CATALOG COMPARISON'
                : 'INVENTORY COMPARISON'}
            </span>
          </div>
          <div className="cb-baseline">
            <strong>Current baseline</strong>
            {AVAILABLE_METRICS.map((key) => (
              <div key={key}>
                <span>{labels[key]}</span>
                <b>{format(result.current!.metrics[key])}</b>
              </div>
            ))}
          </div>
          <p className="cb-search" role="status">
            {result.search.evaluated} legal targets evaluated ·{' '}
            {result.search.unique} distinct evaluations · {catalog.orbs.length}
            -item catalog · {catalog.profile.label}
          </p>
          {result.search.truncated ? (
            <p className="cb-error" role="alert">
              Search truncated at {result.search.limit} targets; total legal
              count is unknown. Rankings and frontier describe evaluated targets
              only. Better alternatives may remain unexplored.
            </p>
          ) : (
            <p className="cb-muted">
              Complete enumeration of {result.search.totalLegal} legal targets
              for this profile/context/catalog. This does not establish an
              optimal damage build.
            </p>
          )}
          <div className="cb-frontier-summary">
            <p>
              <strong>Frontier metrics:</strong>{' '}
              {result.frontier.metricsUsed.map((key) => labels[key]).join(', ')}
              .<br />
              An alternative is dominated only if another is no worse on every
              listed metric and better on at least one. The current baseline is
              included; ties remain.
            </p>
            <label className="cb-check">
              <input
                type="checkbox"
                checked={frontierOnly}
                onChange={(event) => setFrontierOnly(event.target.checked)}
              />
              Show frontier only
            </label>
          </div>
          {frontierOnly && displayed.length === 0 && (
            <p className="cb-notice">
              No evaluated target is on the selected frontier. The current
              baseline can dominate targets even when the search is truncated.
              Show all targets to inspect their deltas.
            </p>
          )}
          <div
            className="cb-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Build comparison table; scroll horizontally on small screens"
          >
            <table className="cb-table">
              <caption>
                Sorted by {labels[request.objective]}; equal objective values
                share a rank. Deltas are against the current baseline. pp =
                percentage points.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rank / target equips</th>
                  {AVAILABLE_METRICS.map((key) => (
                    <th scope="col" key={key}>
                      {labels[key]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((group) => {
                  const representative =
                    group.alternatives.find((a) => a.isCurrent) ??
                    group.alternatives[0]!;
                  return (
                    <tr
                      key={group.id}
                      className={
                        representative.isCurrent ? 'cb-current-row' : ''
                      }
                    >
                      <th scope="row">
                        <div className="cb-row-badges">
                          <b>#{group.rank}</b>
                          {group.frontier && (
                            <span className="cb-pill">FRONTIER</span>
                          )}
                          {representative.isCurrent && (
                            <span className="cb-pill">CURRENT</span>
                          )}
                        </div>
                        <BuildLabel build={representative.build} />
                        <details>
                          <summary>
                            {group.alternatives.length} legal equip option
                            {group.alternatives.length === 1 ? '' : 's'}
                          </summary>
                          <p className="cb-muted">
                            Equivalent for the exposed metrics/context only.
                            Resource costs may differ.
                          </p>
                          <ul>
                            {group.alternatives.map((alternative, i) => (
                              <li key={i}>
                                <BuildLabel build={alternative.build} />
                                <p>
                                  {alternative.isCurrent
                                    ? 'Retains current choices.'
                                    : `Hypothetical target: ${alternative.changes.length} equip/choice change(s). Costs not evaluated.`}
                                </p>
                                {!!Object.keys(alternative.missingInventory)
                                  .length && (
                                  <p>
                                    Additional inventory needed:{' '}
                                    {Object.entries(
                                      alternative.missingInventory,
                                    )
                                      .map(
                                        ([id, n]) => `${n} × ${shortOrb(id)}`,
                                      )
                                      .join('; ')}
                                    .
                                  </p>
                                )}
                                <ul>
                                  {alternative.changes.map((change) => (
                                    <li key={change}>{change}</li>
                                  ))}
                                </ul>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </th>
                      {AVAILABLE_METRICS.map((key) => (
                        <td key={key}>
                          <b>{format(group.evaluation.metrics[key])}</b>
                          <span>
                            {delta(
                              group.deltas[key],
                              result.current!.metrics[key],
                            )}
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="cb-muted">
            Initial AA trigger for the baseline:{' '}
            {format(result.current.metrics.additionalTrigger)}. “Initial extra
            Super” includes the separate 50% conversion check. It is not the
            full-turn probability of a second Super.
          </p>
        </section>
      )}

      <section className="cb-card cb-boundary" aria-labelledby="boundary-title">
        <div>
          <p className="cb-eyebrow">MODEL BOUNDARY</p>
          <h2 id="boundary-title">What these numbers support</h2>
        </div>
        <div>
          <strong>Damage & battle DEF: unavailable</strong>
          <p>
            Unknown metrics are never zero and never define this frontier. Card
            ATK is not damage; card DEF and evasion chance are not survival
            estimates.
          </p>
          <ul>
            {catalog.card.excludedMechanics.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
      </section>

      <details className="cb-card cb-evidence">
        <summary>Field-level evidence & assumptions</summary>
        <p>
          Snapshot {catalog.revision}, reviewed 2026-10-18. Game build:{' '}
          {catalog.card.gameBuild ?? 'not captured'}. All admitted fields are
          source-documented; no independent game verification date is recorded.
          Agreement among sites with unknown upstream sources is not independent
          confirmation.
        </p>
        <p>
          Mathematical tests are a separate implementation check. Hypothetical
          branch-damage values appear only in arithmetic tests.
        </p>
        <div className="cb-claims">
          {catalog.evidence.map((claim) => (
            <article key={claim.id}>
              <strong>
                {claim.field} <span className="cb-pill">{claim.status}</span>
              </strong>
              <p>{claim.statement}</p>
              <p className="cb-muted">{claim.limitation}</p>
              <ul>
                {claim.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.label}
                    </a>{' '}
                    ·{' '}
                    {source.access === 'search-index'
                      ? 'indexed excerpt'
                      : 'public page'}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </details>
      <footer className="cb-footer">
        Local-only settings. No artwork, live database, account connection or
        in-game changes.
        <br />
        The synthetic team prototype remains available in the legacy demo.
      </footer>
    </main>
  );
}
