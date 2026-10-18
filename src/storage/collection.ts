import type { OwnedInstance, Unit } from '../domain/types';

export const STORAGE_KEY = 'dokkan-team-lab.collection.v1';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

export function loadCollection(
  storage: StoragePort | null,
  units: Unit[],
  defaults: OwnedInstance[],
) {
  const fallback = (warning: string | null) => ({
    instances: defaults.map((instance) => ({ ...instance })),
    warning,
  });
  if (!storage)
    return fallback(
      'Local storage is unavailable. Changes will last only for this session.',
    );
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return fallback(null);
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== 'object' ||
      !('version' in value) ||
      value.version !== 1 ||
      !('instances' in value) ||
      !Array.isArray(value.instances)
    )
      throw new Error('Unsupported collection format.');
    const instances: OwnedInstance[] = value.instances.map((row: unknown) => {
      if (
        !row ||
        typeof row !== 'object' ||
        !('id' in row) ||
        typeof row.id !== 'string' ||
        !row.id ||
        !('unitId' in row) ||
        typeof row.unitId !== 'string' ||
        !units.some((unit) => unit.id === row.unitId)
      )
        throw new Error('Unknown collection entry.');
      return { id: row.id, unitId: row.unitId };
    });
    if (
      new Set(instances.map((i) => i.id)).size !== instances.length ||
      new Set(instances.map((i) => i.unitId)).size !== instances.length
    )
      throw new Error('Duplicate collection entries.');
    return { instances, warning: null };
  } catch {
    return fallback(
      'Saved collection could not be read. The demo collection was restored.',
    );
  }
}

export function saveCollection(
  storage: StoragePort | null,
  instances: OwnedInstance[],
): string | null {
  try {
    if (!storage) throw new Error('Unavailable');
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, instances }));
    return null;
  } catch {
    return 'Local storage is unavailable. Changes will last only for this session.';
  }
}

export function browserStorage(): StoragePort | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
