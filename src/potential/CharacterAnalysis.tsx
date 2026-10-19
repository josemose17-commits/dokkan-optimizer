import { useState } from 'react';
import {
  guidanceContext,
  kitEffects,
  type ReviewedKit,
} from '../character-build/kit';
import { kitGuidance, type GuidanceFocus } from '../character-build/policy';
import type { KitReason } from '../character-build/assignment';
import { inspectCondition } from '../character-definitions/evaluation';

export default function CharacterAnalysis({ kit }: { kit: ReviewedKit }) {
  const [focus, setFocus] = useState<GuidanceFocus>('buildup');
  const [evasion, setEvasion] = useState(true);
  const context = guidanceContext(kit.stateId);
  const result = kitGuidance(kit, context, focus, evasion);
  const effects = kitEffects(kit);
  const reasons = (rows: KitReason[]) => (
    <ul>
      {rows.map((r) => (
        <li key={r.text}>
          {r.text}
          <details>
            <summary>Supporting effects</summary>
            {r.effectIds.length ? (
              <ul>
                {r.effectIds.map((id) => (
                  <li key={id}>
                    {effects.find((e) => e.id === id)?.label ?? id}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Explicit context input.</p>
            )}
          </details>
        </li>
      ))}
    </ul>
  );
  return (
    <section className="po-card kit-analysis" aria-label="Character analysis">
      <p className="po-eyebrow">KIT → ASSIGNMENT → BUILD PRIORITIES</p>
      <h2>Designed for</h2>
      <p className="po-muted">
        Reviewed inference from effect timing and dependencies; this describes
        the kit’s job.
      </p>
      <dl className="kit-assignment">
        <div>
          <dt>Primary position</dt>
          <dd>
            {result.assignment.position === '1'
              ? 'Slot 1'
              : result.assignment.position}
          </dd>
        </div>
        <div>
          <dt>Rotation assignment</dt>
          <dd>{result.assignment.rotation}</dd>
        </div>
        <div>
          <dt>Primary role</dt>
          <dd>{result.assignment.role}</dd>
        </div>
        <div>
          <dt>Secondary role</dt>
          <dd>{result.assignment.secondaryRole ?? 'Not established'}</dd>
        </div>
      </dl>
      {result.assignment.secondary.map((s) => (
        <p key={s}>Secondary position: {s}.</p>
      ))}
      {reasons(result.assignment.reasons)}
      <h2>Preferred potential emphasis</h2>
      <p className="kit-emphasis">{result.emphasis}</p>
      <p className="po-muted">
        Method: {result.method}. No numerical winning allocation is claimed.
      </p>
      <p className="po-muted">
        Context: untransformed, before attacking on battle turn 3, second
        appearance; early buildup with a qualifying Super. Entry-turn protection
        is not assumed active. Attack counters and incoming damage are
        unspecified.
      </p>
      {reasons(result.why)}
      <h3>Equip effect priorities</h3>
      {reasons(result.equipment)}
      <details>
        <summary>Advanced priority override</summary>
        <label className="po-field">
          Priority
          <select
            aria-label="Priority"
            value={focus}
            onChange={(e) => setFocus(e.target.value as GuidanceFocus)}
          >
            <option value="buildup">Lasting defensive buildup (default)</option>
            <option value="opening-protection">
              Protection before the first Super
            </option>
          </select>
        </label>
        <label className="po-check">
          <input
            type="checkbox"
            checked={evasion}
            onChange={(e) => setEvasion(e.target.checked)}
          />
          Incoming attacks are evadable
        </label>
        <p>
          The override changes build priorities, not the inferred kit design. No
          enemy damage threshold is assumed.
        </p>
      </details>
      <details>
        <summary>Conflicts and conditions</summary>
        {reasons([...result.assignment.conditions, ...result.conflicts])}
      </details>
      <div className="kit-build-gate">
        <h3>Cannot recommend exact levels or items yet</h3>
        <p>
          A complete attainable set and compatible items are not established for
          this state. No allocation search or change from your current build is
          claimed.
        </p>
        <details>
          <summary>Missing exact-build evidence</summary>
          <ul>
            {result.exactBuild.reasons.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p>No resource-cost estimate is reported.</p>
        </details>
      </div>
      <details>
        <summary>Kit facts, sources and support limits</summary>
        <p>
          Source-documented · no independent in-game confirmation. Structured
          interpretation supports qualitative reasoning only; combat/probability
          calculations are unavailable.
        </p>
        <ul>
          {kit.notes.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <ul>
          {effects.map((e) => (
            <li key={e.id}>
              <strong>{e.label}</strong>: {e.description}{' '}
              <a href={e.source.reference} target="_blank" rel="noreferrer">
                Source
              </a>
              <span className="po-muted">
                {' '}
                · {e.timing} · {e.duration.kind}
                {e.duration.count === null ? '' : ` ${e.duration.count}`} ·{' '}
                {e.representation} · calculation unavailable
              </span>
              <p className="po-muted">
                Recorded value:{' '}
                {e.amount === null ? 'not specified' : `${e.amount} ${e.unit}`}{' '}
                · target: {e.target} · stacking: {e.stacking} · cap:{' '}
                {e.cap ?? 'not admitted'}.<br />
                Qualitative condition:{' '}
                {inspectCondition(e.condition, context).state} —{' '}
                {inspectCondition(e.condition, context).reason}
              </p>
            </li>
          ))}
        </ul>
        <ul>
          {kit.references.map((r) => (
            <li key={r.id}>
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.label}
              </a>{' '}
              · reviewed {r.reviewedAt} · independent confirmation:{' '}
              {r.independentConfirmation ?? 'none'}
            </li>
          ))}
        </ul>
        <p>Kit revision: {kit.revision}</p>
      </details>
    </section>
  );
}
