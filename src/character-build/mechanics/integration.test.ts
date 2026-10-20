import { describe, expect, it } from 'vitest';
import { createComparison } from '../comparison';
import { evaluateRegisteredBuild, evaluatorFor } from '../execution';
import { requestErrors } from '../legality';
import { buildStatus, createSavedBuild, parseBuildRequest } from '../library';
import { loadCharacterState } from '../storage';
import { searchBuilds } from '../search';
import { explainGroup } from '../explanation';
import { registryErrors, resolveEvaluator } from '../registry';
import {
  gokuEntry,
  productionRegistry,
} from '../../data/real/character-build/registry';
import { ORB_IDS } from '../../data/real/character-build/goku';
import { catalogSnapshot } from '../../data/real/catalog';
import {
  realMechanics,
  gohanMechanics,
  uiGokuMechanics,
} from '../../data/real/character-build/mechanics';
import { GOHAN_STATE_ID } from '../../data/real/character-build/gohan-kit';
import { UI_GOKU_STATE_ID } from '../../data/real/character-build/ui-goku-kit';
import {
  objectiveCapability,
  resolveCapabilities,
} from '../../potential/capabilities';
import { snapshotProgressions } from '../../potential/progression';
import { recommendationGates, recommend } from '../../potential/recommendation';
import { evaluateSequence } from './evaluation';
import { resolveMechanics } from './registry';
import { sequenceObjectiveGates } from './support';
import { input } from './mechanics.fixtures';
import type { BuildRequest, EvaluatorEntry } from '../domain';
import { fixtureNodeEntry } from '../registry.fixtures';
import {
  effect,
  model as testModel,
  rule,
  scenario as testScenario,
} from './mechanics.fixtures';
import { sequenceEvaluator } from './evaluator';

function request(): BuildRequest {
  return {
    ...gokuEntry.defaults(),
    context: {
      id: 'event-sequence-v1',
      modelRevision: gokuEntry.sequence!.model.revision,
      scenarioId: gokuEntry.sequence!.scenarios[0]!.id,
      evasionAllowed: true,
    },
    objective: 'expectedSupers',
    frontierMetrics: [
      'expectedAttacks',
      'expectedSupers',
      'criticalAttacks',
      'evadedAttacks',
    ],
  };
}
const run = (r = request(), entry = gokuEntry) =>
  searchBuilds(r, entry, {
    maxScanned: 10000,
    cancelled: () => false,
    yieldControl: async () => {},
  });

describe('versioned event evaluator in the existing registry/search pipeline', () => {
  it('jointly evaluates admitted test-only node choices and compatible equipment with native attacks', async () => {
    const entry = structuredClone({
      ...fixtureNodeEntry,
      evaluator: undefined,
      defaults: undefined,
    }) as unknown as EvaluatorEntry;
    entry.evaluator = fixtureNodeEntry.evaluator;
    entry.defaults = fixtureNodeEntry.defaults;
    entry.model.kit.nativeAdditional = {
      status: 'present',
      evidenceIds: ['test-only-profile'],
      note: 'TEST ONLY native additional model.',
    };
    const events = testModel(
      [effect('test-only:native')],
      [
        rule('test-only:native', {
          operation: {
            kind: 'additional',
            chance: 0.5,
            superChance: 1,
            superKind: '12-ki',
          },
        }),
      ],
    );
    events.stateId = entry.stateId;
    events.cardId = entry.catalogCardId;
    events.dataRevision = entry.model.revision;
    for (const e of events.abilities.flatMap((a) => a.effects))
      e.source = {
        field: e.id,
        status: 'source-documented',
        reference: events.evidence[0]!.reference,
        note: 'TEST ONLY arithmetic fixture.',
      };
    const s = testScenario();
    s.initial.state = entry.stateId;
    entry.sequence = {
      model: events,
      scenarios: [s],
      evaluator: sequenceEvaluator,
      objectives: ['expectedSupers', 'criticalAttacks'],
      recommendationSupport: {
        expectedSupers: {
          scope: 'event-sequence-model',
          evidenceIds: ['test-only-profile'],
          blockers: [],
          excludes: ['TEST ONLY'],
        },
        criticalAttacks: {
          scope: 'event-sequence-model',
          evidenceIds: ['test-only-profile'],
          blockers: [],
          excludes: ['TEST ONLY'],
        },
      },
    };
    const r = entry.defaults();
    r.context = {
      id: 'event-sequence-v1',
      modelRevision: events.revision,
      scenarioId: s.id,
      evasionAllowed: true,
    };
    r.objective = 'expectedSupers';
    r.frontierMetrics = ['expectedSupers', 'criticalAttacks'];
    const result = await run(r, entry);
    expect(result.comparison.errors).toEqual([]);
    expect(result.comparison.search.evaluated).toBe(16); // 2 nodes × 2 bronze × 2 silver × 2 gold
    expect(result.comparison.current!.metrics.expectedSupers.value).toBe(
      1.5149,
    );
    const best = result.comparison.groups.filter((g) => g.rank === 1);
    expect(best[0]!.evaluation.metrics.expectedSupers.value).toBe(1.5296);
    expect(best.flatMap((g) => g.alternatives)).toHaveLength(8);
    expect(
      new Set(
        best.flatMap((g) =>
          g.alternatives.map((a) => a.build.choices['test-only-node-a']),
        ),
      ),
    ).toEqual(new Set(['critical', 'evasion']));
  });
  it('keeps the old entry, defaults, exact state, v1 context and working-settings key', () => {
    expect(registryErrors(productionRegistry)).toEqual([]);
    expect(gokuEntry.id).toBe('goku-initial-check-v1');
    expect(gokuEntry.storageKey).toBe('dokkan.character-builds.v1');
    expect(gokuEntry.defaults().context).toEqual({
      id: 'initial-check-v1',
      battleTurn: 1,
      appearance: 1,
      initialAttack: 'super',
      externalEffects: 'none',
      evasionAllowed: true,
    });
    expect(evaluatorFor(gokuEntry, gokuEntry.defaults())).toBe(
      gokuEntry.evaluator,
    );
    expect(
      resolveEvaluator(productionRegistry, catalogSnapshot, gokuEntry.stateId)
        .ok,
    ).toBe(true);
    expect(parseBuildRequest(gokuEntry.defaults())).toEqual(
      gokuEntry.defaults(),
    );
  });
  it('offers only explicit sequence objectives without opening the allocation gate', () => {
    const r = request(),
      c = resolveCapabilities(gokuEntry, snapshotProgressions([gokuEntry]), r);
    expect(requestErrors(r, gokuEntry)).toEqual([]);
    expect(c.objectives.map((o) => [o.metric, o.status])).toEqual([
      ['expectedAttacks', 'experimental'],
      ['expectedSupers', 'experimental'],
      ['criticalAttacks', 'experimental'],
      ['evadedAttacks', 'experimental'],
    ]);
    expect(c.allocation.full.available).toBe(false);
    expect(
      recommendationGates(
        gokuEntry,
        snapshotProgressions([gokuEntry]),
        r,
        'selected-profile',
      ),
    ).toEqual([]);
    expect(
      recommendationGates(
        gokuEntry,
        snapshotProgressions([gokuEntry]),
        r,
        'full-potential',
      ).some((g) => g.code === 'allocation-graph'),
    ).toBe(true);
    expect(objectiveCapability(gokuEntry, 'damage' as never, r).status).toBe(
      'unavailable',
    );
  });
  it('checks independent expected counts, includes the baseline and preserves all equal winners', async () => {
    const r = request(),
      outcome = await run(r),
      x = recommend(outcome, r, 'selected-profile', []);
    expect(outcome.stop).toBe('complete');
    expect(outcome.comparison.search.evaluated).toBe(16);
    expect(outcome.comparison.current!.metrics.expectedSupers.value).toBe(1.05);
    expect(x.selected!.group.evaluation.metrics.expectedSupers.value).toBe(
      1.07,
    );
    expect(x.tiedAlternatives).toBe(4); // empty or any of three irrelevant bronze items
    expect(x.status).toBe('ties');
    expect(x.selected!.group.evaluation.metrics.damage.value).toBeNull();
    const explanation = explainGroup(
      outcome.comparison,
      r,
      gokuEntry,
      x.selected!.group.id,
      x.selected!.alternativeIndex,
    )!;
    expect(explanation.model.evaluatorId).toBe('character-event-sequence');
    expect(explanation.model.evaluatorVersion).toBe('1');
    expect(explanation.sequence!.modelRevision).toBe(
      r.context.id === 'event-sequence-v1' ? r.context.modelRevision : '',
    );
  });
  it('does not invent a tie-break from independent critical/evasion branch summation', async () => {
    const r = request();
    r.current.equips.silver = ORB_IDS.additional;
    const x = recommend(await run(r), r, 'selected-profile', []);
    expect(x.currentAmongBest).toBe(true);
    expect(x.status).toBe('current-best');
    expect(x.tiedAlternatives).toBe(4);
    expect(x.delta!.absolute).toBe(0);
  });
  it('retains exposed card/skill differences and uses the selected tied alternative for its breakdown', async () => {
    const r = request();
    r.current.equips.bronze = ORB_IDS.hp;
    const outcome = await run(r),
      x = recommend(outcome, r, 'selected-profile', []);
    const selected = x.selected!,
      alternative = selected.group.alternatives[selected.alternativeIndex]!;
    expect(alternative.build.equips.bronze).toBe(ORB_IDS.hp);
    const explanation = explainGroup(
      outcome.comparison,
      r,
      gokuEntry,
      selected.group.id,
      selected.alternativeIndex,
    )!;
    expect(explanation.evaluation.stats.hp).toBe(15827);
    expect(
      explanation.evaluation.trace.stats.some(
        (c) => c.itemId === ORB_IDS.hp && c.values.hp === 500,
      ),
    ).toBe(true);
    expect(outcome.comparison.groups.length).toBe(16);
  });
  it('respects owned spares, attached equipment and locked gold slots', async () => {
    const r = request();
    r.mode = 'inventory';
    r.inventory = { [ORB_IDS.critical]: 1 };
    r.current.equips.silver = ORB_IDS.evasion;
    const result = (await run(r)).comparison;
    expect(
      result.groups.every((g) =>
        g.alternatives.every((a) => a.build.equips.gold === null),
      ),
    ).toBe(true);
    expect(
      result.groups
        .flatMap((g) => g.alternatives)
        .some((a) => a.build.equips.silver === ORB_IDS.additional),
    ).toBe(false);
    expect(
      result.groups
        .flatMap((g) => g.alternatives)
        .some((a) => a.build.equips.silver === ORB_IDS.evasion),
    ).toBe(true);
    expect(result.current!.skills.evasion).toBe(2);
  });
  it('makes later appearances and an evasion-disabled context change the actual metrics', () => {
    const r = request();
    if (r.context.id !== 'event-sequence-v1') throw new Error();
    r.context.scenarioId = gokuEntry.sequence!.scenarios[1]!.id;
    let e = evaluateRegisteredBuild(r.current, r, gokuEntry);
    expect(e.metrics.expectedSupers.value).toBe(2.1);
    r.current.equips.silver = ORB_IDS.evasion;
    e = evaluateRegisteredBuild(r.current, r, gokuEntry);
    expect(e.metrics.evadedAttacks.value).toBe(0.04); // two incoming attacks × .02
    r.context.evasionAllowed = false;
    expect(
      evaluateRegisteredBuild(r.current, r, gokuEntry).metrics.evadedAttacks
        .value,
    ).toBe(0);
  });
  it('labels truncated searches and yields/cancels enumeration without retaining stale results', async () => {
    const r = request();
    const truncated = await searchBuilds(r, gokuEntry, {
      maxScanned: 1,
      cancelled: () => false,
      yieldControl: async () => {},
    });
    expect(recommend(truncated, r, 'selected-profile', []).status).toBe(
      'best-found',
    );
    let cancelled = false,
      yields = 0;
    const interrupted = await searchBuilds(r, gokuEntry, {
      maxScanned: 10000,
      cancelled: () => cancelled,
      yieldControl: async () => {
        yields++;
        cancelled = true;
      },
    });
    expect(yields).toBe(1);
    expect(interrupted.stop).toBe('cancelled');
    expect(interrupted.comparison.search.evaluated).toBe(1);
  });
  it('supports cancellation while computing pairwise dominance', async () => {
    const r = request(),
      comparison = createComparison(r, gokuEntry);
    comparison.accept(r.current);
    comparison.accept({
      ...r.current,
      equips: { ...r.current.equips, silver: ORB_IDS.additional },
    });
    let cancelled = false,
      yields = 0;
    const finished = await comparison.finishAsync(false, {
      chunkSize: 1,
      cancelled: () => cancelled,
      yieldControl: async () => {
        yields++;
        cancelled = true;
      },
    });
    expect(yields).toBeGreaterThan(0);
    expect(finished.cancelled).toBe(true);
  });
  it('refuses an unbound context, another model revision, or a substituted event state', () => {
    const r = request(),
      missing = { ...gokuEntry };
    delete missing.sequence;
    expect(evaluatorFor(missing, r)).toBeNull();
    expect(requestErrors(r, missing).join(' ')).toContain(
      'Unsupported event context',
    );
    if (r.context.id !== 'event-sequence-v1') throw new Error();
    r.context.modelRevision = 'future-version';
    expect(requestErrors(r, gokuEntry).join(' ')).toContain(
      'Unsupported event context',
    );
    const broken = {
      ...gokuEntry,
      sequence: {
        ...gokuEntry.sequence!,
        model: { ...gokuEntry.sequence!.model, stateId: 'another-state' },
      },
    };
    expect(registryErrors([broken]).join(' ')).toContain(
      'exact card/state/data revision',
    );
  });
});

describe('saved contracts and real per-context evidence gates', () => {
  it('round-trips the optional new context while old saves retain their exact bytes/shape', () => {
    const old = gokuEntry.defaults(),
      raw = JSON.stringify({
        version: 1,
        catalogRevision: gokuEntry.model.revision,
        request: old,
      });
    const store = {
      getItem: () => raw,
      setItem: () => {
        throw new Error('Must not write');
      },
    };
    expect(loadCharacterState(store, gokuEntry)).toMatchObject({
      state: old,
      warning: null,
    });
    expect(JSON.stringify(parseBuildRequest(old))).toBe(JSON.stringify(old));
    const r = request();
    expect(parseBuildRequest(r)).toEqual(r);
    const saved = createSavedBuild({
      id: 'events',
      name: 'Event settings',
      now: new Date('2026-10-20T12:00:00Z'),
      request: r,
      entry: gokuEntry,
    });
    expect(saved.error).toBeNull();
    expect(buildStatus(saved.build!, productionRegistry).kind).toBe('ready');
    if (saved.build!.request.context.id !== 'event-sequence-v1')
      throw new Error();
    saved.build!.request.context.modelRevision = 'future-events';
    expect(buildStatus(saved.build!, productionRegistry).kind).toBe('stale');
    expect(saved.build!.request.context.modelRevision).toBe('future-events');
  });
  it('rejects extra/future context fields instead of silently losing them during import', () => {
    const r = request();
    expect(
      parseBuildRequest({ ...r, context: { ...r.context, rawDamage: 123 } }),
    ).toBeNull();
    expect(
      parseBuildRequest({ ...r, context: { id: 'event-sequence-v2' } }),
    ).toBeNull();
    expect(
      parseBuildRequest({ ...r, context: { ...r.context, modelRevision: '' } }),
    ).toBeNull();
  });
  it('binds real mechanics to the exact card/form/state/revision without authorizing a board', () => {
    expect(
      resolveMechanics(catalogSnapshot, realMechanics, GOHAN_STATE_ID).ok,
    ).toBe(true);
    expect(
      resolveMechanics(catalogSnapshot, realMechanics, UI_GOKU_STATE_ID).ok,
    ).toBe(true);
    const changed = structuredClone(uiGokuMechanics);
    changed.model.dataRevision = 'other';
    expect(
      resolveMechanics(catalogSnapshot, [changed], UI_GOKU_STATE_ID).ok,
    ).toBe(false);
    expect(
      resolveMechanics(
        catalogSnapshot,
        [uiGokuMechanics, uiGokuMechanics],
        UI_GOKU_STATE_ID,
      ).ok,
    ).toBe(false);
    expect(
      resolveEvaluator(productionRegistry, catalogSnapshot, UI_GOKU_STATE_ID)
        .ok,
    ).toBe(false);
    expect(
      catalogSnapshot.states.find((s) => s.id === UI_GOKU_STATE_ID)!.fields
        .rawStats.value,
    ).toBeNull();
  });
  it('executes the real native entry guarantee only in its bounded context; later effects do not apply retroactively', () => {
    const record = uiGokuMechanics,
      s = record.scenarios[0]!.scenario;
    expect(sequenceObjectiveGates(record.model, s, 'evadedAttacks')).toEqual(
      [],
    );
    const i = input(record.model, { scenario: s });
    const result = evaluateSequence(record.model, i, ['evadedAttacks']);
    expect(result.status).toBe('evaluated');
    expect(result.metrics.evadedAttacks).toBe(1);
    expect(
      evaluateSequence(record.model, { ...i, evasionAllowed: false }, [
        'evadedAttacks',
      ]).metrics.evadedAttacks,
    ).toBe(0);
    const native = record.scenarios[1]!.scenario;
    expect(
      sequenceObjectiveGates(record.model, native, 'expectedSupers'),
    ).toEqual([]);
    const counts = evaluateSequence(
      record.model,
      input(record.model, { scenario: native }),
      ['expectedSupers'],
    );
    expect(counts.metrics.expectedSupers).toBe(1.77);
    if (counts.status !== 'evaluated')
      throw new Error(counts.reasons.join(' '));
    expect(
      counts.branches.some((b) =>
        b.trace.some((e) => e.attack?.kind === 'unspecified-super'),
      ),
    ).toBe(true);
    expect(
      sequenceObjectiveGates(record.model, native, 'attackRaise').join(' '),
    ).toContain('variant is unresolved');
    expect(
      sequenceObjectiveGates(record.model, s, 'criticalAttacks').length,
    ).toBeGreaterThan(0);
  });
  it('keeps Gohan source disagreement, native chains and guard dependencies as material blockers', () => {
    const record = gohanMechanics,
      s = record.scenarios[0]!.scenario;
    expect(
      sequenceObjectiveGates(record.model, s, 'defenseRaise').length,
    ).toBeGreaterThan(0);
    expect(
      evaluateSequence(record.model, input(record.model, { scenario: s }), [
        'defenseRaise',
      ]).status,
    ).toBe('unavailable');
    expect(record.model.assumptions.join(' ')).toContain(
      '99-turn/infinite'.split('/')[0],
    );
    expect(record.model.abilities.some((a) => a.kind === 'super')).toBe(true);
  });
  it('a copied scenario ID cannot reuse an exclusion after its events or assumptions change', () => {
    const record = uiGokuMechanics,
      changed = structuredClone(record.scenarios[0]!.scenario);
    changed.actions.push({
      kind: 'incoming',
      evadable: true,
      damageOnHit: 0,
      guarded: false,
    });
    expect(
      sequenceObjectiveGates(record.model, changed, 'evadedAttacks').join(' '),
    ).toContain('Later native evasion overlap');
    expect(
      evaluateSequence(
        record.model,
        input(record.model, { scenario: changed }),
        ['evadedAttacks'],
      ).status,
    ).toBe('unavailable');
  });
  it('does not let an implementation flag admit unknown kit mechanics for a sequence objective', () => {
    const entry: EvaluatorEntry = {
      ...gokuEntry,
      model: {
        ...gokuEntry.model,
        kit: {
          ...gokuEntry.model.kit,
          nativeAdditional: {
            status: 'unknown',
            evidenceIds: [],
            note: 'TEST ONLY',
          },
        },
      },
    };
    expect(objectiveCapability(entry, 'expectedSupers', request()).status).toBe(
      'unavailable',
    );
    expect(objectiveCapability(entry, 'attack').status).toBe('supported');
  });
  it('omits an unknown tradeoff metric instead of supplying a zero or creating dominance', async () => {
    const entry: EvaluatorEntry = {
      ...gokuEntry,
      model: {
        ...gokuEntry.model,
        kit: {
          ...gokuEntry.model.kit,
          nativeCritical: {
            status: 'unknown',
            evidenceIds: [],
            note: 'TEST ONLY unknown native critical.',
          },
        },
      },
    };
    const r = request(),
      result = await run(r, entry);
    expect(result.comparison.errors).toEqual([]);
    expect(result.comparison.current!.metrics.criticalAttacks.value).toBeNull();
    expect(
      result.comparison.groups.every(
        (g) => g.evaluation.metrics.criticalAttacks.value === null,
      ),
    ).toBe(true);
    expect(result.comparison.frontier.omittedMetrics).toContain(
      'criticalAttacks',
    );
    expect(result.comparison.frontier.metricsUsed).not.toContain(
      'criticalAttacks',
    );
  });
});
