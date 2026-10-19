import type { DefinitionDocument, DefinitionLibrary } from './domain';
import { parseLibrary, validateLibrary } from './validation';

export const DEFINITION_KEY = 'dokkan.character-definitions.v1';
export const emptyLibrary = (): DefinitionLibrary => ({
  schemaVersion: 1,
  documents: [],
});
export type Store = Pick<Storage, 'getItem' | 'setItem'>;
export type Loaded = {
  library: DefinitionLibrary;
  raw: string | null;
  problem: string | null;
  writable: boolean;
};

export function loadDefinitions(store: Store): Loaded {
  try {
    const raw = store.getItem(DEFINITION_KEY);
    if (raw === null)
      return { library: emptyLibrary(), raw, problem: null, writable: true };
    const result = parseLibrary(raw);
    return result.ok
      ? { library: result.library, raw, problem: null, writable: true }
      : {
          library: emptyLibrary(),
          raw,
          problem:
            'Stored definitions could not be read. The original data is preserved. Export a recovery copy; use another browser profile for new saves until it is recovered.',
          writable: false,
        };
  } catch {
    return {
      library: emptyLibrary(),
      raw: null,
      problem:
        'Local storage is blocked. Editing, comparison and file export still work in this session.',
      writable: false,
    };
  }
}
export function writeDefinitions(
  store: Store,
  previousRaw: string | null,
  library: DefinitionLibrary,
): { ok: true; raw: string } | { ok: false; problem: string } {
  if (previousRaw !== null && !parseLibrary(previousRaw).ok)
    return {
      ok: false,
      problem:
        'Unreadable or newer stored definitions are preserved. Recover or export them before writing.',
    };
  const raw = JSON.stringify(library);
  const checked = parseLibrary(raw);
  if (!checked.ok) return { ok: false, problem: checked.errors.join(' ') };
  try {
    if (store.getItem(DEFINITION_KEY) !== previousRaw)
      return {
        ok: false,
        problem:
          'Definitions changed in another tab. Export your draft and reload before saving; nothing was overwritten.',
      };
    store.setItem(DEFINITION_KEY, raw);
    return { ok: true, raw };
  } catch {
    return {
      ok: false,
      problem: 'Definitions could not be stored. Export your draft to keep it.',
    };
  }
}
export function latestDocuments(
  library: DefinitionLibrary,
): DefinitionDocument[] {
  const latest = new Map<string, DefinitionDocument>();
  for (const doc of library.documents)
    if (
      (latest.get(doc.definition.id)?.definition.revision ?? 0) <
      doc.definition.revision
    )
      latest.set(doc.definition.id, doc);
  return [...latest.values()];
}
export function appendRevision(
  library: DefinitionLibrary,
  draft: DefinitionDocument,
): DefinitionLibrary {
  const copy = structuredClone(draft);
  copy.definition.revision =
    1 +
    Math.max(
      0,
      ...library.documents
        .filter((d) => d.definition.id === copy.definition.id)
        .map((d) => d.definition.revision),
    );
  return { schemaVersion: 1, documents: [...library.documents, copy] };
}
export function duplicateDocument(
  document: DefinitionDocument,
  stateId: string,
  cardId: string,
): DefinitionDocument {
  const copy = structuredClone(document);
  copy.definition.id = stateId;
  copy.definition.cardId = cardId;
  copy.definition.revision = 1;
  copy.definition.name += ' (copy)';
  copy.definition.notes = `User-authored copy. ${copy.definition.notes}`.trim();
  return copy;
}
const canonical = (value: unknown): string =>
  JSON.stringify(
    value && typeof value === 'object'
      ? Array.isArray(value)
        ? value.map((x) => JSON.parse(canonical(x)))
        : Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, JSON.parse(canonical(v))]),
          )
      : value,
  );
export interface ImportPlan {
  library: DefinitionLibrary;
  added: string[];
  skipped: string[];
  copied: string[];
  errors: string[];
}
export function planImport(
  current: DefinitionLibrary,
  incoming: DefinitionLibrary,
  conflicts: 'skip' | 'copy',
  makeId: () => string,
): ImportPlan {
  const result: ImportPlan = {
    library: structuredClone(current),
    added: [],
    skipped: [],
    copied: [],
    errors: [],
  };
  const existing = new Map(
    current.documents.map((d) => [
      `${d.definition.id}@${d.definition.revision}`,
      d,
    ]),
  );
  const existingIds = new Set(current.documents.map((d) => d.definition.id));
  const remap = new Map<string, string>(),
    cardRemap = new Map<string, string>();
  const conflictsFound = new Set(
    incoming.documents
      .filter(
        (d) =>
          existingIds.has(d.definition.id) &&
          (!existing.has(`${d.definition.id}@${d.definition.revision}`) ||
            canonical(
              existing.get(`${d.definition.id}@${d.definition.revision}`),
            ) !== canonical(d)),
      )
      .map((d) => d.definition.id),
  );
  for (const id of conflictsFound)
    if (conflicts === 'copy') remap.set(id, makeId());
  for (const doc of incoming.documents)
    if (remap.has(doc.definition.id) && !cardRemap.has(doc.definition.cardId))
      cardRemap.set(doc.definition.cardId, makeId());
  for (const doc of incoming.documents) {
    const key = `${doc.definition.id}@${doc.definition.revision}`;
    if (conflictsFound.has(doc.definition.id) && conflicts === 'skip') {
      result.skipped.push(`${doc.definition.name} · ${key} (ID conflict)`);
      continue;
    }
    if (!remap.has(doc.definition.id) && existing.has(key)) {
      result.skipped.push(`${doc.definition.name} · ${key} (identical)`);
      continue;
    }
    const copy = structuredClone(doc);
    if (remap.has(doc.definition.id)) {
      copy.definition.id = remap.get(doc.definition.id)!;
      result.copied.push(
        `${key} → ${copy.definition.id}@${copy.definition.revision}`,
      );
    }
    if (cardRemap.has(doc.definition.cardId))
      copy.definition.cardId = cardRemap.get(doc.definition.cardId)!;
    copy.definition.relations.forEach((r) => {
      if (remap.has(r.targetId)) r.targetId = remap.get(r.targetId)!;
      else if (conflictsFound.has(r.targetId))
        result.errors.push(
          `Relationship in ${key} refers to a skipped conflicting state. Choose copy to preserve its meaning.`,
        );
    });
    result.library.documents.push(copy);
    result.added.push(
      `${copy.definition.name} · ${copy.definition.id}@${copy.definition.revision}`,
    );
  }
  const checked = validateLibrary(result.library);
  if (!checked.ok) result.errors.push(...checked.errors);
  return result;
}
