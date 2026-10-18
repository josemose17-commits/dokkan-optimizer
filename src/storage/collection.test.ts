import { expect, it } from 'vitest';
import { catalog, defaultOwned } from '../data/fixtures/catalog';
import { loadCollection, saveCollection, STORAGE_KEY } from './collection';

function memoryStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}
it('persists edited and empty collections with a versioned envelope', () => {
  const storage = memoryStorage(),
    edited = defaultOwned.slice(0, 6);
  expect(saveCollection(storage, edited)).toBeNull();
  expect(
    loadCollection(storage, catalog.units, defaultOwned).instances,
  ).toEqual(edited);
  saveCollection(storage, []);
  expect(
    loadCollection(storage, catalog.units, defaultOwned).instances,
  ).toEqual([]);
});
it.each([
  'broken JSON',
  JSON.stringify({ version: 99, instances: [] }),
  JSON.stringify({ version: 1, instances: [{ id: 'x', unitId: 'unknown' }] }),
  JSON.stringify({ version: 1, instances: [defaultOwned[0], defaultOwned[0]] }),
])(
  'visibly restores defaults for malformed or incompatible storage: %s',
  (raw) => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    const result = loadCollection(storage, catalog.units, defaultOwned);
    expect(result.instances).toEqual(defaultOwned);
    expect(result.warning).toContain('could not be read');
  },
);
it('warns when storage is unavailable, including read and write exceptions', () => {
  const blocked = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  expect(loadCollection(null, catalog.units, defaultOwned).warning).toContain(
    'unavailable',
  );
  expect(
    loadCollection(blocked, catalog.units, defaultOwned).warning,
  ).toContain('could not be read');
  expect(saveCollection(blocked, defaultOwned)).toContain('unavailable');
});
