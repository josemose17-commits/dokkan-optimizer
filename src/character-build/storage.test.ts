import { expect, it } from 'vitest';
import { gokuEntry } from '../data/real/character-build/registry';
import {
  characterCatalog,
  defaultRequest,
  ORB_IDS,
} from '../data/real/character-build/goku';
import {
  CHARACTER_STORAGE_KEY,
  loadCharacterState,
  saveCharacterState,
} from './storage';

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
it('round trips current build, inventory, objective and context separately from legacy storage', () => {
  const storage = memory();
  storage.values.set('dokkan-team-lab.collection.v1', 'legacy-owned');
  const request = defaultRequest();
  request.current.equips.silver = ORB_IDS.critical;
  request.inventory[ORB_IDS.attack] = 2;
  request.context.evasionAllowed = false;
  request.objective = 'attack';
  expect(saveCharacterState(storage, request, gokuEntry)).toBeNull();
  expect(loadCharacterState(storage, gokuEntry).state).toEqual(request);
  expect(storage.values.get('dokkan-team-lab.collection.v1')).toBe(
    'legacy-owned',
  );
});
it.each([
  'invalid-json',
  '{}',
  '{"version":999}',
  '{"version":1,"catalogRevision":"old","request":{}}',
])('warns and preserves invalid/unknown saved data %s', (raw) => {
  const storage = memory();
  storage.values.set(CHARACTER_STORAGE_KEY, raw);
  const loaded = loadCharacterState(storage, gokuEntry);
  expect(loaded.warning).toContain('could not be read');
  // The unusable copy is offered for download and left in storage.
  expect(loaded.raw).toBe(raw);
  expect(storage.values.get(CHARACTER_STORAGE_KEY)).toBe(raw);
});
it('rejects a malformed object even with the correct schema revision', () => {
  const storage = memory();
  storage.values.set(
    CHARACTER_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      catalogRevision: characterCatalog.revision,
      request: { current: null },
    }),
  );
  expect(loadCharacterState(storage, gokuEntry).warning).not.toBeNull();
});
it('handles unavailable and throwing storage', () => {
  const broken = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('quota');
    },
  };
  expect(loadCharacterState(null, gokuEntry).warning).not.toBeNull();
  expect(loadCharacterState(broken, gokuEntry).warning).not.toBeNull();
  expect(
    saveCharacterState(broken, defaultRequest(), gokuEntry),
  ).not.toBeNull();
});
it('does not save invalid progression', () => {
  const storage = memory();
  const request = defaultRequest();
  request.progression.routes = ['bottomRight'];
  expect(saveCharacterState(storage, request, gokuEntry)).not.toBeNull();
  expect(storage.values.has(CHARACTER_STORAGE_KEY)).toBe(false);
});
it('offers no stored copy when nothing was saved, storage is blocked or the data loads', () => {
  expect(loadCharacterState(memory(), gokuEntry).raw).toBeNull();
  const blocked = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => undefined,
  };
  expect(loadCharacterState(blocked, gokuEntry).raw).toBeNull();
  const storage = memory();
  saveCharacterState(storage, defaultRequest(), gokuEntry);
  expect(loadCharacterState(storage, gokuEntry).raw).toBeNull();
});
