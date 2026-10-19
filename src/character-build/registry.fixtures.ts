// TEST ONLY — fictional characters, items and evaluators used to prove that
// the registry isolates characters. Imported by tests only, never by the app;
// none of these values describe the real game.
import { catalogSnapshot } from '../data/real/catalog';
import { fixtureFact } from '../character-data/catalog.fixtures';
import type { CatalogSnapshot, CatalogState } from '../character-data/domain';
import {
  SLOTS,
  type BuildRequest,
  type CharacterCatalog,
  type Evidence,
  type EvaluatorEntry,
  type EvaluatorImplementation,
  type Metadata,
  type Metrics,
  type Stats,
} from './domain';
import { initialCheckEvaluator, INITIAL_CHECK_RULES } from './evaluation';
import { buildErrors, requestErrors } from './legality';
import { workingSettingsKey } from './registry';

// TEST ONLY kit declaration: every mechanic absent unless overridden.
export function testOnlyKit(
  overrides: Partial<CharacterCatalog['kit']> = {},
): CharacterCatalog['kit'] {
  const absent = {
    status: 'absent' as const,
    evidenceIds: ['test-only-identity'],
    note: 'TEST ONLY — declared absent.',
  };
  return {
    nativeAdditional: absent,
    nativeCritical: absent,
    nativeEvasion: absent,
    attackTriggered: absent,
    buildup: absent,
    conditional: absent,
    formChange: absent,
    ...overrides,
  };
}

export const FIXTURE_NODE_STATE = 'test-only:fixture-node:base:lv100:sa12';
export const FIXTURE_STATS_STATE = 'test-only:fixture-stats:base:lv150:sa20';
const reviewedAt = '2026-10-19';
const meta = (id: string, evidenceIds: string[]): Metadata => ({
  id,
  evidenceIds,
  support: 'supported',
  reviewedAt,
  verifiedAt: null,
});
const claim = (id: string, field: string): Evidence => ({
  id,
  field,
  statement: `TEST ONLY — fictional ${field}.`,
  status: 'documented',
  sources: [],
  independentConfirmation: null,
  reviewedAt,
  verifiedAt: null,
  limitation: 'TEST ONLY fixture; not game data.',
});
const context = (evasionAllowed: boolean) => ({
  id: 'initial-check-v1' as const,
  battleTurn: 1 as const,
  appearance: 1 as const,
  initialAttack: 'super' as const,
  externalEffects: 'none' as const,
  evasionAllowed,
});

// ---- Fixture A: shares the production implementation, but has its own card,
// two routes (gold unlocked), a choice node and three items.
const nodeModel: CharacterCatalog = {
  revision: 'test-only-node-model-1',
  card: {
    ...meta(FIXTURE_NODE_STATE, ['test-only-identity']),
    name: 'TEST ONLY Fixture Fighter',
    title: 'Registry Isolation',
    region: 'test-only',
    type: 'INT',
    rarity: 'UR',
    awakening: 'base',
    level: 100,
    superAttackLevel: 12,
    gameBuild: null,
    sourceAliases: [],
    baseStats: { hp: 1000, attack: 2000, defense: 500 },
    categories: [],
    excludedMechanics: ['TEST ONLY — nothing beyond card stats and checks.'],
  },
  profile: {
    ...meta('test-only:fixture-node:profile', ['test-only-profile']),
    label: 'TEST ONLY two-route profile',
    cardStateId: FIXTURE_NODE_STATE,
    routes: ['topLeft', 'topRight'],
    statBonus: { hp: 100, attack: 200, defense: 300 },
    fixedSkills: { additional: 1, critical: 2, evasion: 3 },
    nodes: [
      {
        ...meta('test-only-node-a', ['test-only-profile']),
        route: 'topLeft',
        levels: 2,
        options: ['critical', 'evasion'],
        prerequisites: [],
        minSuperAttackLevel: 10,
      },
    ],
  },
  orbs: [
    {
      ...meta('test-only:bronze:attack', ['test-only-items']),
      label: 'TEST ONLY bronze ATK +50',
      slots: ['bronze'],
      minSuperAttackLevel: 1,
      minRoutes: 0,
      restrictions: [{ kind: 'type', value: 'INT' }],
      stats: { attack: 50 },
      skills: {},
      reusable: false,
      gameItemId: null,
    },
    {
      ...meta('test-only:silver:additional', ['test-only-items']),
      label: 'TEST ONLY silver AA +1',
      slots: ['silver'],
      minSuperAttackLevel: 10,
      minRoutes: 0,
      restrictions: [],
      stats: {},
      skills: { additional: 1 },
      reusable: false,
      gameItemId: null,
    },
    {
      ...meta('test-only:gold:critical', ['test-only-items']),
      label: 'TEST ONLY gold critical +3',
      slots: ['gold'],
      minSuperAttackLevel: 10,
      minRoutes: 2,
      restrictions: [],
      stats: {},
      skills: { critical: 3 },
      reusable: false,
      gameItemId: null,
    },
  ],
  evidence: [
    claim('test-only-identity', 'identity'),
    claim('test-only-profile', 'profile'),
    claim('test-only-items', 'items'),
    // The shared implementation requires its rule claims to be present.
    ...Object.values(INITIAL_CHECK_RULES).map((id) => claim(id, id)),
  ],
  kit: testOnlyKit(),
};

export function fixtureNodeRequest(): BuildRequest {
  return {
    cardStateId: FIXTURE_NODE_STATE,
    level: 100,
    superAttackLevel: 12,
    progression: {
      profileId: 'test-only:fixture-node:profile',
      systemUnlocked: true,
      routes: ['topLeft', 'topRight'],
      activatedNodes: ['test-only-node-a'],
    },
    current: {
      choices: { 'test-only-node-a': 'critical' },
      equips: { bronze: null, silver: null, gold: null },
    },
    inventory: {},
    mode: 'catalog',
    context: context(true),
    objective: 'critical',
    frontierMetrics: ['attack', 'additionalSuper', 'critical', 'evasion'],
    maxCandidates: 1000,
  };
}

export const fixtureNodeEntry: EvaluatorEntry = {
  id: 'test-only-node-v1',
  catalogCardId: 'test-only:card:fixture-node',
  stateId: FIXTURE_NODE_STATE,
  model: nodeModel,
  contexts: [
    {
      id: 'initial-check-v1',
      label: 'TEST ONLY initial check (evasion allowed only)',
      assumptions: ['TEST ONLY assumption'],
      evasionOptions: [true],
    },
  ],
  objectives: ['attack', 'additionalSuper', 'critical', 'evasion'],
  evaluator: initialCheckEvaluator,
  storageKey: workingSettingsKey('test-only-node-v1'),
  defaults: fixtureNodeRequest,
};

// ---- Fixture B: a different implementation that computes card stats only,
// so probability metrics are unavailable and only stat objectives exist.
const testOnlyStat = {
  group: 'card-stats' as const,
  status: 'supported' as const,
  summary: 'TEST ONLY card stat.',
  basis: 'TEST ONLY sum.',
  mechanics: [],
};
export const testOnlyStatsEvaluator: EvaluatorImplementation = {
  id: 'test-only-stats-only',
  version: '1',
  label: 'TEST ONLY card stats only',
  verification: 'TEST ONLY fixture evaluator.',
  objectiveModels: {
    attack: testOnlyStat,
    defense: testOnlyStat,
    hp: testOnlyStat,
  },
  gaps: [],
  mechanics: [],
  customPotential: false,
  evaluate(build, request, entry) {
    const errors = [
      ...requestErrors(request, entry),
      ...buildErrors(build, request, entry.model),
    ];
    if (errors.length) throw new Error(errors.join(' '));
    const { card, profile, orbs } = entry.model;
    const stats: Stats = {
      hp: card.baseStats.hp + profile.statBonus.hp,
      attack: card.baseStats.attack + profile.statBonus.attack,
      defense: card.baseStats.defense + profile.statBonus.defense,
    };
    for (const slot of SLOTS) {
      const orb = orbs.find((o) => o.id === build.equips[slot]);
      for (const key of ['hp', 'attack', 'defense'] as const)
        stats[key] += orb?.stats[key] ?? 0;
    }
    const stat = (value: number) => ({
      value,
      unit: 'stat' as const,
      evidenceIds: ['test-only-identity'],
      reason: 'TEST ONLY card stat.',
    });
    const none = (unit: 'probability' | 'damage' | 'stat') => ({
      value: null,
      unit,
      evidenceIds: [],
      reason: 'TEST ONLY — not computed by this evaluator.',
    });
    const metrics: Metrics = {
      attack: stat(stats.attack),
      defense: stat(stats.defense),
      hp: stat(stats.hp),
      additionalSuper: none('probability'),
      additionalTrigger: none('probability'),
      critical: none('probability'),
      evasion: none('probability'),
      damage: none('damage'),
      battleDefense: none('stat'),
    };
    return {
      stats,
      skills: { additional: 0, critical: 0, evasion: 0 },
      metrics,
      trace: { stats: [], skills: [], probabilities: [] },
      comparisonKey: JSON.stringify([entry.id, request.context]),
    };
  },
};

const statsModel: CharacterCatalog = {
  revision: 'test-only-stats-model-1',
  card: {
    ...meta(FIXTURE_STATS_STATE, ['test-only-identity']),
    name: 'TEST ONLY Stats Dummy',
    title: 'Objective Isolation',
    region: 'test-only',
    type: 'TEQ',
    rarity: 'LR',
    awakening: 'base',
    level: 150,
    superAttackLevel: 20,
    gameBuild: null,
    sourceAliases: [],
    baseStats: { hp: 3000, attack: 3000, defense: 3000 },
    categories: [],
    excludedMechanics: ['TEST ONLY — probabilities are not computed.'],
  },
  profile: {
    ...meta('test-only:fixture-stats:profile', ['test-only-profile']),
    label: 'TEST ONLY flat profile',
    cardStateId: FIXTURE_STATS_STATE,
    routes: [],
    statBonus: { hp: 0, attack: 0, defense: 0 },
    fixedSkills: { additional: 0, critical: 0, evasion: 0 },
    nodes: [],
  },
  orbs: [
    {
      ...meta('test-only:bronze:teq-hp', ['test-only-items']),
      label: 'TEST ONLY TEQ bronze HP +100',
      slots: ['bronze'],
      minSuperAttackLevel: 1,
      minRoutes: 0,
      restrictions: [{ kind: 'type', value: 'TEQ' }],
      stats: { hp: 100 },
      skills: {},
      reusable: false,
      gameItemId: null,
    },
    {
      ...meta('test-only:bronze:agl-atk', ['test-only-items']),
      label: 'TEST ONLY AGL-only bronze ATK +100',
      slots: ['bronze'],
      minSuperAttackLevel: 1,
      minRoutes: 0,
      restrictions: [{ kind: 'type', value: 'AGL' }],
      stats: { attack: 100 },
      skills: {},
      reusable: false,
      gameItemId: null,
    },
  ],
  evidence: [
    claim('test-only-identity', 'identity'),
    claim('test-only-profile', 'profile'),
    claim('test-only-items', 'items'),
  ],
  kit: testOnlyKit(),
};

export function fixtureStatsRequest(): BuildRequest {
  return {
    cardStateId: FIXTURE_STATS_STATE,
    level: 150,
    superAttackLevel: 20,
    progression: {
      profileId: 'test-only:fixture-stats:profile',
      systemUnlocked: true,
      routes: [],
      activatedNodes: [],
    },
    current: {
      choices: {},
      equips: { bronze: null, silver: null, gold: null },
    },
    inventory: {},
    mode: 'catalog',
    context: context(true),
    objective: 'hp',
    frontierMetrics: ['attack', 'defense', 'hp'],
    maxCandidates: 1000,
  };
}

export const fixtureStatsEntry: EvaluatorEntry = {
  id: 'test-only-stats-v1',
  catalogCardId: 'test-only:card:fixture-stats',
  stateId: FIXTURE_STATS_STATE,
  model: statsModel,
  contexts: [
    {
      id: 'initial-check-v1',
      label: 'TEST ONLY stats context',
      assumptions: ['TEST ONLY assumption'],
      evasionOptions: [true],
    },
  ],
  objectives: ['attack', 'defense', 'hp'],
  evaluator: testOnlyStatsEvaluator,
  storageKey: workingSettingsKey('test-only-stats-v1'),
  defaults: fixtureStatsRequest,
};

// ---- Catalog: the real bundled record plus TEST ONLY cards and states,
// including states for every refusal path. Validated only with fixtures allowed.
export const FIXTURE_UNSUPPORTED_STATE = 'test-only:fixture-node:eza1';
export const FIXTURE_MISSING_STATE = 'test-only:fixture-node:seza1';
export const FIXTURE_BORROWING_STATE = 'test-only:fixture-stats:eza1';

export function registryFixtureSnapshot(): CatalogSnapshot {
  const f = fixtureFact;
  const real = structuredClone(catalogSnapshot);
  const state = (
    id: string,
    cardId: string,
    awakening: CatalogState['awakening'],
    model: CharacterCatalog,
    optimization: CatalogState['optimization'],
  ): CatalogState => ({
    id,
    cardId,
    awakening,
    region: model.card.region,
    gameVersion: null,
    fields: {
      type: f(model.card.type as 'INT'),
      class: f('Extreme'),
      rarity: f(model.card.rarity),
      level: f(model.card.level),
      superAttackLevel: f(model.card.superAttackLevel),
      rawStats: f({ ...model.card.baseStats }),
      leaderSkill: f('TEST ONLY — fictional leader'),
      passive: f('TEST ONLY — fictional passive'),
      superAttack: f('TEST ONLY — fictional effect'),
      links: f(['TEST ONLY link']),
      categories: f(['TEST ONLY category']),
    },
    potentialProfiles: [],
    optimization,
  });
  const limited = (evaluatorId: string) => ({
    status: 'limited' as const,
    evaluatorId,
    reason: 'TEST ONLY — limited evaluator.',
  });
  return {
    ...real,
    id: 'test-only-registry-catalog',
    revision: 'test-only-registry-1',
    origin: 'test-fixtures',
    coverage: {
      sourceCardCount: null,
      scope: 'TEST ONLY — the bundled record plus fictional registry fixtures',
      excluded: [],
    },
    sources: [
      ...real.sources,
      {
        id: 'test-only-source',
        label: 'TEST ONLY — fictional catalog source',
        url: null,
        access: 'test-fixture',
        license: null,
        permissionReference: null,
        note: 'No real character data or game verification.',
      },
    ],
    cards: [
      ...real.cards,
      {
        id: 'test-only:card:fixture-node',
        name: f('TEST ONLY Fixture Fighter'),
        title: f('Registry Isolation'),
        aliases: [],
        form: 'unknown',
        fromCardId: null,
      },
      {
        id: 'test-only:card:fixture-stats',
        name: f('TEST ONLY Stats Dummy'),
        title: f('Objective Isolation'),
        aliases: [],
        form: 'unknown',
        fromCardId: null,
      },
    ],
    states: [
      ...real.states,
      state(
        FIXTURE_NODE_STATE,
        'test-only:card:fixture-node',
        { kind: 'base', step: null },
        nodeModel,
        limited('test-only-node-v1'),
      ),
      state(
        FIXTURE_STATS_STATE,
        'test-only:card:fixture-stats',
        { kind: 'base', step: null },
        statsModel,
        limited('test-only-stats-v1'),
      ),
      state(
        FIXTURE_UNSUPPORTED_STATE,
        'test-only:card:fixture-node',
        { kind: 'eza', step: 1 },
        nodeModel,
        {
          status: 'unavailable',
          evaluatorId: null,
          reason: 'TEST ONLY — no evaluator admitted for this state.',
        },
      ),
      state(
        FIXTURE_MISSING_STATE,
        'test-only:card:fixture-node',
        { kind: 'seza', step: 1 },
        nodeModel,
        limited('test-only-missing-v1'),
      ),
      // Names the real Goku evaluator: it must be refused, never reused.
      state(
        FIXTURE_BORROWING_STATE,
        'test-only:card:fixture-stats',
        { kind: 'eza', step: 1 },
        statsModel,
        limited('goku-initial-check-v1'),
      ),
    ],
    stateAliases: [
      ...real.stateAliases,
      { alias: 'test-only-node-alias', stateId: FIXTURE_NODE_STATE },
    ],
  };
}
