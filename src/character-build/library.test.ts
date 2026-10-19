import { describe, expect, it } from 'vitest';
import {
  characterCatalog,
  defaultRequest,
  ORB_IDS,
} from '../data/real/character-build/goku';
import {
  buildStatus,
  createSavedBuild,
  exportBundle,
  LIBRARY_STORAGE_KEY,
  loadLibrary,
  MAX_SAVED_BUILDS,
  mergeImported,
  parseBuildRequest,
  parseImport,
  planImport,
  saveLibrary,
  type SavedBuild,
} from './library';
import { CHARACTER_STORAGE_KEY } from './storage';

function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
const now = new Date('2026-10-19T12:00:00.000Z');
function saved(id: string, name = `Build ${id}`): SavedBuild {
  const request = defaultRequest();
  request.current.equips.silver = ORB_IDS.critical;
  request.inventory[ORB_IDS.attack] = 2;
  const result = createSavedBuild({
    id,
    name,
    now,
    request,
    catalog: characterCatalog,
  });
  if (!result.build) throw new Error(result.error);
  return result.build;
}
const json = (value: unknown) => JSON.parse(JSON.stringify(value));

describe('structural parsing of untrusted build settings', () => {
  it('round trips a JSON copy of valid settings into a detached object', () => {
    const request = defaultRequest();
    request.inventory[ORB_IDS.hp] = 3;
    const raw = json(request);
    const parsed = parseBuildRequest(raw)!;
    expect(parsed).toEqual(request);
    raw.inventory[ORB_IDS.hp] = 99;
    expect(parsed.inventory[ORB_IDS.hp]).toBe(3);
  });
  it.each([
    ['an extra top-level key', (r: any) => (r.extra = true)],
    ['a missing key', (r: any) => delete r.objective],
    ['a fractional quantity', (r: any) => (r.inventory.x = 1.5)],
    ['a string level', (r: any) => (r.level = '140')],
    ['an extra context effect', (r: any) => (r.context.buff = 'x')],
    ['a missing equip slot', (r: any) => delete r.current.equips.gold],
    ['a numeric equip', (r: any) => (r.current.equips.bronze = 1)],
    ['an array inventory', (r: any) => (r.inventory = [])],
  ])('rejects %s', (_label, mutate) => {
    const raw = json(defaultRequest());
    mutate(raw);
    expect(parseBuildRequest(raw)).toBeNull();
  });
  it('rejects prototype-named keys from parsed JSON', () => {
    const raw = JSON.parse(
      JSON.stringify(defaultRequest()).replace(
        '"inventory":{}',
        '"inventory":{"__proto__":1}',
      ),
    );
    expect(Object.hasOwn(raw.inventory, '__proto__')).toBe(true);
    expect(parseBuildRequest(raw)).toBeNull();
  });
});

describe('saved-build records', () => {
  it('records exact state, catalog revision, evaluator version and time', () => {
    const build = saved('a', '  Crit silver  ');
    expect(build).toMatchObject({
      id: 'a',
      name: 'Crit silver',
      savedAt: '2026-10-19T12:00:00.000Z',
      catalogRevision: 'goku-initial-check-2026-10-18.1',
      evaluatorVersion: 'goku-initial-check-v1',
    });
    expect(build.request.cardStateId).toBe(
      'global-en:1003211:eza-7:lv140:sa15',
    );
    expect(build.request.level).toBe(140);
    expect(build.request.superAttackLevel).toBe(15);
    expect(buildStatus(build, characterCatalog)).toEqual({
      kind: 'ready',
      reason: null,
    });
  });
  it('rejects blank or overlong names and invalid settings', () => {
    const base = { id: 'x', now, catalog: characterCatalog };
    expect(
      createSavedBuild({ ...base, name: '   ', request: defaultRequest() })
        .error,
    ).toContain('name');
    expect(
      createSavedBuild({
        ...base,
        name: 'x'.repeat(81),
        request: defaultRequest(),
      }).error,
    ).toContain('name');
    const invalid = defaultRequest();
    invalid.progression.systemUnlocked = false;
    expect(
      createSavedBuild({ ...base, name: 'ok', request: invalid }).error,
    ).toContain('valid settings');
  });
  it('marks a different catalog revision stale instead of loading it', () => {
    const build = { ...saved('a'), catalogRevision: 'older-revision' };
    expect(buildStatus(build, characterCatalog).kind).toBe('stale');
  });
  it('marks a build saved for another evaluator version stale', () => {
    const build = { ...saved('a'), evaluatorVersion: 'goku-initial-check-v0' };
    const status = buildStatus(build, characterCatalog);
    expect(status.kind).toBe('stale');
    expect(status.reason).toContain('goku-initial-check-v0');
  });
  it('marks same-revision settings that fail legality as invalid', () => {
    const build = saved('a');
    build.request.superAttackLevel = 14;
    const status = buildStatus(build, characterCatalog);
    expect(status.kind).toBe('invalid');
    expect(status.reason).toContain('EZA and SEZA differ');
  });
});

describe('library storage', () => {
  it('saves and reloads separately from working settings and the legacy key', () => {
    const storage = memory();
    storage.values.set('dokkan-team-lab.collection.v1', 'legacy-owned');
    storage.values.set(CHARACTER_STORAGE_KEY, 'working-untouched');
    expect(saveLibrary(storage, [saved('a'), saved('b')])).toBeNull();
    const loaded = loadLibrary(storage);
    expect(loaded.status).toBe('ok');
    expect(loaded.writable).toBe(true);
    expect(loaded.builds.map((b) => b.id)).toEqual(['a', 'b']);
    expect(storage.values.get('dokkan-team-lab.collection.v1')).toBe(
      'legacy-owned',
    );
    expect(storage.values.get(CHARACTER_STORAGE_KEY)).toBe('working-untouched');
  });
  it('starts empty and writable when nothing is stored', () => {
    expect(loadLibrary(memory())).toMatchObject({
      status: 'empty',
      writable: true,
      builds: [],
    });
  });
  it.each([
    ['invalid JSON', 'not-json', 'unreadable'],
    ['an unknown shape', '{"builds":[]}', 'unreadable'],
    ['a newer version', '{"version":2,"builds":[]}', 'newer'],
  ])('preserves %s and refuses implicit overwrites', (_l, raw, status) => {
    const storage = memory();
    storage.values.set(LIBRARY_STORAGE_KEY, raw);
    const loaded = loadLibrary(storage);
    expect(loaded.status).toBe(status);
    expect(loaded.writable).toBe(false);
    expect(loaded.raw).toBe(raw);
    expect(loaded.warning).not.toBeNull();
    expect(storage.values.get(LIBRARY_STORAGE_KEY)).toBe(raw);
  });
  it('treats one malformed or duplicated entry as unreadable rather than dropping it', () => {
    const storage = memory();
    const good = saved('a');
    storage.values.set(
      LIBRARY_STORAGE_KEY,
      JSON.stringify({ version: 1, builds: [good, { id: 'b' }] }),
    );
    expect(loadLibrary(storage).status).toBe('unreadable');
    storage.values.set(
      LIBRARY_STORAGE_KEY,
      JSON.stringify({ version: 1, builds: [good, good] }),
    );
    expect(loadLibrary(storage).status).toBe('unreadable');
  });
  it('reports unavailable and throwing storage without claiming a save', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadLibrary(null).status).toBe('unavailable');
    expect(loadLibrary(broken).status).toBe('unavailable');
    expect(saveLibrary(broken, [saved('a')])).toContain('could not be written');
    expect(saveLibrary(null, [])).toContain('could not be written');
  });
  it('refuses to store more than the limit', () => {
    const storage = memory();
    const many = Array.from({ length: MAX_SAVED_BUILDS + 1 }, (_, i) =>
      saved(String(i)),
    );
    expect(saveLibrary(storage, many)).toContain('At most');
    expect(storage.values.has(LIBRARY_STORAGE_KEY)).toBe(false);
  });
});

describe('JSON export and import', () => {
  it('round trips working settings and builds', () => {
    const working = defaultRequest();
    working.mode = 'inventory';
    const text = exportBundle({
      working,
      builds: [saved('a')],
      catalog: characterCatalog,
      now,
    });
    const preview = parseImport(text, characterCatalog);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.working).toEqual({
      request: working,
      status: { kind: 'ready', reason: null },
    });
    expect(preview.builds).toEqual([
      { build: saved('a'), status: { kind: 'ready', reason: null } },
    ]);
    expect(preview.rejected).toBe(0);
    expect(preview.exportedAt).toBe('2026-10-19T12:00:00.000Z');
  });
  it('marks working settings from another catalog revision stale', () => {
    const bundle = JSON.parse(
      exportBundle({
        working: defaultRequest(),
        builds: [],
        catalog: characterCatalog,
        now,
      }),
    );
    bundle.catalogRevision = 'older-revision';
    const preview = parseImport(JSON.stringify(bundle), characterCatalog);
    expect(preview.ok && preview.working?.status.kind).toBe('stale');
  });
  it('counts malformed builds as rejected instead of importing them', () => {
    const bundle = JSON.parse(
      exportBundle({
        working: null,
        builds: [saved('a')],
        catalog: characterCatalog,
        now,
      }),
    );
    bundle.builds.push({ id: 'bad', name: '<img src=x onerror=alert(1)>' });
    const preview = parseImport(JSON.stringify(bundle), characterCatalog);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.builds).toHaveLength(1);
    expect(preview.rejected).toBe(1);
    expect(preview.working).toBeNull();
  });
  it.each([
    ['non-JSON', '<html>', 'not valid JSON'],
    ['another format', '{"format":"other"}', 'not a Dokkan'],
    [
      'a newer version',
      '{"format":"dokkan-optimizer.character-builds","version":2}',
      'newer format',
    ],
    [
      'a malformed bundle',
      '{"format":"dokkan-optimizer.character-builds","version":1}',
      'malformed',
    ],
  ])('rejects %s', (_l, text, message) => {
    const preview = parseImport(text, characterCatalog);
    expect(preview.ok).toBe(false);
    if (!preview.ok) expect(preview.error).toContain(message);
  });
  it('rejects oversized input before parsing', () => {
    const preview = parseImport(
      `"${'x'.repeat(1024 * 1024)}"`,
      characterCatalog,
    );
    expect(preview.ok || preview.error).toContain('1 MiB');
  });
  it('rejects malformed working settings', () => {
    const bundle = JSON.parse(
      exportBundle({
        working: defaultRequest(),
        builds: [],
        catalog: characterCatalog,
        now,
      }),
    );
    bundle.working.extra = 1;
    const preview = parseImport(JSON.stringify(bundle), characterCatalog);
    expect(preview.ok || preview.error).toContain('working settings');
  });
});

describe('merging imported builds', () => {
  it('skips exact duplicates, re-identifies collisions and never replaces existing builds', () => {
    const existing = [saved('a', 'Mine'), saved('b')];
    const collision = saved('a', 'Theirs');
    let next = 0;
    const result = mergeImported(
      existing,
      [saved('b'), collision, saved('c')],
      () => `new-${next++}`,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({ added: 2, duplicates: 1, reassigned: 1 });
    expect(result.builds.map((b) => [b.id, b.name])).toEqual([
      ['a', 'Mine'],
      ['b', 'Build b'],
      ['new-0', 'Theirs'],
      ['c', 'Build c'],
    ]);
    expect(existing).toHaveLength(2);
  });
  it('compares content independent of object key order', () => {
    const a = saved('a');
    const reordered = JSON.parse(JSON.stringify(a));
    // Same entries, different insertion order.
    a.request.inventory = { [ORB_IDS.attack]: 2, [ORB_IDS.hp]: 1 };
    reordered.request.inventory = { [ORB_IDS.hp]: 1, [ORB_IDS.attack]: 2 };
    expect(Object.keys(a.request.inventory)).not.toEqual(
      Object.keys(reordered.request.inventory),
    );
    const result = mergeImported([a], [reordered], () => 'new');
    expect(result.ok && [result.added, result.duplicates]).toEqual([0, 1]);
  });
  it('keeps identical settings saved under a different ID as a separate build', () => {
    const result = mergeImported(
      [saved('a')],
      [saved('b', 'Build a')],
      () => 'n',
    );
    expect(result.ok && result.builds.map((b) => b.id)).toEqual(['a', 'b']);
  });
  it('plans exactly what the merge does, per imported build', () => {
    const existing = [saved('a', 'Mine')];
    const incoming = [
      saved('a', 'Mine'), // exact duplicate
      saved('a', 'Theirs'), // same ID, different content
      saved('c'), // new
    ];
    const plan = planImport(existing, incoming);
    expect(plan).toEqual({
      actions: ['skip-duplicate', 'add-new-id', 'add'],
      added: 2,
      duplicates: 1,
      reassigned: 1,
      total: 3,
      exceedsLimit: false,
    });
    const merged = mergeImported(existing, incoming, () => 'fresh');
    expect(merged.ok && merged.builds.map((b) => [b.id, b.name])).toEqual([
      ['a', 'Mine'],
      ['fresh', 'Theirs'],
      ['c', 'Build c'],
    ]);
  });
  it('refuses an import that would exceed the limit', () => {
    const existing = Array.from({ length: MAX_SAVED_BUILDS }, (_, i) =>
      saved(String(i)),
    );
    expect(mergeImported(existing, [saved('extra')], () => 'z').ok).toBe(false);
  });
});
