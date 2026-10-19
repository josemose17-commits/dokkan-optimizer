import type { BuildRequest, EvaluatorEntry } from './domain';
import { requestErrors } from './legality';
import { parseBuildRequest } from './library';
import { WORKING_SETTINGS_KEY } from './registry';

// The original Goku entry's key (unchanged contract). Other entries use the
// key their registry entry declares, so characters never share settings.
export const CHARACTER_STORAGE_KEY = WORKING_SETTINGS_KEY;
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

export function loadCharacterState(
  storage: StoragePort | null,
  entry: EvaluatorEntry,
) {
  const catalog = entry.model;
  const defaults = entry.defaults();
  // `raw` is returned only when stored data exists but cannot be used, so the
  // page can offer a copy before an explicit edit replaces it.
  let raw: string | null = null;
  const fallback = (warning: string | null) => ({
    state: structuredClone(defaults),
    warning,
    raw,
  });
  if (!storage)
    return fallback(
      'Local storage is unavailable; changes last for this session.',
    );
  try {
    raw = storage.getItem(entry.storageKey);
    if (raw === null) return fallback(null);
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('version' in parsed) ||
      parsed.version !== 1 ||
      !('catalogRevision' in parsed) ||
      parsed.catalogRevision !== catalog.revision ||
      !('request' in parsed)
    )
      throw new Error('Unknown saved schema/catalog.');
    // Structural parse first, then the same legality checks as any request.
    const request = parseBuildRequest(parsed.request);
    if (!request || requestErrors(request, entry).length)
      throw new Error('Invalid saved build.');
    return { state: request, warning: null, raw: null };
  } catch {
    return fallback(
      'Saved character settings could not be read or use a different catalog. Defaults are shown. The stored copy is kept until you edit a control; editing replaces it, so download it first if you need it.',
    );
  }
}

export const INVALID_SETTINGS_NOTICE =
  'Not saved: fix the highlighted input. Your last valid settings remain stored.';

export function saveCharacterState(
  storage: StoragePort | null,
  request: BuildRequest,
  entry: EvaluatorEntry,
) {
  // Invalid input is a different problem from blocked storage; report it as such.
  if (requestErrors(request, entry).length) return INVALID_SETTINGS_NOTICE;
  try {
    if (!storage) throw new Error('Unavailable');
    storage.setItem(
      entry.storageKey,
      JSON.stringify({
        version: 1,
        catalogRevision: entry.model.revision,
        request,
      }),
    );
    return null;
  } catch {
    return 'Character settings could not be saved; changes last for this session.';
  }
}
