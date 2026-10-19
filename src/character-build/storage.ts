import type { BuildRequest, CharacterCatalog } from './domain';
import { requestErrors } from './legality';

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
    const request = parsed.request as BuildRequest;
    // Deep structural errors also fail closed through this guarded validator.
    if (requestErrors(request, catalog).length)
      throw new Error('Invalid saved build.');
    return { state: request, warning: null };
  } catch {
    return fallback(
      'Saved character settings could not be read or use a different catalog. Defaults are shown; saved data is not replaced until you edit a control.',
    );
  }
}

export function saveCharacterState(
  storage: StoragePort | null,
  request: BuildRequest,
  catalog: CharacterCatalog,
) {
  try {
    if (!storage || requestErrors(request, catalog).length)
      throw new Error('Unavailable/invalid');
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
