import { useEffect, useRef, useState, type FormEvent } from 'react';
import { browserStorage } from '../storage/collection';
import { compareBuilds } from './comparison';
import {
  METRIC_DIRECTION,
  METRIC_LABELS as labels,
  SLOTS,
  type AvailableMetric,
  type Build,
  type BuildGroup,
  type BuildRequest,
  type ComparisonResult,
  type EvaluatorEntry,
  type Skill,
  type Slot,
} from './domain';
import { download } from './download';
import { explainGroup, itemLabel } from './explanation';
import { formatDelta as delta, formatMetric as format } from './format';
import { estimateCandidateSpace } from './generation';
import { orbErrors } from './legality';
import ResultExplanation from './ResultExplanation';
import SavedBuilds from './SavedBuilds';
import {
  INVALID_SETTINGS_NOTICE,
  loadCharacterState,
  saveCharacterState,
} from './storage';
import './character.css';

// Catalog identity of the exact state being optimized (never from the evaluator).
export interface Identity {
  name: string;
  title: string | null;
  type: string | null;
  cardClass: string | null;
  rarity: string | null;
  region: string | null;
  awakening: string;
  level: number | null;
  superAttackLevel: number | null;
  aliases: string[];
}

const MAX_LIMIT = 20000;
const SKILL_NAMES: Record<Skill, string> = {
  additional: 'Additional Attack',
  critical: 'Critical Hit',
  evasion: 'Evasion',
};
const quantityIssue = (n: number | undefined) =>
  n === undefined || (Number.isSafeInteger(n) && n >= 0 && n <= 999)
    ? null
    : 'Enter a whole number from 0 to 999.';

function BuildLabel({ entry, build }: { entry: EvaluatorEntry; build: Build }) {
  const slots = SLOTS.filter(
    (slot) =>
      build.equips[slot] !== null ||
      entry.model.orbs.some((orb) => orb.slots.includes(slot)),
  );
  return (
    <span>
      {slots.map((slot, i) => (
        <span key={slot}>
          {i > 0 && <br />}
          {itemLabel(entry, build.equips[slot])}
        </span>
      ))}
      {Object.entries(build.choices).map(([node, skill]) => (
        <span key={node}>
          <br />
          {node}: {SKILL_NAMES[skill]}
        </span>
      ))}
    </span>
  );
}

// One-line, computed status for a result row: objective vs baseline and
// frontier membership. Details are in the explanation panel.
function rowSummary(
  group: BuildGroup,
  objective: AvailableMetric,
  groups: BuildGroup[],
) {
  const change = group.deltas[objective];
  const higher = METRIC_DIRECTION[objective] === 'higher';
  const relation =
    change === null || change === 0
      ? 'ties the baseline'
      : change > 0 === higher
        ? 'above the baseline'
        : 'below the baseline';
  const dominator = group.dominatedBy;
  const frontier = group.frontier
    ? 'on the frontier'
    : dominator?.kind === 'baseline'
      ? 'dominated by the baseline'
      : dominator?.kind === 'group'
        ? `dominated by #${groups.find((g) => g.id === dominator.id)?.rank ?? '?'}`
        : 'frontier unavailable';
  return `${relation} · ${frontier}`;
}

export default function CharacterWorkbench({
  entry,
  identity,
  available,
  pending,
  onOpen,
}: {
  entry: EvaluatorEntry;
  identity: Identity;
  available: readonly EvaluatorEntry[];
  pending: { request: BuildRequest; message: string } | null;
  onOpen: (
    entry: EvaluatorEntry,
    request: BuildRequest,
    message: string,
  ) => void;
}) {
  const model = entry.model;
  const { profile } = model;
  const shortItem = (id: string | null) => itemLabel(entry, id);
  const describeRequest = (r: BuildRequest) =>
    `${
      SLOTS.filter((s) => r.current.equips[s] !== null)
        .map((s) => shortItem(r.current.equips[s]))
        .join(' / ') || 'No equips'
    } · ${r.mode === 'catalog' ? 'ownership ignored' : 'inventory'} · evasion ${
      r.context.evasionAllowed ? 'allowed' : 'disabled'
    } · sorted by ${labels[r.objective] ?? 'an unsupported objective'}`;

  const [initial] = useState(() => {
    if (!pending) return loadCharacterState(browserStorage(), entry);
    // Settings handed over from a saved build are applied and saved at once.
    const failure = saveCharacterState(
      browserStorage(),
      pending.request,
      entry,
    );
    return {
      state: pending.request,
      warning: failure ?? pending.message,
      raw: null,
    };
  });
  const [request, setRequest] = useState(initial.state);
  const [notice, setNotice] = useState(initial.warning);
  // Unusable stored settings stay downloadable until an edit replaces them.
  const [unreadable, setUnreadable] = useState(initial.raw);
  const [result, setResult] = useState<ComparisonResult | null>(() => {
    try {
      return compareBuilds(initial.state, entry);
    } catch {
      return null;
    }
  });
  const [frontierOnly, setFrontierOnly] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [explained, setExplained] = useState<{
    groupId: string;
    alternative: number | undefined;
  } | null>(null);
  const explanationRef = useRef<HTMLHeadingElement>(null);
  // The limit is edited as text so a cleared field is not silently replaced.
  const [limitDraft, setLimitDraft] = useState(String(request.maxCandidates));
  const unitRef = useRef<HTMLElement>(null);
  const [identityPinned, setIdentityPinned] = useState(false);
  useEffect(() => {
    const unit = unitRef.current;
    if (!unit || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([item]) =>
      setIdentityPinned(
        !item!.isIntersecting && item!.boundingClientRect.top < 0,
      ),
    );
    observer.observe(unit);
    return () => observer.disconnect();
  }, []);
  // While a field draft is invalid, nothing is autosaved: the stored value
  // would otherwise differ from what the field shows.
  function persist(
    next: BuildRequest,
    success: string | null,
    draftValid: boolean,
  ) {
    if (!draftValid) return setNotice(INVALID_SETTINGS_NOTICE);
    const failure = saveCharacterState(browserStorage(), next, entry);
    if (!failure) setUnreadable(null);
    setNotice(failure ?? success);
  }
  function change(next: BuildRequest, draftValid = limitIssue === null) {
    setRequest(next);
    setResult(null);
    setExplained(null);
    setFailure(null);
    persist(next, null, draftValid);
  }
  function replaceRequest(next: BuildRequest, message: string) {
    setRequest(next);
    setResult(null);
    setExplained(null);
    setFailure(null);
    setLimitDraft(String(next.maxCandidates));
    persist(next, message, true);
  }
  const limitNumber = Number(limitDraft);
  const limitIssue =
    limitDraft.trim() !== '' &&
    Number.isSafeInteger(limitNumber) &&
    limitNumber >= 1 &&
    limitNumber <= MAX_LIMIT
      ? null
      : 'Enter a whole number from 1 to 20,000.';
  const unlockIssue = request.progression.systemUnlocked
    ? null
    : `Required: this evaluator supports only an unlocked system with the profile “${profile.label}”.`;
  const frontierIssue = request.frontierMetrics.length
    ? null
    : 'Select at least one metric.';
  const issueCount =
    [limitIssue, unlockIssue, frontierIssue].filter(Boolean).length +
    model.orbs.filter((orb) => quantityIssue(request.inventory[orb.id])).length;
  const space = estimateCandidateSpace(request, entry);
  const context =
    entry.contexts.find((c) => c.id === request.context.id) ??
    entry.contexts[0]!;
  // Items offered per slot: eligible for this exact state and profile.
  const slotItems = (slot: Slot) =>
    model.orbs.filter(
      (orb) =>
        orb.slots.includes(slot) &&
        (!orbErrors(orb, slot, request, model).length ||
          request.current.equips[slot] === orb.id),
    );
  const lockedReason = (slot: Slot) =>
    slot === 'gold' && request.progression.routes.length < 2
      ? 'requires two unlocked duplicate routes'
      : slot === 'silver' && request.superAttackLevel < 10
        ? 'requires SA 10'
        : `no admitted ${slot} item for this state`;

  function compare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExplained(null);
    if (issueCount) {
      setResult(null);
      setFailure(
        `Fix ${issueCount} highlighted input${issueCount === 1 ? '' : 's'} before comparing.`,
      );
      event.currentTarget
        .querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
      return;
    }
    try {
      setResult(compareBuilds(request, entry));
      setFailure(null);
    } catch {
      setFailure(
        'The supplied build/context could not be evaluated. Check the supported profile and inputs.',
      );
    }
  }
  const displayed =
    result?.groups.filter((group) => !frontierOnly || group.frontier) ?? [];
  // Default explanation: the top-ranked result that changes something.
  const defaultGroup =
    result?.groups.find((g) => !g.alternatives.some((a) => a.isCurrent)) ??
    result?.groups[0];
  const explainedId = explained?.groupId ?? defaultGroup?.id ?? null;
  let explanation = null;
  let explanationError = false;
  if (result?.current && explainedId) {
    try {
      explanation = explainGroup(
        result,
        request,
        entry,
        explainedId,
        explained?.alternative,
      );
    } catch {
      explanationError = true;
    }
  }
  function explain(groupId: string, alternative?: number) {
    setExplained({ groupId, alternative });
    requestAnimationFrame(() => explanationRef.current?.focus());
  }
  const typeLine = [identity.cardClass, identity.type, identity.rarity]
    .filter(Boolean)
    .join(' ');
  const levelLine = `Lv.${identity.level ?? '?'} · SA${identity.superAttackLevel ?? '?'}`;
  const routesText =
    profile.routes.length === 0
      ? 'No duplicate routes'
      : `${profile.routes.length} duplicate route${profile.routes.length === 1 ? '' : 's'}`;
  const fixed = profile.fixedSkills;

  return (
    <main className="cb-workbench" id="character-workbench">
      <div
        className="cb-identity-bar"
        data-pinned={identityPinned ? 'true' : 'false'}
        aria-hidden={identityPinned ? undefined : true}
      >
        {typeLine && <span className="cb-identity-type">{typeLine}</span>}
        <strong>{identity.name}</strong>
        {identity.title && <span>{identity.title}</span>}
        <span>
          {identity.awakening} · {levelLine}
        </span>
        <span>{profile.label}</span>
      </div>
      <header className="cb-hero">
        <div>
          <p className="cb-eyebrow">
            CHARACTER BUILDS / LIMITED REAL-DATA WORKBENCH
          </p>
          <h1>
            Optimize {identity.name}
            <br />
            <span>with explained tradeoffs.</span>
          </h1>
          <p>
            See the card stats and Hidden Potential checks each equip changes,
            why each result ranks where it does, and what is not modeled.
          </p>
        </div>
        <div className="cb-scope-stamp">
          <strong>01</strong>
          <span>EXACT CARD STATE</span>
          <b>{model.orbs.length} items</b>
          <span>{entry.objectives.length} SUPPORTED OBJECTIVES</span>
        </div>
      </header>

      <div className="cb-evidence-notice" role="note">
        <strong>
          {model.evidence.some((e) => e.status === 'independently-corroborated')
            ? 'Some facts independently corroborated; see evidence'
            : 'Source-documented model · no independent in-game verification recorded'}
        </strong>
        <span>
          Mathematical tests validate the implementation, not actual game
          behavior. Unavailable metrics are listed, never shown as zero.
        </span>
      </div>
      {notice && (
        <p className="cb-notice" role="status">
          {notice}
        </p>
      )}
      {unreadable !== null && (
        <div className="cb-button-row cb-unreadable">
          <button
            type="button"
            className="cb-secondary"
            onClick={() =>
              download('dokkan-character-settings-unreadable.json', unreadable)
            }
          >
            Download stored settings copy
          </button>
        </div>
      )}

      <section
        className="cb-card cb-unit"
        aria-labelledby="unit-title"
        ref={unitRef}
      >
        <div className="cb-type">
          {identity.cardClass?.toUpperCase() ?? '?'}
          <br />
          <strong>{identity.type ?? '?'}</strong>
          <span>{identity.rarity ?? '?'}</span>
        </div>
        <div>
          <p className="cb-eyebrow">
            {(identity.region ?? 'REGION UNKNOWN').toUpperCase()}
            {identity.title && ` · ${identity.title.toUpperCase()}`}
          </p>
          <h2 id="unit-title">{identity.name}</h2>
          <p>
            {identity.awakening} · {levelLine}
          </p>
          <p className="cb-muted">
            State <code>{entry.stateId}</code>
            {identity.aliases.length > 0 &&
              ` · source alias ${identity.aliases.join(', ')}. The same alias can display a different awakening state elsewhere.`}
          </p>
        </div>
        <div className="cb-profile">
          <b>{profile.label}</b>
          <span>
            {routesText} · fixed AA{fixed.additional} / critical
            {fixed.critical} / evasion{fixed.evasion}
          </span>
          <span>
            {profile.nodes.length
              ? `${request.progression.activatedNodes.length} selectable choice node(s) in this profile.`
              : 'No selectable allocation nodes in this profile.'}{' '}
            Other progression states are excluded.
          </span>
        </div>
      </section>

      <SavedBuilds
        entry={entry}
        available={available}
        request={request}
        describe={describeRequest}
        inputIssues={issueCount}
        onReplace={replaceRequest}
        onOpen={onOpen}
      />

      <form onSubmit={compare} className="cb-controls" noValidate>
        <div className="cb-control-grid">
          <section className="cb-card" aria-labelledby="current-title">
            <p className="cb-eyebrow">01 / COMPARISON BASELINE</p>
            <h2 id="current-title">Current build</h2>
            <p className="cb-muted">
              Select your matching current equips. Empty slots are the initial
              reference, not a claim about your account.
            </p>
            {SLOTS.map((slot) => {
              const items = slotItems(slot);
              if (!items.length)
                return (
                  <p className="cb-lock" key={slot}>
                    {slot[0]!.toUpperCase()}
                    {slot.slice(1)} slot locked · {lockedReason(slot)}
                  </p>
                );
              return (
                <label className="cb-field" key={slot}>
                  {`Current ${slot} equip`}
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
                    {items.map((orb) => (
                      <option key={orb.id} value={orb.id}>
                        {orb.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
            {request.progression.activatedNodes.map((nodeId) => {
              const node = profile.nodes.find((n) => n.id === nodeId);
              if (!node) return null;
              return (
                <label className="cb-field" key={nodeId}>
                  {`Current choice at ${nodeId} (+${node.levels} levels)`}
                  <select
                    value={request.current.choices[nodeId] ?? ''}
                    onChange={(event) =>
                      change({
                        ...request,
                        current: {
                          ...request.current,
                          choices: {
                            ...request.current.choices,
                            [nodeId]: event.target.value as Skill,
                          },
                        },
                      })
                    }
                  >
                    {node.options.map((skill) => (
                      <option key={skill} value={skill}>
                        {SKILL_NAMES[skill]}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
            <label className="cb-check">
              <input
                type="checkbox"
                aria-invalid={unlockIssue ? true : undefined}
                aria-describedby={unlockIssue ? 'unlock-error' : undefined}
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
              Hidden Potential is already unlocked; “{profile.label}” applies.
            </label>
            {unlockIssue && (
              <p className="cb-field-error" id="unlock-error">
                {unlockIssue}
              </p>
            )}
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
                ? `Hypothetical ownership: these ${model.orbs.length} items only, not every equip in the game.`
                : 'Unequipped copies only. Your current attached equips can also be retained.'}
            </p>
            <div className="cb-inventory">
              {model.orbs.map((orb) => {
                const issue = quantityIssue(request.inventory[orb.id]);
                const errorId = `qty-error-${orb.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                return (
                  <div className="cb-inventory-row" key={orb.id}>
                    <label>
                      <span>{orb.label}</span>
                      <input
                        type="number"
                        min="0"
                        max="999"
                        step="1"
                        inputMode="numeric"
                        aria-label={`Unequipped copies: ${orb.label}`}
                        aria-invalid={issue ? true : undefined}
                        aria-describedby={issue ? errorId : undefined}
                        value={request.inventory[orb.id] ?? 0}
                        onChange={(event) =>
                          change({
                            ...request,
                            inventory: {
                              ...request.inventory,
                              [orb.id]: Number.isNaN(event.target.valueAsNumber)
                                ? 0
                                : event.target.valueAsNumber,
                            },
                          })
                        }
                      />
                    </label>
                    {issue && (
                      <p className="cb-field-error" id={errorId}>
                        {issue}
                      </p>
                    )}
                  </div>
                );
              })}
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
            <p>{context.assumptions.join(' · ')}.</p>
            <p className="cb-muted">
              Card stats are before leader, passive, link and support
              multipliers. Probabilities describe an eligible check, not a
              full-turn attack chain.
            </p>
          </div>
          <div className="cb-context-controls">
            {entry.contexts.length > 1 && (
              <label className="cb-field">
                Evaluation context
                <select
                  value={request.context.id}
                  onChange={(event) =>
                    change({
                      ...request,
                      context: {
                        ...request.context,
                        id: event.target.value as typeof request.context.id,
                      },
                    })
                  }
                >
                  {entry.contexts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {context.evasionOptions.length > 1 ? (
              <label className="cb-field">
                Incoming-attack assumption
                <select
                  value={
                    request.context.evasionAllowed ? 'allowed' : 'disabled'
                  }
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
                  {context.evasionOptions.map((allowed) => (
                    <option
                      key={String(allowed)}
                      value={allowed ? 'allowed' : 'disabled'}
                    >
                      {allowed ? 'Evasion allowed' : 'Evasion disabled'}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="cb-muted">
                Incoming-attack assumption fixed by this evaluator: evasion{' '}
                {context.evasionOptions[0] ? 'allowed' : 'disabled'}.
              </p>
            )}
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
                {entry.objectives.map((key) => (
                  <option key={key} value={key}>
                    {labels[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset
            className="cb-frontier-options"
            aria-describedby={frontierIssue ? 'frontier-error' : undefined}
          >
            <legend>Metrics defining non-dominated alternatives</legend>
            <div>
              {entry.objectives.map((key) => (
                <label className="cb-check" key={key}>
                  <input
                    type="checkbox"
                    aria-invalid={frontierIssue ? true : undefined}
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
            {frontierIssue && (
              <p className="cb-field-error" id="frontier-error">
                {frontierIssue}
              </p>
            )}
          </fieldset>
          <div className="cb-submit-row">
            <div className="cb-field">
              <label htmlFor="candidate-limit">Candidate limit</label>
              <input
                id="candidate-limit"
                type="number"
                min="1"
                max={MAX_LIMIT}
                step="1"
                inputMode="numeric"
                aria-invalid={limitIssue ? true : undefined}
                aria-describedby={
                  limitIssue ? 'limit-error space-estimate' : 'space-estimate'
                }
                value={limitDraft}
                onChange={(event) => {
                  const text = event.target.value;
                  setLimitDraft(text);
                  const n = Number(text);
                  if (
                    text.trim() !== '' &&
                    Number.isSafeInteger(n) &&
                    n >= 1 &&
                    n <= MAX_LIMIT
                  )
                    change({ ...request, maxCandidates: n }, true);
                  else {
                    setResult(null);
                    setFailure(null);
                    setNotice(INVALID_SETTINGS_NOTICE);
                  }
                }}
              />
              {limitIssue && (
                <p className="cb-field-error" id="limit-error">
                  {limitIssue}
                </p>
              )}
            </div>
            <button className="cb-primary" type="submit">
              Compare legal builds
            </button>
          </div>
          <p className="cb-muted cb-space" id="space-estimate">
            {space
              ? `Search space before inventory checks: ${space.slotOptions.bronze} bronze × ${space.slotOptions.silver} silver × ${space.slotOptions.gold} gold option${space.slotOptions.gold === 1 ? '' : 's'} (each including empty) × ${space.allocations} allocation${space.allocations === 1 ? '' : 's'} = ${space.upperBound.toLocaleString('en-US')} targets at most.${
                  limitIssue
                    ? ''
                    : space.upperBound > Number(limitDraft)
                      ? ` The limit of ${Number(limitDraft).toLocaleString('en-US')} is below this bound, so the search may be truncated.`
                      : ' The limit covers the full space; evaluation runs instantly in the page.'
                }`
              : 'Search space unavailable until the inputs are valid.'}
          </p>
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
            {entry.objectives.map((key) => (
              <div key={key}>
                <span>{labels[key]}</span>
                <b>{format(result.current!.metrics[key])}</b>
              </div>
            ))}
          </div>
          <p className="cb-search" role="status">
            {result.search.evaluated} legal targets evaluated ·{' '}
            {result.search.unique} distinct evaluations · {model.orbs.length}
            -item catalog · {profile.label}
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
            aria-label="Build comparison table"
          >
            {/* Explicit roles keep table semantics when narrow screens restyle rows as cards. */}
            <table className="cb-table" role="table">
              <caption>
                Sorted by {labels[request.objective]}; equal objective values
                share a rank. Deltas are against the current baseline: pp =
                percentage points; rel. and % = relative change; n/a = zero
                baseline, so relative change is undefined.
              </caption>
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    Rank / target equips
                  </th>
                  {entry.objectives.map((key) => (
                    <th scope="col" role="columnheader" key={key}>
                      {labels[key]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody role="rowgroup">
                {displayed.map((group) => {
                  const representative =
                    group.alternatives.find((a) => a.isCurrent) ??
                    group.alternatives[0]!;
                  const selected = explanation?.groupId === group.id;
                  return (
                    <tr
                      role="row"
                      key={group.id}
                      className={[
                        representative.isCurrent ? 'cb-current-row' : '',
                        selected ? 'cb-explained-row' : '',
                      ].join(' ')}
                    >
                      <th scope="row" role="rowheader">
                        <div className="cb-row-badges">
                          <b>#{group.rank}</b>
                          {group.frontier && (
                            <span className="cb-pill">FRONTIER</span>
                          )}
                          {representative.isCurrent && (
                            <span className="cb-pill">CURRENT</span>
                          )}
                        </div>
                        <BuildLabel
                          entry={entry}
                          build={representative.build}
                        />
                        <span className="cb-row-summary">
                          {rowSummary(group, request.objective, result.groups)}
                        </span>
                        <button
                          type="button"
                          className="cb-link-button"
                          aria-pressed={selected}
                          aria-controls="result-explanation"
                          onClick={() => explain(group.id)}
                        >
                          Explain #{group.rank}
                        </button>
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
                                <BuildLabel
                                  entry={entry}
                                  build={alternative.build}
                                />
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
                                        ([id, n]) => `${n} × ${shortItem(id)}`,
                                      )
                                      .join('; ')}
                                    .
                                  </p>
                                )}
                                <ul>
                                  {alternative.changes.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                                {group.alternatives.length > 1 && (
                                  <button
                                    type="button"
                                    className="cb-link-button"
                                    onClick={() => explain(group.id, i)}
                                  >
                                    Explain this configuration
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </th>
                      {entry.objectives.map((key) => (
                        <td role="cell" key={key} data-label={labels[key]}>
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
          {result.current.metrics.additionalTrigger.value !== null && (
            <p className="cb-muted">
              Initial AA trigger for the baseline:{' '}
              {format(result.current.metrics.additionalTrigger)}. “Initial extra
              Super” includes the separate 50% conversion check. It is not the
              full-turn probability of a second Super.
            </p>
          )}
          {explanationError && (
            <p className="cb-error" role="alert">
              This result could not be explained from its calculation; it is
              shown without an explanation.
            </p>
          )}
          {explanation && (
            <ResultExplanation
              explanation={explanation}
              entry={entry}
              headingRef={explanationRef}
            />
          )}
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
            {model.card.excludedMechanics.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
      </section>

      <details className="cb-card cb-evidence">
        <summary>Field-level evidence & assumptions</summary>
        <p>
          Data revision {model.revision}, reviewed {model.card.reviewedAt}. Game
          build: {model.card.gameBuild ?? 'not captured'}. Evaluator {entry.id}{' '}
          ({entry.evaluator.label}, implementation {entry.evaluator.id} v
          {entry.evaluator.version}). Agreement among sites with unknown
          upstream sources is not independent confirmation.
        </p>
        <p>{entry.evaluator.verification}</p>
        <div className="cb-claims">
          {model.evidence.map((claim) => (
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
