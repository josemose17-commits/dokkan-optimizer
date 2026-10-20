import { useState } from 'react';
import type { CalculationTrace } from '../character-build/domain';

export default function SequenceTrace({
  sequence,
}: {
  sequence: NonNullable<CalculationTrace['sequence']>;
}) {
  const [selected, setSelected] = useState(0);
  const result = sequence.result;
  if (result.status !== 'evaluated')
    return (
      <ul>
        {result.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    );
  const branch = result.branches[selected] ?? result.branches[0]!;
  return (
    <section className="po-sequence-trace" aria-label="Event sequence trace">
      <h3>Event sequence trace</h3>
      <p>
        {sequence.scenario} · {result.branches.length} nonzero branches ·
        probability mass {result.probabilityMass.toFixed(10)}.
      </p>
      <p className="po-muted">
        Model {sequence.modelId} · {sequence.modelRevision}. ATK/DEF columns are
        effect factors under the declared arithmetic groups, not battle stats.
      </p>
      <details>
        <summary>Sequence assumptions</summary>
        <ul>
          {sequence.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </details>
      {result.branches.length > 1 && (
        <label className="po-field">
          Inspect branch
          <select
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {result.branches.map((b, i) => (
              <option key={i} value={i}>
                {i + 1}: {(b.probability * 100).toPrecision(6)}% ·{' '}
                {b.totals.attacks} attacks / {b.totals.supers} Supers ·{' '}
                {b.alive ? 'alive' : 'dead'}
              </option>
            ))}
          </select>
        </label>
      )}
      <p>
        {branch.alive
          ? 'Alive at the end of the supplied sequence.'
          : 'Resolved death: no later actions are taken.'}{' '}
        {branch.enemyAlive
          ? ''
          : 'Enemy defeated: remaining outgoing actions stop.'}
      </p>
      <div
        className="po-sequence-scroll"
        tabIndex={0}
        role="region"
        aria-label="Event timing table"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Turn / appearance</th>
              <th scope="col">Event</th>
              <th scope="col">Attack</th>
              <th scope="col">ATK factor</th>
              <th scope="col">DEF factor</th>
              <th scope="col">Completed counters</th>
              <th scope="col">Effect / reason</th>
            </tr>
          </thead>
          <tbody>
            {branch.trace.map((e) => (
              <tr key={e.index}>
                <td>
                  {e.turn} / {e.appearance}
                </td>
                <td>{e.event}</td>
                <td>
                  {e.attack ? `${e.attack.source} · ${e.attack.kind}` : '—'}
                </td>
                <td>{e.attackFactor.toFixed(3)}×</td>
                <td>{e.defenseFactor.toFixed(3)}×</td>
                <td>
                  {e.counters.attacksPerformed} attacks /{' '}
                  {e.counters.supersPerformed} Supers /{' '}
                  {e.counters.attacksReceived} hits / {e.counters.evasions}{' '}
                  evasions
                </td>
                <td>
                  {e.effectIds.join(', ')} {e.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
