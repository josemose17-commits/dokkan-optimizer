import { describe, expect, it } from 'vitest';
import type { BuildRequest } from '../character-build/domain';
import { compareBuilds } from '../character-build/comparison';
import { generateBuilds } from '../character-build/generation';
import { explainGroup } from '../character-build/explanation';
import {
  fixtureNodeEntry,
  fixtureNodeRequest,
} from '../character-build/registry.fixtures';
import { searchBuilds, type SearchOutcome } from '../character-build/search';
import {
  gokuEntry,
  productionRegistry,
} from '../data/real/character-build/registry';
import { catalogSnapshot } from '../data/real/catalog';
import { catalogCoverage } from './coverage';
import { resolveProgression, snapshotProgressions } from './progression';
import { recommendationGates, recommend } from './recommendation';

const control = () => ({
  maxScanned: 1000,
  chunkSize: 2,
  cancelled: () => false,
  yieldControl: async () => {},
});
const request = (): BuildRequest => ({
  ...gokuEntry.defaults(),
  objective: 'hp' as const,
});
const run = () => searchBuilds(request(), gokuEntry, control());
// TEST ONLY abstract graph. No real Goku graph is added or inferred.
function graphFixture() {
  const entry = {
    ...fixtureNodeEntry,
    model: structuredClone(fixtureNodeEntry.model),
  };
  entry.model.orbs = [];
  entry.model.profile.nodes.push({
    ...structuredClone(entry.model.profile.nodes[0]!),
    id: 'test-only-node-b',
    route: 'topRight',
    levels: 1,
    options: ['additional', 'critical'],
    prerequisites: ['test-only-node-a'],
  });
  const r = fixtureNodeRequest();
  r.objective = 'critical';
  r.progression.activatedNodes = ['test-only-node-a', 'test-only-node-b'];
  r.current.choices = {
    'test-only-node-a': 'critical',
    'test-only-node-b': 'additional',
  };
  r.current.equips = { bronze: null, silver: null, gold: null };
  r.mode = 'catalog';
  r.inventory = {};
  return { entry, request: r };
}

describe('bounded cooperative search', () => {
  it('matches all 16 existing candidates and HP +500 oracle', async () => {
    const r = await run();
    expect(r.stop).toBe('complete');
    expect(r.progress).toEqual({ scanned: 16, evaluated: 16, rejected: 0 });
    expect(r.comparison.groups[0]!.evaluation.stats.hp).toBe(15827);
    expect(r.comparison.current!.stats.hp).toBe(15327);
  });
  it('preserves the synchronous exact result', async () => {
    expect((await run()).comparison).toEqual(
      compareBuilds(request(), gokuEntry),
    );
  });
  it('counts inventory rejection before evaluation', async () => {
    const r = request();
    r.mode = 'inventory';
    const out = await searchBuilds(r, gokuEntry, control());
    expect(out.progress).toEqual({ scanned: 16, evaluated: 1, rejected: 15 });
    expect(out.stop).toBe('complete');
  });
  it('discloses evaluation truncation without a global optimum', async () => {
    const r = request();
    r.maxCandidates = 1;
    const out = await searchBuilds(r, gokuEntry, control());
    expect(out.stop).toBe('candidate-limit');
    expect(out.progress.evaluated).toBe(1);
    expect(out.comparison.search).toMatchObject({
      truncated: true,
      totalLegal: null,
    });
  });
  it('budgets rejected combinations too', async () => {
    const r = request();
    r.mode = 'inventory';
    const out = await searchBuilds(r, gokuEntry, {
      ...control(),
      maxScanned: 2,
    });
    expect(out.stop).toBe('scan-limit');
    expect(out.progress).toEqual({ scanned: 2, evaluated: 1, rejected: 1 });
  });
  it('reports complete when the exact budget reaches the end', async () => {
    const r = request();
    r.maxCandidates = 16;
    const out = await searchBuilds(r, gokuEntry, {
      ...control(),
      maxScanned: 16,
    });
    expect(out.stop).toBe('complete');
    expect(out.comparison.search.totalLegal).toBe(16);
  });
  it('cancels before scanning and retains an independently evaluated baseline', async () => {
    const out = await searchBuilds(request(), gokuEntry, {
      ...control(),
      cancelled: () => true,
    });
    expect(out.stop).toBe('cancelled');
    expect(out.progress.scanned).toBe(0);
    expect(out.comparison.current!.stats.hp).toBe(15327);
  });
  it('yields, publishes monotonic counts and cancels at a chunk boundary', async () => {
    let cancelled = false,
      yields = 0;
    const counts: number[] = [];
    const out = await searchBuilds(request(), gokuEntry, {
      ...control(),
      chunkSize: 2,
      cancelled: () => cancelled,
      progress: (p) => counts.push(p.scanned),
      yieldControl: async () => {
        yields++;
        cancelled = true;
      },
    });
    expect(yields).toBe(1);
    expect(counts).toEqual([2, 2]);
    expect(out.stop).toBe('cancelled');
    expect(out.progress.scanned).toBe(2);
  });
  it('captures request input rather than reading later UI edits', async () => {
    const r = request();
    const out = await searchBuilds(r, gokuEntry, {
      ...control(),
      chunkSize: 1,
      yieldControl: async () => {
        r.objective = 'hp';
        r.inventory.changed = 999;
        r.mode = 'inventory';
      },
    });
    expect(out.stop).toBe('complete');
    expect(out.progress.evaluated).toBe(16);
  });
  it('yields and cancels during dominance checks after enumeration', async () => {
    let yields = 0;
    const out = await searchBuilds(request(), gokuEntry, {
      ...control(),
      chunkSize: 16,
      cancelled: () => yields >= 2,
      yieldControl: async () => {
        yields++;
      },
    });
    expect(out.progress).toEqual({ scanned: 16, evaluated: 16, rejected: 0 });
    expect(yields).toBe(2);
    expect(out.stop).toBe('cancelled');
    expect(out.comparison.frontier.comparable).toBe(false);
    expect(out.comparison.frontier.reason).toContain('stopped early');
    expect(out.comparison.search.totalLegal).toBeNull();
    expect(recommend(out, request(), 'selected-profile', []).status).toBe(
      'best-found',
    );
  });
  it.each([0, -1, 1.5, 1000001])(
    'rejects unsupported technical scan budget %s',
    async (n) => {
      await expect(
        searchBuilds(request(), gokuEntry, { ...control(), maxScanned: n }),
      ).rejects.toThrow('Scan budget');
    },
  );
  it('does not interpret a missing baseline objective as zero', async () => {
    const entry = {
      ...gokuEntry,
      evaluator: {
        ...gokuEntry.evaluator,
        evaluate: (
          ...args: Parameters<typeof gokuEntry.evaluator.evaluate>
        ) => {
          const e = gokuEntry.evaluator.evaluate(...args);
          e.metrics.hp = {
            ...e.metrics.hp,
            value: null,
            reason: 'Missing raw HP.',
          };
          return e;
        },
      },
    };
    const out = await searchBuilds(request(), entry, control());
    expect(out.stop).toBe('error');
    expect(out.comparison.groups).toEqual([]);
    expect(out.comparison.errors).toEqual(['Cannot rank hp: Missing raw HP.']);
  });
  it('a missing candidate objective invalidates earlier rankings too', async () => {
    const entry = {
      ...gokuEntry,
      evaluator: {
        ...gokuEntry.evaluator,
        evaluate: (
          ...args: Parameters<typeof gokuEntry.evaluator.evaluate>
        ) => {
          const e = gokuEntry.evaluator.evaluate(...args);
          if (args[0].equips.silver)
            e.metrics.hp = {
              ...e.metrics.hp,
              value: null,
              reason: 'Candidate effect unknown.',
            };
          return e;
        },
      },
    };
    const out = await searchBuilds(request(), entry, control());
    expect(out.stop).toBe('error');
    expect(out.comparison.groups).toEqual([]);
    expect(out.comparison.errors.join(' ')).toContain(
      'Candidate effect unknown',
    );
  });
  it('surfaces evaluator failure without publishing a partial confident rank', async () => {
    const entry = {
      ...gokuEntry,
      evaluator: {
        ...gokuEntry.evaluator,
        evaluate: () => {
          throw Error('do not leak private payload');
        },
      },
    };
    const out = await searchBuilds(request(), entry, control());
    expect(out.stop).toBe('error');
    expect(out.comparison.errors).toEqual([
      `Calculation failed for ${entry.id}; no recommendation is retained.`,
    ]);
  });
});

describe('actual-choice enumeration on independently listed abstract cases', () => {
  it('enumerates exactly four allowed allocations, not arbitrary totals', async () => {
    const { entry, request: r } = graphFixture();
    const generated = [...generateBuilds(r, entry)].map((b) => [
      b.choices['test-only-node-a'],
      b.choices['test-only-node-b'],
    ]);
    expect(generated).toEqual([
      ['critical', 'additional'],
      ['critical', 'critical'],
      ['evasion', 'additional'],
      ['evasion', 'critical'],
    ]);
    const out = await searchBuilds(r, entry, control());
    expect(out.progress.evaluated).toBe(4);
    expect(out.comparison.groups.map((g) => g.evaluation.skills)).toEqual([
      { additional: 1, critical: 5, evasion: 3 },
      { additional: 2, critical: 4, evasion: 3 },
      { additional: 1, critical: 3, evasion: 5 },
      { additional: 2, critical: 2, evasion: 5 },
    ]);
  });
  it('progression subsets preserve native levels and fixed stat additions', async () => {
    const { entry, request: r } = graphFixture();
    r.progression.activatedNodes = [];
    r.current.choices = {};
    const out = await searchBuilds(r, entry, control());
    expect(out.comparison.groups[0]!.evaluation.skills).toEqual({
      additional: 1,
      critical: 2,
      evasion: 3,
    });
    expect(out.comparison.groups[0]!.evaluation.stats).toEqual({
      hp: 1100,
      attack: 2200,
      defense: 800,
    });
  });
  it('equal activated-node counts do not imply equal progression', async () => {
    const { entry, request: r } = graphFixture();
    r.progression.activatedNodes = ['test-only-node-a'];
    r.current.choices = { 'test-only-node-a': 'critical' };
    expect((await searchBuilds(r, entry, control())).stop).toBe('complete');
    r.progression.activatedNodes = ['test-only-node-b'];
    r.current.choices = { 'test-only-node-b': 'critical' };
    const out = await searchBuilds(r, entry, control());
    expect(out.stop).toBe('error');
    expect(out.comparison.errors.join(' ')).toContain('prerequisite');
  });
  it('route and SA prerequisites cannot pass silently', async () => {
    const { entry, request: r } = graphFixture();
    r.progression.routes = ['topLeft'];
    expect((await searchBuilds(r, entry, control())).stop).toBe('error');
    r.progression.routes = [...entry.model.profile.routes];
    entry.model.profile.nodes[1]!.minSuperAttackLevel = 99;
    expect((await searchBuilds(r, entry, control())).stop).toBe('error');
  });
});

describe('explicit template mappings, not inferred board topology', () => {
  it('keeps the real 55% aggregate as a partial snapshot', () => {
    const catalog = snapshotProgressions([gokuEntry]);
    const r = resolveProgression(gokuEntry, catalog);
    expect(r.ok && r.template.kind).toBe('profile-snapshot');
    expect(r.ok && r.template.coverage).toBe('partial');
    expect(r.ok && r.template.profile.fixedSkills).toEqual({
      additional: 5,
      critical: 0,
      evasion: 0,
    });
    expect(r.ok && r.template.profile.nodes).toEqual([]);
  });
  it('does not upgrade growth totals into graph coverage', () => {
    const catalog = snapshotProgressions([gokuEntry]);
    catalog.templates[0]!.coverage = 'complete-for-progression';
    expect(resolveProgression(gokuEntry, catalog).ok).toBe(false);
  });
  it('requires exact state, profile, data and template revisions', () => {
    for (const key of [
      'stateId',
      'profileId',
      'dataRevision',
      'templateRevision',
    ] as const) {
      const catalog = snapshotProgressions([gokuEntry]);
      catalog.mappings[0]![key] = 'wrong';
      expect(resolveProgression(gokuEntry, catalog).ok, key).toBe(false);
    }
  });
  it('requires evidence and rejects ambiguous mappings', () => {
    const catalog = snapshotProgressions([gokuEntry]);
    catalog.mappings[0]!.evidenceIds = ['missing'];
    expect(resolveProgression(gokuEntry, catalog).ok).toBe(false);
    catalog.mappings[0]!.evidenceIds = ['base-board'];
    catalog.mappings.push({ ...catalog.mappings[0]! });
    expect(resolveProgression(gokuEntry, catalog).ok).toBe(false);
  });
  it('does not accept unresolved mapping evidence as established topology', () => {
    const entry = { ...gokuEntry, model: structuredClone(gokuEntry.model) };
    entry.model.evidence.find((e) => e.id === 'base-board')!.status =
      'unresolved';
    expect(resolveProgression(entry, snapshotProgressions([entry])).ok).toBe(
      false,
    );
  });
  it('can explicitly share one pinned abstract template without merging card identities', () => {
    const a = {
        ...fixtureNodeEntry,
        model: structuredClone(fixtureNodeEntry.model),
      },
      b = {
        ...fixtureNodeEntry,
        id: 'test-only:second-entry',
        stateId: 'test-only:second-state',
        model: structuredClone(fixtureNodeEntry.model),
      };
    b.model.card.id = b.stateId;
    b.model.profile.cardStateId = b.stateId;
    b.model.profile.id = 'test-only:second-profile';
    const catalog = snapshotProgressions([a]);
    const mapping = catalog.mappings[0]!;
    catalog.mappings.push({
      ...mapping,
      entryId: b.id,
      stateId: b.stateId,
      profileId: b.model.profile.id,
      dataRevision: b.model.revision,
    });
    const rb = resolveProgression(b, catalog);
    expect(rb.ok && rb.entry.model.profile.nodes).toEqual(
      a.model.profile.nodes,
    );
    expect(rb.ok && rb.entry.model.profile.cardStateId).toBe(
      'test-only:second-state',
    );
    expect(a.model.profile.cardStateId).not.toBe(b.stateId);
  });
  it('rejects unknown prerequisite references in template records', () => {
    const catalog = snapshotProgressions([fixtureNodeEntry]);
    catalog.templates[0]!.profile.nodes[0]!.prerequisites = ['not-a-node'];
    expect(resolveProgression(fixtureNodeEntry, catalog).ok).toBe(false);
  });
});

describe('direct recommendations with honest scope', () => {
  it('returns the same precise full-graph gate before searching', () => {
    const gates = recommendationGates(
      gokuEntry,
      snapshotProgressions([gokuEntry]),
      request(),
      'full-potential',
      false,
    );
    expect(gates.map((g) => g.code)).toEqual(['allocation-graph']);
    expect(gates[0]!.message).toContain(
      'Exact selectable node alternatives and increments',
    );
  });
  it('returns scoped HP +500 and preserves four objective ties', async () => {
    const r = request(),
      out = await run();
    const gates = recommendationGates(
      gokuEntry,
      snapshotProgressions([gokuEntry]),
      r,
      'selected-profile',
      false,
    );
    expect(gates).toEqual([]);
    const answer = recommend(out, r, 'selected-profile', gates);
    expect(answer.status).toBe('ties');
    expect(answer.tiedAlternatives).toBe(4);
    expect(answer.delta?.absolute).toBe(500);
    expect(answer.selected!.group.evaluation.stats.hp).toBe(15827);
    expect(
      answer.selected!.group.alternatives[answer.selected!.alternativeIndex]!
        .build.equips.silver,
    ).toBe(null);
  });
  it('recognizes current best and avoids unnecessary changes among ties', async () => {
    const r = request();
    const item = gokuEntry.model.orbs.find((o) => o.stats.hp === 500)!;
    r.current.equips.bronze = item.id;
    const out = await searchBuilds(r, gokuEntry, control());
    const answer = recommend(out, r, 'selected-profile', []);
    expect(answer.status).toBe('current-best');
    expect(
      answer.selected!.group.alternatives[answer.selected!.alternativeIndex]!
        .changes,
    ).toEqual([]);
  });
  it('never calls a truncated search best without qualification', async () => {
    const r = request();
    r.maxCandidates = 1;
    const out = await searchBuilds(r, gokuEntry, control());
    const a = recommend(out, r, 'selected-profile', []);
    expect(a.status).toBe('best-found');
    expect(a.title).toBe('Best found so far — search incomplete');
    expect(a.search.complete).toBe(false);
  });
  it('keeps a stronger current baseline even if truncation has not reached it', async () => {
    const r = request();
    r.current.equips.bronze = gokuEntry.model.orbs.find(
      (o) => o.stats.hp === 500,
    )!.id;
    r.maxCandidates = 1;
    const outcome = await searchBuilds(r, gokuEntry, control());
    const a = recommend(outcome, r, 'selected-profile', []);
    expect(a.status).toBe('best-found');
    expect(a.selected!.group.evaluation.stats.hp).toBe(15827);
    expect(a.selected!.group.dominatedBy).toBeNull();
    expect(a.selected!.group.frontier).toBe(true);
    expect(a.delta?.absolute).toBe(0);
    const explanation = explainGroup(
      {
        ...outcome.comparison,
        groups: [a.selected!.group, ...outcome.comparison.groups],
      },
      r,
      gokuEntry,
      'current-baseline',
      0,
    );
    expect(explanation!.objective.tiedGroups).toBe(1);
    expect(explanation!.frontier.status).toBe('on');
  });
  it('keeps an equal current baseline outside the scanned prefix', async () => {
    const r = request();
    r.current.equips.silver = gokuEntry.model.orbs.find(
      (o) => o.skills.critical === 2,
    )!.id;
    r.maxCandidates = 1;
    const a = recommend(
      await searchBuilds(r, gokuEntry, control()),
      r,
      'selected-profile',
      [],
    );
    expect(
      a.selected!.group.alternatives[a.selected!.alternativeIndex]!.isCurrent,
    ).toBe(true);
  });
  it('does not recommend when a missing native effect could change the winner', async () => {
    const entry = {
      ...gokuEntry,
      recommendationSupport: {
        ...gokuEntry.recommendationSupport,
        hp: {
          scope: 'card-stat-only' as const,
          evidenceIds: ['card-stats'],
          blockers: ['Native HP-changing form effect has no implementation.'],
          excludes: [],
        },
      },
    };
    const gates = recommendationGates(
      entry,
      snapshotProgressions([entry]),
      request(),
      'selected-profile',
      false,
    );
    const answer = recommend(await run(), request(), 'selected-profile', gates);
    expect(answer.status).toBe('cannot-recommend');
    expect(answer.selected).toBe(null);
    expect(answer.reasons).toContain(
      'Native HP-changing form effect has no implementation.',
    );
  });
  it('requires explicit objective/kit coverage and model acknowledgement', () => {
    const r = request();
    r.objective = 'critical';
    expect(
      recommendationGates(
        gokuEntry,
        snapshotProgressions([gokuEntry]),
        r,
        'selected-profile',
        false,
      ).map((g) => g.code),
    ).toEqual(['probability-model']);
    const entry = { ...gokuEntry };
    delete entry.recommendationSupport;
    expect(
      recommendationGates(
        entry,
        snapshotProgressions([entry]),
        r,
        'selected-profile',
        true,
      ).map((g) => g.code),
    ).toEqual(['effect-coverage']);
  });
  it('missing objective calculations cannot yield a recommendation', async () => {
    const out = await run();
    out.comparison.errors = ['Unknown objective effect.'];
    expect(recommend(out, request(), 'selected-profile', []).selected).toBe(
      null,
    );
  });
  it('reports no-compatible separately from missing mechanics', async () => {
    const out = await run();
    out.comparison.groups = [];
    const a = recommend(out, request(), 'selected-profile', []);
    expect(a.status).toBe('no-compatible');
    expect(a.title).toBe('No compatible build meets these requirements');
  });
  it('does not claim an evaluation when cancelled before scanning', async () => {
    const out: SearchOutcome = await searchBuilds(request(), gokuEntry, {
      ...control(),
      cancelled: () => true,
    });
    expect(recommend(out, request(), 'selected-profile', []).status).toBe(
      'cannot-recommend',
    );
  });
});

it('reconciles coverage without turning partial data into full evaluator support', () => {
  expect(
    catalogCoverage(
      catalogSnapshot,
      productionRegistry,
      snapshotProgressions(productionRegistry),
    ),
  ).toEqual({
    cardForms: 1,
    awakeningRelationships: 0,
    ezaStates: 1,
    sezaStates: 0,
    completeRequiredRecords: 0,
    evaluatorStates: 1,
    incompleteRecords: 1,
    ambiguousFormMappings: 1,
    unparsedRecords: 0,
    completeBoardTemplates: 0,
    sourceTotal: null,
  });
});
