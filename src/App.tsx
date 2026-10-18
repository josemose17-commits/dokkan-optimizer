import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  OptimizationRequest,
  OptimizationResult,
  OwnedInstance,
} from './domain/types';
import {
  catalog,
  defaultOwned,
  scenarios,
  SYNTHETIC_NOTICE,
} from './data/fixtures/catalog';
import { optimize } from './engine/optimizer';
import {
  browserStorage,
  loadCollection,
  saveCollection,
} from './storage/collection';
import { CollectionEditor } from './components/CollectionEditor';
import { ResultsPanel } from './components/ResultsPanel';

export default function App() {
  const [initial] = useState(() =>
    loadCollection(browserStorage(), catalog.units, defaultOwned),
  );
  const [owned, setOwned] = useState(initial.instances);
  const leaders = catalog.units.filter((unit) => unit.leaderSkill);
  const [leaderId, setLeaderId] = useState(
    initial.instances.find((instance) =>
      leaders.some((unit) => unit.id === instance.unitId),
    )?.id ?? '',
  );
  const [friendId, setFriendId] = useState(leaders[1]!.id);
  const [scenarioId, setScenarioId] = useState(scenarios[0]!.id);
  const preset = scenarios.find((scenario) => scenario.id === scenarioId)!;
  const [turn, setTurn] = useState(preset.turn);
  const [hp, setHp] = useState(preset.hpPercent);
  const [limit, setLimit] = useState(300);
  const [storageNotice, setStorageNotice] = useState(initial.warning);
  const [output, setOutput] = useState<{
    result: OptimizationResult;
    request: OptimizationRequest;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    setStorageNotice(
      saveCollection(browserStorage(), owned) ?? initial.warning,
    );
  }, [owned, initial.warning]);

  const changeOwned = (next: OwnedInstance[]) => {
    setOwned(next);
    setOutput(null);
    if (!next.some((instance) => instance.id === leaderId))
      setLeaderId(
        next.find((instance) =>
          leaders.some((unit) => unit.id === instance.unitId),
        )?.id ?? '',
      );
  };
  const generate = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    const request: OptimizationRequest = {
      catalog,
      owned,
      leaderInstanceId: leaderId,
      friendUnitId: friendId,
      scenario: { ...preset, turn, hpPercent: hp },
      maxCandidates: limit,
      resultLimit: 5,
    };
    // Yield once to paint the busy state. This bounded reference engine then runs synchronously.
    window.setTimeout(() => {
      try {
        setOutput({ result: optimize(request), request });
      } catch {
        setFailure(
          'The reference search could not complete. Reduce the collection or candidate limit and try again.',
        );
      } finally {
        setBusy(false);
      }
    }, 0);
  };
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#top">
          <span className="brand-mark" aria-hidden="true">
            D<span>+</span>
          </span>
          <span>
            DOKKAN <strong>TEAM LAB</strong>
          </span>
        </a>
        <div className="header-meta">
          <span className="live-dot" />
          LOCAL PROTOTYPE <span className="version">v0.1</span>
        </div>
      </header>
      <main id="top">
        <div className="synthetic-banner" role="note">
          <span className="warning-symbol" aria-hidden="true">
            !
          </span>
          <div>
            <strong>{SYNTHETIC_NOTICE}</strong>
            <span>
              Fictional units, categories, links, and ratings. No verified card
              dataset is connected.
            </span>
          </div>
          <span className="pill warn-pill">SYNTHETIC DATA</span>
        </div>
        <section className="hero">
          <div>
            <span className="eyebrow">
              TRANSPARENT TEAM BUILDING / REFERENCE ENGINE
            </span>
            <h1>
              Build a team.
              <br />
              <span>See the reasoning.</span>
            </h1>
            <p>
              Edit your demo box, choose your leaders, and explore eligible
              teams with clear scores and target rotations.
            </p>
          </div>
          <div className="hero-stat">
            <strong>{owned.length.toString().padStart(2, '0')}</strong>
            <span>OWNED FIXTURE UNITS</span>
            <div>
              <strong>
                6 <span>+ 1</span>
              </strong>
              <span>OWNED + FRIEND</span>
            </div>
          </div>
        </section>
        <section
          className="panel build-panel"
          id="build"
          aria-labelledby="build-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">02 / BUILD PARAMETERS</span>
              <h2 id="build-title">Set the lineup rules</h2>
            </div>
            <span className="pill">BOTH LEADERS REQUIRED</span>
          </div>
          <form onSubmit={generate}>
            <fieldset disabled={busy}>
              <legend className="sr-only">
                Leader selection and synthetic context
              </legend>
              <div className="control-grid">
                <label>
                  Owned leader
                  <select
                    value={leaderId}
                    onChange={(event) => {
                      setLeaderId(event.target.value);
                      setOutput(null);
                    }}
                  >
                    <option value="" disabled>
                      Select an owned leader
                    </option>
                    {owned
                      .filter((instance) =>
                        leaders.some((unit) => unit.id === instance.unitId),
                      )
                      .map((instance) => (
                        <option key={instance.id} value={instance.id}>
                          {
                            catalog.units.find(
                              (unit) => unit.id === instance.unitId,
                            )!.name
                          }
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Friend leader
                  <select
                    value={friendId}
                    onChange={(event) => {
                      setFriendId(event.target.value);
                      setOutput(null);
                    }}
                  >
                    {leaders.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                  <small>
                    Independent seventh slot; ownership is not required.
                  </small>
                </label>
                <label>
                  Synthetic exercise
                  <select
                    value={scenarioId}
                    onChange={(event) => {
                      const next = scenarios.find(
                        (scenario) => scenario.id === event.target.value,
                      )!;
                      setScenarioId(next.id);
                      setTurn(next.turn);
                      setHp(next.hpPercent);
                      setOutput(null);
                    }}
                  >
                    {scenarios.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.name}
                      </option>
                    ))}
                  </select>
                  <small>{preset.description}</small>
                </label>
              </div>
              <div className="context-controls">
                <label>
                  Context turn
                  <input
                    type="number"
                    min="1"
                    max="99"
                    required
                    value={turn}
                    onChange={(event) => {
                      setTurn(Number(event.target.value));
                      setOutput(null);
                    }}
                  />
                </label>
                <label>
                  Context HP (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={hp}
                    onChange={(event) => {
                      setHp(Number(event.target.value));
                      setOutput(null);
                    }}
                  />
                </label>
                <label>
                  Candidate limit
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    required
                    value={limit}
                    onChange={(event) => {
                      setLimit(Number(event.target.value));
                      setOutput(null);
                    }}
                  />
                </label>
                <p className="subtle">
                  Context values test declared fixture conditions.
                  <br />
                  They do not predict battle state or survival.
                </p>
                <button type="submit" className="primary-button">
                  {busy ? 'Evaluating…' : 'Generate teams'}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </fieldset>
          </form>
          {failure && (
            <p className="notice error" role="alert">
              {failure}
            </p>
          )}
        </section>
        <div className="workspace-grid">
          <CollectionEditor
            owned={owned}
            onChange={changeOwned}
            storageNotice={storageNotice}
          />
          <div className="results-column">
            {output ? (
              <ResultsPanel
                key={`${output.request.leaderInstanceId}/${output.request.friendUnitId}/${output.request.scenario.id}/${output.request.maxCandidates}/${output.result.teams[0]?.key}`}
                result={output.result}
                request={output.request}
              />
            ) : (
              <section className="panel empty-state" id="results">
                <div className="empty-icon" aria-hidden="true">
                  ⌘
                </div>
                <span className="eyebrow">03 / CANDIDATE TEAMS</span>
                <h2>Your next lineup starts here.</h2>
                <p>
                  Generate teams to compare the heuristic scores, see every
                  leader check, and inspect two target pairs plus three
                  floaters.
                </p>
                <div className="empty-steps">
                  <span>
                    01
                    <br />
                    <strong>Check eligibility</strong>
                  </span>
                  <span>
                    02
                    <br />
                    <strong>Evaluate 105 layouts</strong>
                  </span>
                  <span>
                    03
                    <br />
                    <strong>Explain the tradeoffs</strong>
                  </span>
                </div>
              </section>
            )}
            <details className="data-blocker">
              <summary>Why does this prototype use synthetic data?</summary>
              <p>
                No import-ready real-data source was verified. DokkanAPI
                prohibits automated internal-endpoint requests; DokkanWiki
                publishes restrictive reuse terms. Fandom text may be reusable
                with attribution/share-alike requirements, but authorized import
                access and validated structured mechanics remain unresolved.
                Dokkan Info terms could not be verified in this pass.
              </p>
              <p>
                The repository includes a dated source review, links to the
                policies, an update strategy, and the requirements for a future
                verified adapter. No third-party database or artwork was copied.
              </p>
            </details>
          </div>
        </div>
      </main>
      <footer>
        <span>
          DOKKAN TEAM LAB{' '}
          <span className="muted-text">
            / SMALL-COLLECTION REFERENCE ENGINE
          </span>
        </span>
        <span>
          Heuristics, not combat simulation. No publisher affiliation.
        </span>
      </footer>
    </div>
  );
}
