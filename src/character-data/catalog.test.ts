import { describe, expect, it } from 'vitest';
import {
  characterCatalog,
  CARD_STATE_ID,
  defaultRequest,
} from '../data/real/character-build/goku';
import { catalogSnapshot } from '../data/real/catalog';
import {
  CHARACTER_STORAGE_KEY,
  loadCharacterState,
  saveCharacterState,
} from '../character-build/storage';
import {
  assessCatalogUpdate,
  catalogCounts,
  completeness,
  evidenceStatus,
  importCatalog,
  inspectSavedBuildIdentity,
  resolveBuildState,
  resolveState,
  searchCatalog,
  statLayers,
} from './catalog';
import { fromAdmittedRecord } from './admitted-record-adapter';
import { fixtureFact, fixtureSnapshot } from './catalog.fixtures';
import { validateCatalog } from './validation';

describe('normalized import contract (fixtures are fictional, not game verification)', () => {
  it('admits the existing real record without expanding cards/states or inventing missing fields', () => {
    expect(validateCatalog(catalogSnapshot).ok).toBe(true);
    expect(catalogCounts(catalogSnapshot)).toEqual({
      cards: 1,
      startingForms: 0,
      awakenedForms: 0,
      transformedForms: 0,
      unclassifiedForms: 1,
      states: 1,
      baseStates: 0,
      ezaStates: 1,
      sezaStates: 0,
      unknownStates: 0,
      excluded: 0,
      sourceCardCount: null,
    });
    const fields = catalogSnapshot.states[0]!.fields;
    expect(fields.categories.value).toBeNull();
    expect(fields.links.value).toBeNull();
    expect(fields.leaderSkill.value).toBeNull();
    expect(completeness(fields)).toEqual({
      total: 11,
      complete: 6,
      partial: 2,
      missing: 3,
      independentlyConfirmed: 0,
    });
  });
  it('keeps test fixtures out of normal imports while allowing explicit test-only validation', () => {
    expect(validateCatalog(fixtureSnapshot()).ok).toBe(false);
    expect(
      validateCatalog(fixtureSnapshot(), { allowTestFixtures: true }).ok,
    ).toBe(true);
    const disguised = fixtureSnapshot();
    disguised.origin = 'normalized-export';
    expect(validateCatalog(disguised).ok).toBe(false);
  });
  it('validates trusted adapter output and catches normalization failure without exposing error content', () => {
    const sample = { anything: 'untrusted input' };
    expect(
      importCatalog(
        { providerId: 'local-admitted', normalize: () => catalogSnapshot },
        sample,
      ).ok,
    ).toBe(true);
    const result = importCatalog(
      {
        providerId: 'broken',
        normalize: () => {
          throw new Error('secret-token-must-not-appear');
        },
      },
      sample,
    );
    expect(result).toEqual({
      ok: false,
      snapshot: null,
      errors: ['adapter: normalization failed; no catalog was admitted'],
    });
  });
  it.each([null, [], 'script()', {}, { schemaVersion: 999 }])(
    'rejects malformed or unknown-schema input %j',
    (input) => {
      expect(validateCatalog(input).ok).toBe(false);
    },
  );
  const invalidCases: [
    string,
    (snapshot: ReturnType<typeof fixtureSnapshot>) => void,
  ][] = [
    [
      'duplicate card IDs',
      (s) => {
        s.cards[1]!.id = s.cards[0]!.id;
      },
    ],
    [
      'duplicate state IDs',
      (s) => {
        s.states[1]!.id = s.states[0]!.id;
      },
    ],
    [
      'orphan states',
      (s) => {
        s.states[0]!.cardId = 'absent';
      },
    ],
    [
      'card without a state',
      (s) => {
        s.states = s.states.filter((state) => state.cardId !== 'fixture-seed');
      },
    ],
    [
      'unknown provenance',
      (s) => {
        s.cards[0]!.name.provenance[0]!.sourceId = 'absent';
      },
    ],
    [
      'unsafe source URL',
      (s) => {
        s.sources[0]!.url = 'javascript:alert(1)';
      },
    ],
    [
      'URL with credentials',
      (s) => {
        s.sources[0]!.url = 'https://token:secret@example.invalid/';
      },
    ],
    [
      'fake approved export',
      (s) => {
        s.sources[0]!.access = 'approved-export';
      },
    ],
    [
      'unjustified independent confirmation',
      (s) => {
        s.cards[0]!.name.provenance[0]!.status = 'independently-confirmed';
      },
    ],
    [
      'impossible review date',
      (s) => {
        s.cards[0]!.name.provenance[0]!.reviewedAt = '2026-02-30';
      },
    ],
    [
      'missing fact with a value',
      (s) => {
        s.cards[0]!.name.completeness = 'missing';
      },
    ],
    [
      'missing fact without reason',
      (s) => {
        s.states[4]!.fields.categories.note = null;
      },
    ],
    [
      'present value without evidence',
      (s) => {
        s.cards[0]!.name.provenance = [];
      },
    ],
    [
      'partial fact without limitation',
      (s) => {
        s.cards[0]!.name.completeness = 'partial';
      },
    ],
    [
      'fractional level',
      (s) => {
        s.states[0]!.fields.level.value = 1.5;
      },
    ],
    [
      'negative stat',
      (s) => {
        s.states[0]!.fields.rawStats.value!.attack = -1;
      },
    ],
    [
      'wrong stat layer shape',
      (s) => {
        (
          s.states[0]!.fields.rawStats.value as unknown as Record<
            string,
            unknown
          >
        ).damage = 100;
      },
    ],
    [
      'unknown awakening kind',
      (s) => {
        (s.states[0]!.awakening as unknown as Record<string, unknown>).kind =
          'guessed';
      },
    ],
    [
      'base state with EZA step',
      (s) => {
        s.states[0]!.awakening.step = 7;
      },
    ],
    [
      'ambiguous source alias',
      (s) => {
        s.cards[1]!.aliases = structuredClone(s.cards[0]!.aliases);
      },
    ],
    [
      'alias colliding with canonical state',
      (s) => {
        s.stateAliases[0]!.alias = 'fixture-ranger-base';
      },
    ],
    [
      'alias with missing target',
      (s) => {
        s.stateAliases[0]!.stateId = 'absent';
      },
    ],
    [
      'ordinary awakening cycle',
      (s) => {
        s.cards[0]!.fromCardId = 'fixture-ranger';
      },
    ],
    [
      'false source reconciliation',
      (s) => {
        s.coverage.sourceCardCount = 1000;
      },
    ],
    [
      'unsupported normalized field',
      (s) => {
        (
          s.states[0]!.fields as unknown as Record<string, unknown>
        ).damageFormula = 'doSomething()';
      },
    ],
  ];
  it.each(invalidCases)(
    'rejects %s with a path-specific report',
    (_label, mutate) => {
      const snapshot = fixtureSnapshot();
      mutate(snapshot);
      const result = validateCatalog(snapshot, { allowTestFixtures: true });
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    },
  );
  it('detaches validated data from the caller and preserves null retrieval/verification dates', () => {
    const input = structuredClone(catalogSnapshot),
      result = validateCatalog(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    input.cards[0]!.name.value = 'changed outside';
    expect(result.snapshot.cards[0]!.name.value).toBe('Super Saiyan 3 Goku');
    const refs = result.snapshot.states[0]!.fields.rawStats.provenance;
    expect(
      refs.every(
        (p) => p.retrievedAt === null && p.independentConfirmation === null,
      ),
    ).toBe(true);
  });
  it('rejects prototype-named unknown normalized fields in parsed JSON', () => {
    const snapshot = JSON.parse(JSON.stringify(fixtureSnapshot()));
    Object.defineProperty(snapshot.states[0].fields, '__proto__', {
      value: 'unmapped',
      enumerable: true,
    });
    const result = validateCatalog(snapshot, { allowTestFixtures: true });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) => error.includes('fields.__proto__')),
    ).toBe(true);
  });
  it.each([
    ['snapshot', (s: any) => (s.extra = 1), 'snapshot.extra'],
    ['card', (s: any) => (s.cards[0].unexpected = 1), 'cards[0].unexpected'],
    [
      'alias',
      (s: any) => (s.cards[0].aliases[0].note = 'x'),
      'cards[0].aliases[0].note',
    ],
    [
      'state',
      (s: any) => (s.states[0].damageFormula = 'x'),
      'states[0].damageFormula',
    ],
    [
      'fact',
      (s: any) => (s.states[0].fields.type.verified = true),
      'states[0].fields.type.verified',
    ],
    [
      'provenance',
      (s: any) => (s.states[0].fields.type.provenance[0].trusted = true),
      'states[0].fields.type.provenance[0].trusted',
    ],
    [
      'optimization',
      (s: any) => (s.states[0].optimization.objective = 'damage'),
      'states[0].optimization.objective',
    ],
    ['source', (s: any) => (s.sources[0].token = 'x'), 'sources[0].token'],
    ['coverage', (s: any) => (s.coverage.total = 1), 'coverage.total'],
  ])(
    'rejects an unknown %s key instead of carrying unvalidated content',
    (_level, mutate, path) => {
      const snapshot = JSON.parse(JSON.stringify(catalogSnapshot));
      mutate(snapshot);
      const result = validateCatalog(snapshot);
      expect(result.ok).toBe(false);
      expect(result.errors.some((error) => error.startsWith(path))).toBe(true);
    },
  );
  it('rejects deeply nested unknown content without throwing', () => {
    const depth = 200_000;
    const text = JSON.stringify(catalogSnapshot).replace(
      /}$/,
      `,"extra":${'['.repeat(depth)}${']'.repeat(depth)}}`,
    );
    const parsed: unknown = JSON.parse(text);
    let result: ReturnType<typeof validateCatalog> | null = null;
    expect(() => (result = validateCatalog(parsed))).not.toThrow();
    expect(result!.ok).toBe(false);
  });
  it('bounds link and category lists', () => {
    const snapshot = JSON.parse(JSON.stringify(fixtureSnapshot()));
    snapshot.states[0].fields.links = {
      ...snapshot.states[0].fields.links,
      value: Array.from({ length: 1001 }, (_, i) => `TEST ONLY link ${i}`),
      completeness: 'complete',
    };
    const result = validateCatalog(snapshot, { allowTestFixtures: true });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.startsWith('states[0].fields.links.value')),
    ).toBe(true);
  });
  it('counts confirmed evidence only with its separate dated confirmation, not completeness or test success', () => {
    const f = fixtureFact('TEST ONLY — value');
    expect(evidenceStatus(f)).toBe('source-documented');
    f.provenance[0]!.status = 'independently-confirmed';
    expect(evidenceStatus(f)).toBe('source-documented');
    f.provenance[0]!.reviewedAt = '2026-10-19';
    f.provenance[0]!.independentConfirmation = {
      reference: 'TEST ONLY — example evidence receipt',
      date: '2026-10-19',
    };
    expect(evidenceStatus(f)).toBe('independently-confirmed');
    f.provenance.push({
      ...f.provenance[0]!,
      status: 'unresolved',
      independentConfirmation: null,
    });
    expect(evidenceStatus(f)).toBe('unresolved');
  });
});

describe('search and exact identity with independently enumerated fixture sets', () => {
  it.each([
    [{ query: 'ECHO ranger' }, ['fixture-ranger', 'fixture-other']],
    [{ query: 'ranger-source-id' }, ['fixture-ranger']],
    [{ type: 'TEQ' }, ['fixture-seed']],
    [{ rarity: 'LR' }, ['fixture-other']],
    [{ category: 'Fixture Red', awakening: 'eza' }, ['fixture-ranger']],
    [{ category: 'Fixture Blue', awakening: 'eza' }, []],
    [{ category: '__missing__' }, ['fixture-other']],
    [{ region: 'other-fixture-region', awakening: 'seza' }, []],
    [{ query: 'no matching card' }, []],
  ])(
    'searches %j without combining incompatible states',
    (filters, expected) => {
      expect(
        searchCatalog(fixtureSnapshot(), filters).map((row) => row.card.id),
      ).toEqual(expected);
    },
  );
  it('keeps three states of one card separate from ordinary awakening siblings and same-name cards', () => {
    const snapshot = fixtureSnapshot();
    expect(catalogCounts(snapshot)).toMatchObject({
      cards: 3,
      states: 5,
      startingForms: 2,
      awakenedForms: 1,
      baseStates: 3,
      ezaStates: 1,
      sezaStates: 1,
    });
    expect(
      searchCatalog(snapshot, { awakening: 'seza' }).map((row) =>
        row.states.map((s) => s.id),
      ),
    ).toEqual([['fixture-ranger-seza']]);
    expect(
      resolveState(snapshot, 'fixture-ranger-eza')?.fields.passive.value,
    ).toBe('TEST ONLY — eza passive');
    expect(resolveState(snapshot, 'old-fixture-eza-id')?.id).toBe(
      'fixture-ranger-eza',
    );
    expect(resolveState(snapshot, 'TEST ONLY — Écho Ranger')).toBeNull();
    expect(resolveState(snapshot, 'unknown-state')).toBeNull();
  });
  const withLimitedEza = () => {
    const snapshot = fixtureSnapshot();
    const eza = snapshot.states.find((s) => s.id === 'fixture-ranger-eza')!;
    eza.optimization = {
      status: 'limited',
      evaluatorId: 'TEST ONLY — fixture evaluator id',
      reason: 'TEST ONLY — limited support declaration',
    };
    return snapshot;
  };
  it.each([
    [{ optimization: 'limited' }, [['fixture-ranger', ['fixture-ranger-eza']]]],
    [
      { optimization: 'unavailable' },
      [
        ['fixture-seed', ['fixture-seed-base']],
        ['fixture-ranger', ['fixture-ranger-base', 'fixture-ranger-seza']],
        ['fixture-other', ['fixture-other-base']],
      ],
    ],
    // The limited state is EZA; a base filter must not borrow its support status.
    [{ optimization: 'limited', awakening: 'base' }, []],
    [{ optimization: 'limited', category: 'Fixture Blue' }, []],
    [
      { optimization: 'limited', category: 'Fixture Red' },
      [['fixture-ranger', ['fixture-ranger-eza']]],
    ],
  ] as const)(
    'filters optimization support %j on the same state as other filters',
    (filters, expected) => {
      expect(
        searchCatalog(withLimitedEza(), filters).map((row) => [
          row.card.id,
          row.states.map((s) => s.id),
        ]),
      ).toEqual(expected);
    },
  );
  it('sorts by normalized name, then title, then card ID, with unknown names last', () => {
    const snapshot = fixtureSnapshot();
    // Hand order: "echo ranger" (awakened… < same-name…) before "echo seed".
    expect(
      searchCatalog(snapshot, { sort: 'name' }).map((r) => r.card.id),
    ).toEqual(['fixture-ranger', 'fixture-other', 'fixture-seed']);
    expect(searchCatalog(snapshot).map((r) => r.card.id)).toEqual([
      'fixture-seed',
      'fixture-ranger',
      'fixture-other',
    ]);
    expect(
      searchCatalog(snapshot, { sort: 'catalog' }).map((r) => r.card.id),
    ).toEqual(['fixture-seed', 'fixture-ranger', 'fixture-other']);

    const tied = fixtureSnapshot();
    tied.cards[1]!.title = fixtureFact('Fixture identical title');
    tied.cards[2]!.title = fixtureFact('Fixture identical title');
    // Equal names and titles: "fixture-other" < "fixture-ranger" by ID.
    expect(searchCatalog(tied, { sort: 'name' }).map((r) => r.card.id)).toEqual(
      ['fixture-other', 'fixture-ranger', 'fixture-seed'],
    );

    const unknownName = fixtureSnapshot();
    unknownName.cards[0]!.name = {
      value: null,
      completeness: 'missing',
      provenance: [],
      note: 'TEST ONLY — name not admitted',
    };
    unknownName.cards[1]!.title = {
      value: null,
      completeness: 'missing',
      provenance: [],
      note: 'TEST ONLY — title not admitted',
    };
    // fixture-seed has no name: last. Same-name pair: known title before unknown title.
    expect(
      searchCatalog(unknownName, { sort: 'name' }).map((r) => r.card.id),
    ).toEqual(['fixture-other', 'fixture-ranger', 'fixture-seed']);
    expect(
      searchCatalog(unknownName, { sort: 'name', query: 'fixture-seed' }).map(
        (r) => r.card.id,
      ),
    ).toEqual(['fixture-seed']);
  });
  it('is deterministic across repeated calls and does not mutate snapshot order', () => {
    const snapshot = fixtureSnapshot();
    const before = JSON.stringify(snapshot);
    const first = searchCatalog(snapshot, { sort: 'name', query: 'echo' });
    const second = searchCatalog(snapshot, { sort: 'name', query: 'echo' });
    expect(second.map((r) => r.card.id)).toEqual(first.map((r) => r.card.id));
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(snapshot.cards.map((c) => c.id)).toEqual([
      'fixture-seed',
      'fixture-ranger',
      'fixture-other',
    ]);
  });
  it('keeps the memoized index per snapshot object, matching hand-listed results', () => {
    const a = fixtureSnapshot();
    const b = fixtureSnapshot();
    b.cards[0]!.name = fixtureFact('TEST ONLY — Different Sprout');
    // Repeated searches over the cached index of snapshot A.
    for (let i = 0; i < 3; i++) {
      expect(searchCatalog(a, { query: 'seed' }).map((r) => r.card.id)).toEqual(
        ['fixture-seed'],
      );
      expect(searchCatalog(a, { query: 'ECHO' }).map((r) => r.card.id)).toEqual(
        ['fixture-seed', 'fixture-ranger', 'fixture-other'],
      );
    }
    // Snapshot B has its own index: its renamed card no longer matches "seed" by name,
    // but still matches by card ID "fixture-seed".
    expect(searchCatalog(b, { query: 'sprout' }).map((r) => r.card.id)).toEqual(
      ['fixture-seed'],
    );
    expect(searchCatalog(a, { query: 'sprout' })).toEqual([]);
    expect(searchCatalog(b, { query: 'echo seed' })).toEqual([]);
    // A replaced cards array is re-indexed rather than served from a stale cache.
    a.cards = [a.cards[1]!, a.cards[2]!];
    a.states = a.states.filter((s) => s.cardId !== 'fixture-seed');
    expect(searchCatalog(a, { query: 'echo' }).map((r) => r.card.id)).toEqual([
      'fixture-ranger',
      'fixture-other',
    ]);
  });
  it('rejects test-fixture-origin files on the default (local file import) validation path', () => {
    const parsed: unknown = JSON.parse(JSON.stringify(fixtureSnapshot()));
    const result = validateCatalog(parsed);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'origin: test fixtures are not admitted to the application catalog',
    );
    // Relabelling the origin does not launder a fixture source either.
    const relabelled = JSON.parse(JSON.stringify(fixtureSnapshot()));
    relabelled.origin = 'normalized-export';
    expect(validateCatalog(relabelled).errors).toContain(
      'sources[0].access: fixture source in a non-fixture snapshot',
    );
  });
  it('keeps raw, potential, equip and unknown battle stats separate (arithmetic only)', () => {
    const state = catalogSnapshot.states[0]!;
    expect(
      statLayers(state, state.potentialProfiles[0]!.id, {
        hp: 0,
        attack: 500,
        defense: 0,
      }),
    ).toEqual({
      raw: { hp: 12527, attack: 11111, defense: 5796 },
      potential: { hp: 2800, attack: 2800, defense: 2800 },
      equips: { hp: 0, attack: 500, defense: 0 },
      preBattle: { hp: 15327, attack: 14411, defense: 8596 },
      battle: null,
    });
    expect(
      statLayers(state, null, { hp: 0, attack: 0, defense: 0 }).preBattle,
    ).toEqual({ hp: 12527, attack: 11111, defense: 5796 });
    expect(statLayers(state, 'unknown-profile', null).preBattle).toBeNull();
    const missing = structuredClone(state);
    missing.fields.rawStats.value = null;
    expect(
      statLayers(missing, null, { hp: 0, attack: 0, defense: 0 }).preBattle,
    ).toBeNull();
  });
});

describe('snapshot updates and existing saved builds', () => {
  it('reports potential stat-layer and support metadata changes even when detail fields stay equal', () => {
    const previous = structuredClone(catalogSnapshot),
      next = structuredClone(catalogSnapshot);
    next.states[0]!.potentialProfiles[0]!.statAdditions.note =
      'TEST ONLY — changed provenance limitation';
    next.states[0]!.optimization.reason =
      'TEST ONLY — updated support limitation';
    expect(assessCatalogUpdate(previous, next).changes).toEqual([
      { stateId: CARD_STATE_ID, fields: ['potentialProfiles', 'optimization'] },
    ]);
  });
  it('reports source notices without treating a new string as authenticated permission', () => {
    const previous = fixtureSnapshot(),
      next = fixtureSnapshot();
    next.sources[0]!.note = 'TEST ONLY — changed source notice';
    expect(assessCatalogUpdate(previous, next).sourceChanges).toEqual([
      'test-only-source',
    ]);
    expect(next.sources[0]!.permissionReference).toBeNull();
  });
  it('reports additions and field changes while retaining exact state IDs and aliases', () => {
    const previous = fixtureSnapshot(),
      next = fixtureSnapshot();
    next.revision = 'fixture-v2';
    next.states[2]!.fields.passive.value = 'TEST ONLY — corrected description';
    const report = assessCatalogUpdate(previous, next);
    expect(report.compatible).toBe(true);
    expect(report.changes).toEqual([
      { stateId: 'fixture-ranger-eza', fields: ['passive'] },
    ]);
    next.cards[1]!.title.value = 'TEST ONLY — corrected card title';
    expect(assessCatalogUpdate(previous, next).cardChanges).toEqual([
      { cardId: 'fixture-ranger', fields: ['title'] },
    ]);
    const added = structuredClone(next.states[0]!);
    added.id = 'fixture-seed-eza';
    added.awakening = { kind: 'eza', step: 7 };
    next.states.push(added);
    expect(assessCatalogUpdate(previous, next).addedStates).toEqual([
      'fixture-seed-eza',
    ]);
    expect(resolveState(next, 'old-fixture-eza-id')?.id).toBe(
      'fixture-ranger-eza',
    );
  });
  it.each([
    'awakening',
    'level',
    'region',
    'removed',
    'state alias',
    'source alias',
  ] as const)(
    'flags %s changes instead of silently reassigning saved identity',
    (kind) => {
      const previous = fixtureSnapshot(),
        next = fixtureSnapshot();
      if (kind === 'awakening')
        next.states[2]!.awakening = { kind: 'seza', step: 8 };
      if (kind === 'level') next.states[2]!.fields.level.value = 150;
      if (kind === 'region') next.states[2]!.region = 'new-region';
      if (kind === 'removed') next.states.splice(2, 1);
      if (kind === 'state alias')
        next.stateAliases[0]!.stateId = 'fixture-ranger-seza';
      if (kind === 'source alias') {
        next.cards[2]!.aliases = next.cards[1]!.aliases;
        next.cards[1]!.aliases = [];
      }
      expect(assessCatalogUpdate(previous, next).compatible).toBe(false);
    },
  );
  it('retains the existing saved Goku request, quantities, revision and legacy storage byte-for-byte', () => {
    const values = new Map<string, string>([
      ['dokkan-team-lab.collection.v1', 'legacy untouched'],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const request = defaultRequest();
    request.inventory['agl:bronze:hp:5'] = 3;
    expect(saveCharacterState(storage, request, characterCatalog)).toBeNull();
    const raw = values.get(CHARACTER_STORAGE_KEY)!;
    expect(inspectSavedBuildIdentity(raw, catalogSnapshot)).toMatchObject({
      status: 'resolved',
      stateId: CARD_STATE_ID,
    });
    const next = structuredClone(catalogSnapshot);
    next.revision = 'catalog-text-update';
    expect(inspectSavedBuildIdentity(raw, next).status).toBe('resolved');
    expect(
      loadCharacterState(storage, defaultRequest(), characterCatalog).state,
    ).toEqual(request);
    expect(values.get(CHARACTER_STORAGE_KEY)).toBe(raw);
    expect(values.get('dokkan-team-lab.collection.v1')).toBe(
      'legacy untouched',
    );
    expect(resolveBuildState(next, { ...request, level: 120 })).toBeNull();
    expect(
      resolveBuildState(next, { ...request, superAttackLevel: 10 }),
    ).toBeNull();
  });
  it('reports unavailable or corrupt saved identities without substituting the only admitted card', () => {
    const saved = {
      version: 1,
      catalogRevision: 'old',
      request: {
        cardStateId: 'not-admitted',
        level: 140,
        superAttackLevel: 15,
      },
    };
    expect(
      inspectSavedBuildIdentity(JSON.stringify(saved), catalogSnapshot).status,
    ).toBe('unavailable');
    expect(inspectSavedBuildIdentity('not json', catalogSnapshot).status).toBe(
      'invalid',
    );
    expect(inspectSavedBuildIdentity(null, catalogSnapshot).status).toBe(
      'none',
    );
  });
  it('does not generalize the admitted Goku migration into guessed facts for another card', () => {
    const legacy = structuredClone(characterCatalog);
    legacy.card.id = 'another-card';
    expect(() => fromAdmittedRecord(legacy, 'another-card')).toThrow(
      'existing exact EZA Goku',
    );
  });
});
