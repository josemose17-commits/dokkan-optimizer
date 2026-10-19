import type { BuildRequest, CharacterCatalog } from './domain';
import { requestErrors } from './legality';
import { parseBuildRequest } from './library';

export const CHARACTER_STORAGE_KEY = 'dokkan.character-builds.v1';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

export function loadCharacterState(
  storage: StoragePort | null,
  defaults: BuildRequest,
  catalog: CharacterCatalog,
) {
  const fallback = (warning: string | null) => ({
    state: structuredClone(defaults),
    warning,
  });
  if (!storage)
    return fallback(
      'Local storage is unavailable; changes last for this session.',
    );
  try {
    const raw = storage.getItem(CHARACTER_STORAGE_KEY);
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
    if (!request || requestErrors(request, catalog).length)
      throw new Error('Invalid saved build.');
    return { state: request, warning: null };
  } catch {
    return fallback(
      'Saved character settings could not be read or use a different catalog. Defaults are shown; saved data is not replaced until you edit a control.',
    );
  }
}

export const INVALID_SETTINGS_NOTICE =
  'Not saved: fix the highlighted input. Your last valid settings remain stored.';

export function saveCharacterState(
  storage: StoragePort | null,
  request: BuildRequest,
  catalog: CharacterCatalog,
) {
  // Invalid input is a different problem from blocked storage; report it as such.
  if (requestErrors(request, catalog).length) return INVALID_SETTINGS_NOTICE;
  try {
    if (!storage) throw new Error('Unavailable');
    storage.setItem(
      CHARACTER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        catalogRevision: catalog.revision,
        request,
      }),
    );
    return null;
  } catch {
    return 'Character settings could not be saved; changes last for this session.';
  }
}
