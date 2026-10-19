import type { BuildRequest, EvaluatorEntry } from './domain';
import { entryForState } from './registry';
import { requestErrors } from './legality';

// Named saved builds and JSON backups. Separate from the working settings key
// (dokkan.character-builds.v1), whose contract is unchanged.
export const LIBRARY_STORAGE_KEY = 'dokkan.character-library.v1';
export const EXPORT_FORMAT = 'dokkan-optimizer.character-builds';
export const MAX_SAVED_BUILDS = 100;
export const MAX_IMPORT_BYTES = 1024 * 1024;
export const MAX_NAME_LENGTH = 80;
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

export interface SavedBuild {
  id: string;
  name: string;
  savedAt: string;
  catalogRevision: string;
  evaluatorVersion: string;
  request: BuildRequest;
}
export type BuildStatus =
  | { kind: 'ready'; reason: null }
  | { kind: 'stale' | 'invalid' | 'unsupported'; reason: string };

type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exactKeys = (v: Obj, keys: string[]) =>
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
const text = (v: unknown, max = 200): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;
const int = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v);
const unsafeKey = (k: string) =>
  k === '__proto__' || k === 'constructor' || k === 'prototype';
const textList = (v: unknown, max: number): v is string[] =>
  Array.isArray(v) && v.length <= max && v.every((s) => text(s));
const isoDateTime = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length <= 40 &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
function record<T>(
  v: unknown,
  max: number,
  valid: (value: unknown) => value is T,
): Record<string, T> | null {
  if (!object(v) || Object.keys(v).length > max) return null;
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(v)) {
    if (!text(key) || unsafeKey(key) || !valid(value)) return null;
    out[key] = value;
  }
  return out;
}

/**
 * Structural parse of untrusted saved/imported settings into a fresh object.
 * Legality (exact state, catalog items, context) is checked separately by
 * requestErrors; this only guarantees the expected shape and primitive types.
 */
export function parseBuildRequest(v: unknown): BuildRequest | null {
  if (
    !object(v) ||
    !exactKeys(v, [
      'cardStateId',
      'level',
      'superAttackLevel',
      'progression',
      'current',
      'inventory',
      'mode',
      'context',
      'objective',
      'frontierMetrics',
      'maxCandidates',
    ])
  )
    return null;
  const { progression: p, current: c, context: x } = v;
  if (
    !object(p) ||
    !exactKeys(p, [
      'profileId',
      'systemUnlocked',
      'routes',
      'activatedNodes',
    ]) ||
    !text(p.profileId) ||
    typeof p.systemUnlocked !== 'boolean' ||
    !textList(p.routes, 8) ||
    !textList(p.activatedNodes, 64) ||
    !object(c) ||
    !exactKeys(c, ['choices', 'equips']) ||
    !object(c.equips) ||
    !exactKeys(c.equips, ['bronze', 'silver', 'gold']) ||
    !object(x) ||
    !exactKeys(x, [
      'id',
      'battleTurn',
      'appearance',
      'initialAttack',
      'externalEffects',
      'evasionAllowed',
    ]) ||
    !text(v.cardStateId) ||
    !int(v.level) ||
    !int(v.superAttackLevel) ||
    !text(v.mode) ||
    !text(v.objective) ||
    !textList(v.frontierMetrics, 16) ||
    !int(v.maxCandidates)
  )
    return null;
  const equips = c.equips;
  const slot = (s: unknown) => s === null || text(s);
  const choices = record(c.choices, 64, (s): s is string => text(s));
  const inventory = record(v.inventory, 500, int);
  if (
    !choices ||
    !inventory ||
    !slot(equips.bronze) ||
    !slot(equips.silver) ||
    !slot(equips.gold) ||
    !text(x.id) ||
    !int(x.battleTurn) ||
    !int(x.appearance) ||
    !text(x.initialAttack) ||
    !text(x.externalEffects) ||
    typeof x.evasionAllowed !== 'boolean'
  )
    return null;
  // Casts narrow literal unions; requestErrors rejects unsupported values.
  return {
    cardStateId: v.cardStateId,
    level: v.level,
    superAttackLevel: v.superAttackLevel,
    progression: {
      profileId: p.profileId,
      systemUnlocked: p.systemUnlocked,
      routes: [...p.routes],
      activatedNodes: [...p.activatedNodes],
    } as BuildRequest['progression'],
    current: {
      choices,
      equips: {
        bronze: equips.bronze as string | null,
        silver: equips.silver as string | null,
        gold: equips.gold as string | null,
      },
    } as BuildRequest['current'],
    inventory,
    mode: v.mode,
    context: {
      id: x.id,
      battleTurn: x.battleTurn,
      appearance: x.appearance,
      initialAttack: x.initialAttack,
      externalEffects: x.externalEffects,
      evasionAllowed: x.evasionAllowed,
    } as BuildRequest['context'],
    objective: v.objective,
    frontierMetrics: [...v.frontierMetrics],
    maxCandidates: v.maxCandidates,
  } as BuildRequest;
}

function parseSavedBuild(v: unknown): SavedBuild | null {
  if (
    !object(v) ||
    !exactKeys(v, [
      'id',
      'name',
      'savedAt',
      'catalogRevision',
      'evaluatorVersion',
      'request',
    ]) ||
    !text(v.id, 100) ||
    !text(v.name, MAX_NAME_LENGTH) ||
    !v.name.trim() ||
    !isoDateTime(v.savedAt) ||
    !text(v.catalogRevision) ||
    !text(v.evaluatorVersion)
  )
    return null;
  const request = parseBuildRequest(v.request);
  return request
    ? {
        id: v.id,
        name: v.name,
        savedAt: v.savedAt,
        catalogRevision: v.catalogRevision,
        evaluatorVersion: v.evaluatorVersion,
        request,
      }
    : null;
}

/**
 * Saved inputs, not results. A build is loadable only by the evaluator bound
 * to its exact state, with the same data revision and evaluator ID; anything
 * else is kept and labeled, never evaluated against other data.
 * `available` lists the evaluators this app can open (registry entries that
 * resolve against the catalog).
 */
export function buildStatus(
  build: SavedBuild,
  available: readonly EvaluatorEntry[],
): BuildStatus {
  const entry = entryForState(available, build.request.cardStateId);
  if (!entry)
    return {
      kind: 'unsupported',
      reason: `No evaluator in this app is bound to state ${build.request.cardStateId}. Retained but not loadable; no other character is substituted.`,
    };
  if (build.catalogRevision !== entry.model.revision)
    return {
      kind: 'stale',
      reason: `Saved against catalog ${build.catalogRevision}; this app uses ${entry.model.revision}. Retained but not loadable; no substitution is made.`,
    };
  if (build.evaluatorVersion !== entry.id)
    return {
      kind: 'stale',
      reason: `Saved for evaluator ${build.evaluatorVersion}; this state now uses ${entry.id}. Retained but not loadable; results could differ.`,
    };
  const errors = requestErrors(build.request, entry);
  return errors.length
    ? { kind: 'invalid', reason: errors.join(' ') }
    : { kind: 'ready', reason: null };
}

export function createSavedBuild(input: {
  id: string;
  name: string;
  now: Date;
  request: BuildRequest;
  entry: EvaluatorEntry;
}): { build: SavedBuild; error: null } | { build: null; error: string } {
  const name = input.name.trim();
  if (!name || name.length > MAX_NAME_LENGTH)
    return {
      build: null,
      error: `Enter a name of 1–${MAX_NAME_LENGTH} characters.`,
    };
  if (requestErrors(input.request, input.entry).length)
    return {
      build: null,
      error: 'Only valid settings can be saved. Fix the highlighted inputs.',
    };
  return {
    build: {
      id: input.id,
      name,
      savedAt: input.now.toISOString(),
      catalogRevision: input.entry.model.revision,
      evaluatorVersion: input.entry.id,
      request: structuredClone(input.request),
    },
    error: null,
  };
}

export type LibraryState = {
  builds: SavedBuild[];
  status: 'empty' | 'ok' | 'unavailable' | 'unreadable' | 'newer';
  // False when existing stored data is unreadable or newer: never overwrite it
  // without an explicit replacement.
  writable: boolean;
  raw: string | null;
  warning: string | null;
};

export function loadLibrary(storage: StoragePort | null): LibraryState {
  if (!storage)
    return {
      builds: [],
      status: 'unavailable',
      writable: false,
      raw: null,
      warning:
        'Local storage is unavailable. Saved builds cannot be kept; use JSON export for backups.',
    };
  let raw: string | null;
  try {
    raw = storage.getItem(LIBRARY_STORAGE_KEY);
  } catch {
    return {
      builds: [],
      status: 'unavailable',
      writable: false,
      raw: null,
      warning:
        'Local storage is blocked. Saved builds cannot be read or kept; use JSON export for backups.',
    };
  }
  if (raw === null)
    return { builds: [], status: 'empty', writable: true, raw, warning: null };
  const unreadable = (status: 'unreadable' | 'newer', warning: string) => ({
    builds: [],
    status,
    writable: false,
    raw,
    warning,
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return unreadable(
      'unreadable',
      'Saved builds could not be read. They were left untouched; download a copy before replacing them.',
    );
  }
  if (object(parsed) && int(parsed.version) && parsed.version > 1)
    return unreadable(
      'newer',
      'Saved builds use a newer format than this app supports. They were left untouched.',
    );
  if (
    !object(parsed) ||
    !exactKeys(parsed, ['version', 'builds']) ||
    parsed.version !== 1 ||
    !Array.isArray(parsed.builds) ||
    parsed.builds.length > MAX_SAVED_BUILDS
  )
    return unreadable(
      'unreadable',
      'Saved builds could not be read. They were left untouched; download a copy before replacing them.',
    );
  const builds = parsed.builds.map(parseSavedBuild);
  // One unreadable entry blocks writes; silently dropping it would lose data.
  if (
    builds.some((b) => b === null) ||
    new Set(builds.map((b) => b!.id)).size !== builds.length
  )
    return unreadable(
      'unreadable',
      'One or more saved builds are malformed or duplicated. Nothing was changed; download a copy before replacing them.',
    );
  return {
    builds: builds as SavedBuild[],
    status: 'ok',
    writable: true,
    raw,
    warning: null,
  };
}

export function saveLibrary(
  storage: StoragePort | null,
  builds: SavedBuild[],
): string | null {
  if (builds.length > MAX_SAVED_BUILDS)
    return `At most ${MAX_SAVED_BUILDS} saved builds are kept. Delete some first.`;
  try {
    if (!storage) throw new Error('Unavailable');
    storage.setItem(
      LIBRARY_STORAGE_KEY,
      JSON.stringify({ version: 1, builds }),
    );
    return null;
  } catch {
    return 'Saved builds could not be written (storage blocked or full). Nothing was changed; export a JSON backup instead.';
  }
}

// The top-level revision and evaluator describe the working settings, which
// belong to the open entry; each saved build carries its own.
export function exportBundle(input: {
  working: BuildRequest | null;
  builds: SavedBuild[];
  entry: EvaluatorEntry;
  now: Date;
}): string {
  return `${JSON.stringify(
    {
      format: EXPORT_FORMAT,
      version: 1,
      exportedAt: input.now.toISOString(),
      catalogRevision: input.entry.model.revision,
      evaluatorVersion: input.entry.id,
      working: input.working,
      builds: input.builds,
    },
    null,
    2,
  )}\n`;
}

export type ImportPreview =
  | {
      ok: true;
      exportedAt: string;
      catalogRevision: string;
      working: { request: BuildRequest; status: BuildStatus } | null;
      builds: { build: SavedBuild; status: BuildStatus }[];
      rejected: number;
    }
  | { ok: false; error: string };

/** Imported files are untrusted: bounded, parsed as data only, never executed. */
export function parseImport(
  textContent: string,
  available: readonly EvaluatorEntry[],
): ImportPreview {
  if (new TextEncoder().encode(textContent).length > MAX_IMPORT_BYTES)
    return { ok: false, error: 'File exceeds the 1 MiB import limit.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(textContent);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  if (!object(parsed) || parsed.format !== EXPORT_FORMAT)
    return {
      ok: false,
      error: 'This is not a Dokkan character-build export.',
    };
  if (int(parsed.version) && parsed.version > 1)
    return {
      ok: false,
      error:
        'The export uses a newer format than this app supports. Nothing was imported.',
    };
  if (
    !exactKeys(parsed, [
      'format',
      'version',
      'exportedAt',
      'catalogRevision',
      'evaluatorVersion',
      'working',
      'builds',
    ]) ||
    parsed.version !== 1 ||
    !isoDateTime(parsed.exportedAt) ||
    !text(parsed.catalogRevision) ||
    !text(parsed.evaluatorVersion) ||
    !Array.isArray(parsed.builds) ||
    parsed.builds.length > MAX_SAVED_BUILDS
  )
    return {
      ok: false,
      error: `Unsupported or malformed export (version 1 with at most ${MAX_SAVED_BUILDS} builds is supported).`,
    };
  let working: { request: BuildRequest; status: BuildStatus } | null = null;
  if (parsed.working !== null) {
    const request = parseBuildRequest(parsed.working);
    if (!request)
      return {
        ok: false,
        error: 'The exported working settings are malformed.',
      };
    // Working settings carry the bundle's revision.
    working = {
      request,
      status: buildStatus(
        {
          id: 'working',
          name: 'Working settings',
          savedAt: parsed.exportedAt,
          catalogRevision: parsed.catalogRevision,
          evaluatorVersion: parsed.evaluatorVersion,
          request,
        },
        available,
      ),
    };
  }
  const builds = parsed.builds.map(parseSavedBuild);
  return {
    ok: true,
    exportedAt: parsed.exportedAt,
    catalogRevision: parsed.catalogRevision,
    working,
    builds: builds
      .filter((b): b is SavedBuild => b !== null)
      .map((build) => ({ build, status: buildStatus(build, available) })),
    rejected: builds.filter((b) => b === null).length,
  };
}

// Content comparison independent of object key order (arrays stay ordered).
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    object(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : v,
  );
}

export type ImportAction = 'add' | 'add-new-id' | 'skip-duplicate';

/**
 * Identity rule for saved builds: a build is identified by its `id`. An
 * imported build is an exact duplicate only when a build with the same `id`
 * has identical content (name, time, revisions and settings; object key order
 * ignored). The same `id` with different content is a conflict: the imported
 * build is kept under a new ID. A different `id` is always a separate build,
 * even with identical settings. Existing builds are never replaced.
 */
export function planImport(existing: SavedBuild[], imported: SavedBuild[]) {
  const seen = new Map(existing.map((b) => [b.id, canonical(b)]));
  const actions: ImportAction[] = imported.map((build) => {
    const content = canonical(build);
    const known = seen.get(build.id);
    if (known === content) return 'skip-duplicate';
    if (known === undefined) {
      seen.set(build.id, content);
      return 'add';
    }
    return 'add-new-id';
  });
  const count = (action: ImportAction) =>
    actions.filter((a) => a === action).length;
  const added = count('add') + count('add-new-id');
  return {
    actions,
    added,
    duplicates: count('skip-duplicate'),
    reassigned: count('add-new-id'),
    total: existing.length + added,
    exceedsLimit: existing.length + added > MAX_SAVED_BUILDS,
  };
}

/** Applies planImport; the preview and the merge therefore always agree. */
export function mergeImported(
  existing: SavedBuild[],
  imported: SavedBuild[],
  newId: () => string,
):
  | {
      ok: true;
      builds: SavedBuild[];
      added: number;
      duplicates: number;
      reassigned: number;
    }
  | { ok: false; error: string } {
  const plan = planImport(existing, imported);
  if (plan.exceedsLimit)
    return {
      ok: false,
      error: `Import would exceed ${MAX_SAVED_BUILDS} saved builds. Nothing was added.`,
    };
  const builds = [...existing];
  const ids = new Set(existing.map((b) => b.id));
  imported.forEach((build, i) => {
    const action = plan.actions[i]!;
    if (action === 'skip-duplicate') return;
    let id = build.id;
    if (action === 'add-new-id') {
      do id = newId();
      while (ids.has(id) || imported.some((b) => b.id === id));
    }
    ids.add(id);
    builds.push({ ...structuredClone(build), id });
  });
  return {
    ok: true,
    builds,
    added: plan.added,
    duplicates: plan.duplicates,
    reassigned: plan.reassigned,
  };
}
