import { useState } from 'react';
import type {
  CoverageRow,
  OptimizationRequest,
  OptimizationResult,
  Participant,
  RuleResult,
  ScoreComponents,
} from '../domain/types';
import { SCORE_LABELS, SCORE_WEIGHTS, sharedLinks } from '../engine/scoring';

const fixed = (value: number) => value.toFixed(1);
const signed = (value: number) => `${value >= 0 ? '+' : ''}${fixed(value)}`;
const statusLabel = (outcome: RuleResult) =>
  outcome.status === 'met'
    ? 'Covered'
    : outcome.status === 'unmet'
      ? 'Uncovered'
      : 'Unsupported';
function ParticipantName({ participant }: { participant: Participant }) {
  return (
    <>
      <span>{participant.unit.name}</span>
      {participant.origin === 'friend' && (
        <span className="friend-badge">FRIEND</span>
      )}
    </>
  );
}

export function CoverageTable({
  rows,
  leaderLabel,
  friendLabel,
}: {
  rows: CoverageRow[];
  leaderLabel: string;
  friendLabel: string;
}) {
  return (
    <div className="table-scroll">
      <table className="coverage-table">
        <caption>
          All seven participants checked independently under each leader
        </caption>
        <thead>
          <tr>
            <th scope="col">Participant</th>
            <th scope="col">
              Leader
              <br />
              <small>{leaderLabel}</small>
            </th>
            <th scope="col">
              Friend leader
              <br />
              <small>{friendLabel}</small>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.participant.id}>
              <th scope="row">
                <ParticipantName participant={row.participant} />
              </th>
              {[row.leader, row.friendLeader].map((outcome, index) => (
                <td key={index}>
                  <span
                    className={`status status-${outcome.status}`}
                    title={outcome.reasons.join(' ')}
                  >
                    {statusLabel(outcome)}
                  </span>
                  {outcome.status !== 'met' && (
                    <small className="coverage-reason">
                      {outcome.reasons.join(' ')}
                    </small>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResultsPanel({
  result,
  request,
}: {
  result: OptimizationResult;
  request: OptimizationRequest;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const team = result.teams[selectedIndex] ?? result.teams[0];
  const leaderLabel =
    request.catalog.units.find(
      (unit) =>
        unit.id ===
        request.owned.find(
          (instance) => instance.id === request.leaderInstanceId,
        )?.unitId,
    )?.name ?? 'No leader';
  const friendLabel =
    request.catalog.units.find((unit) => unit.id === request.friendUnitId)
      ?.name ?? 'No friend';
  const nameForOwned = (id: string) =>
    request.catalog.units.find(
      (unit) =>
        unit.id ===
        request.owned.find((instance) => instance.id === id)?.unitId,
    )?.name ?? id;
  const getParticipant = (id: string) =>
    team!.participants.find((participant) => participant.id === id)!;
  return (
    <section
      id="results"
      className="results-section"
      aria-labelledby="results-title"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">03 / REFERENCE SEARCH</span>
          <h2 id="results-title">Candidate teams</h2>
        </div>
        <span className={`pill ${result.search.truncated ? 'warn-pill' : ''}`}>
          {result.search.truncated
            ? 'TRUNCATED'
            : result.errors.length
              ? 'NEEDS INPUT'
              : 'SEARCH COMPLETE'}
        </span>
      </div>
      <div className="search-summary" role="status">
        <strong>{result.search.eligible} eligible</strong>
        <span>
          {result.search.evaluated} evaluated / {result.search.possible}{' '}
          possible
        </span>
        <span>
          {result.search.rejected} rejected · limit {result.search.limit}
        </span>
      </div>
      <p
        className={result.search.truncated ? 'notice inline-warning' : 'subtle'}
      >
        {result.search.summary}
      </p>
      {!!result.errors.length && (
        <div className="notice error" role="alert">
          <ul>
            {result.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {!team && !result.errors.length && (
        <div className="panel empty-state">
          <h3>No eligible team in this search</h3>
          <p>
            Review the separate leader checks and restrictions below. Change the
            collection or leader pair, or increase a truncated search limit.
          </p>
        </div>
      )}
      {team && (
        <>
          <div className="rank-list" aria-label="Ranked candidate teams">
            {result.teams.map((candidate, index) => (
              <button
                key={candidate.key}
                className={`rank-button ${index === selectedIndex ? 'selected' : ''}`}
                type="button"
                aria-pressed={index === selectedIndex}
                onClick={() => setSelectedIndex(index)}
              >
                <span>#{index + 1}</span>
                <strong>{fixed(candidate.total!)}</strong>
                <small>heuristic</small>
              </button>
            ))}
          </div>
          <article className="panel team-result">
            <div className="team-title">
              <div>
                <span className="eyebrow">ELIGIBLE / BOTH LEADERS</span>
                <h3>Candidate #{selectedIndex + 1}</h3>
                <p className="subtle">
                  Six owned instances + one friend · ranked within the explored
                  search
                </p>
              </div>
              <div className="total-score">
                <strong>{fixed(team.total!)}</strong>
                <span>/ 100 heuristic</span>
              </div>
            </div>
            <div className="score-grid">
              {(Object.keys(SCORE_WEIGHTS) as (keyof ScoreComponents)[]).map(
                (key) => (
                  <div className="score-component" key={key}>
                    <span>{SCORE_LABELS[key]}</span>
                    <strong>
                      {fixed(team.components![key])}
                      <small>/100</small>
                    </strong>
                    <div className="score-track">
                      <span style={{ width: `${team.components![key]}%` }} />
                    </div>
                    <small>
                      {SCORE_WEIGHTS[key] * 100}% weight ·{' '}
                      {fixed(team.components![key] * SCORE_WEIGHTS[key])} points
                    </small>
                  </div>
                ),
              )}
            </div>
            <p className="score-note">
              Scenario fit uses arbitrary fixture ratings. It is not damage,
              survivability, or a win probability. Full leader coverage is
              required before these weights are applied.
            </p>
            <div className="result-divider" />
            <div className="section-heading compact">
              <h3>Target rotations</h3>
              <span className="pill muted">7 / 7 PARTICIPANTS</span>
            </div>
            <p className="subtle">
              Two disjoint main pairs and three floaters, including the friend.
              These are targets, not guaranteed opening rotations.
            </p>
            <div className="rotation-board">
              <div className="pair-grid">
                {team.layout!.pairs.map((pair, index) => (
                  <div className="rotation-pair" key={pair.join('/')}>
                    <span className="eyebrow">MAIN PAIR {index + 1}</span>
                    {pair.map((id) => (
                      <div
                        className="participant-slot"
                        data-participant-id={id}
                        key={id}
                      >
                        <span className="slot-dot" />
                        <ParticipantName participant={getParticipant(id)} />
                      </div>
                    ))}
                    <p>
                      {sharedLinks(
                        getParticipant(pair[0]),
                        getParticipant(pair[1]),
                        request.catalog,
                      )
                        .map((link) => link.name)
                        .join(' + ') || 'No shared synthetic links'}
                    </p>
                  </div>
                ))}
              </div>
              <div className="floater-row">
                <span className="eyebrow">FLOATERS</span>
                <div>
                  {team.layout!.floaters.map((id) => (
                    <span
                      className="floater-chip"
                      data-participant-id={id}
                      key={id}
                    >
                      <ParticipantName participant={getParticipant(id)} />
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <details className="result-details" open>
              <summary>Leader coverage · 14 independent checks</summary>
              <p className="subtle">
                Leader:{' '}
                {
                  request.catalog.units.find(
                    (unit) => unit.name === leaderLabel,
                  )?.leaderSkill?.label
                }
                <br />
                Friend:{' '}
                {
                  request.catalog.units.find(
                    (unit) => unit.name === friendLabel,
                  )?.leaderSkill?.label
                }
              </p>
              <CoverageTable
                rows={team.coverage}
                leaderLabel={leaderLabel}
                friendLabel={friendLabel}
              />
            </details>
            <details className="result-details">
              <summary>Why these participants & conditional effects</summary>
              <p className="subtle">
                Selected by the displayed weighted heuristic and target layout.
                A context snapshot does not simulate how HP or turns evolve.
              </p>
              {team.participants.map((participant) => (
                <div className="reason-row" key={participant.id}>
                  <strong>
                    <ParticipantName participant={participant} />
                  </strong>
                  <p>
                    {
                      team.explanations.find(
                        (item) => item.participantId === participant.id,
                      )?.text
                    }
                  </p>
                  <p className="subtle">
                    Base fixture ratings: pressure{' '}
                    {participant.unit.syntheticRatings.pressure}, sustain{' '}
                    {participant.unit.syntheticRatings.sustain}, utility{' '}
                    {participant.unit.syntheticRatings.utility}.
                  </p>
                  {team.effects
                    .filter((effect) => effect.participantId === participant.id)
                    .map((effect) => (
                      <div className="effect-row" key={effect.effectId}>
                        <span
                          className={`status status-${effect.outcome.status}`}
                        >
                          {effect.outcome.status === 'met'
                            ? 'Active'
                            : effect.outcome.status === 'unmet'
                              ? 'Unmet'
                              : 'Unsupported'}
                        </span>
                        <span>
                          <strong>{effect.label}</strong>
                          <small>{effect.outcome.reasons.join(' ')}</small>
                        </span>
                      </div>
                    ))}
                </div>
              ))}
            </details>
            <details className="result-details" open>
              <summary>Weaknesses & unsupported mechanics</summary>
              <ul className="weakness-list">
                {team.weaknesses.map((text) => (
                  <li key={text}>{text}</li>
                ))}
                {team.warnings.map((text) => (
                  <li className="warning-text" key={text}>
                    {text}
                  </li>
                ))}
              </ul>
            </details>
            <details className="result-details">
              <summary>Eligible one-unit replacements</summary>
              <p className="subtle">
                Up to three best single swaps found among evaluated eligible
                teams. Each keeps the leader and friend, passes both coverage
                checks, and has its target rotations reevaluated. This is not an
                exhaustive replacement search when truncated.
              </p>
              {!team.replacements.length && (
                <p>
                  No eligible one-unit swap was found in the evaluated candidate
                  set.
                </p>
              )}
              {team.replacements.map((replacement) => (
                <div className="replacement" key={replacement.alternativeKey}>
                  <strong>
                    {nameForOwned(replacement.outId)} →{' '}
                    {nameForOwned(replacement.inId)}
                  </strong>
                  <span>
                    {fixed(replacement.total)} total (
                    {signed(replacement.delta)})
                  </span>
                  <small>
                    {(Object.keys(SCORE_LABELS) as (keyof ScoreComponents)[])
                      .map(
                        (key) =>
                          `${SCORE_LABELS[key]} ${signed(replacement.componentDeltas[key])}`,
                      )
                      .join(' · ')}
                  </small>
                </div>
              ))}
            </details>
          </article>
        </>
      )}
      <details className="panel diagnostics">
        <summary>Eligibility diagnostics & rejected examples</summary>
        <p className="subtle">
          Rejection counts can overlap: one candidate may fail multiple checks.
          Showing at most three rejected candidates.
        </p>
        <ul>
          {Object.entries(result.rejectionCounts).map(([reason, count]) => (
            <li key={reason}>
              <strong>{count}×</strong> {reason}
            </li>
          ))}
        </ul>
        {!result.search.rejected && <p>No evaluated candidate was rejected.</p>}
        {result.rejectedExamples.map((example, index) => (
          <details className="result-details" key={example.key}>
            <summary>Rejected example {index + 1}</summary>
            <ul>
              {example.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {!!example.coverage.length && (
              <CoverageTable
                rows={example.coverage}
                leaderLabel={leaderLabel}
                friendLabel={friendLabel}
              />
            )}
          </details>
        ))}
      </details>
      <details className="model-notes">
        <summary>Model assumptions & search limitations</summary>
        <ul>
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
        <p>
          Link affinity: average shared synthetic weight of the two main pairs,
          divided by all available synthetic link weight. Identical fixture-card
          pairs receive zero affinity by demo convention. Floaters receive no
          fixed-partner credit.
        </p>
        <p>
          Condition score is the fraction of declared effects satisfied; no
          effects yields 100. Active bonuses alter only hand-authored ratings,
          clamped to 0–100. Scenario fit averages their context-weighted values
          across all seven slots. This model is not a combat formula.
        </p>
        <p>
          Every eligible team has a coverage score of 100, so its 20 weighted
          points are constant. It can never offset a failed eligibility check.
        </p>
      </details>
    </section>
  );
}
