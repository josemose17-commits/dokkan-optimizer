// TEST ONLY: arithmetic inputs, not Dokkan cards, equipment or game formulas.
import {
  emptyConfiguration,
  newDocument,
  newEffect,
  userSource,
  type DefinitionDocument,
  type Effect,
  type Equipment,
} from './domain';
export function example(): DefinitionDocument {
  const doc = newDocument('test:state', 'test:card', 'test:current');
  doc.definition.name = 'TEST ONLY arithmetic character';
  doc.definition.type = 'AGL';
  doc.definition.rarity = 'UR';
  doc.definition.superAttackLevel = 10;
  doc.definition.rawStats = { hp: 100, attack: 200, defense: 300 };
  doc.definition.categories = ['Test category'];
  const build = doc.configurations[0]!;
  build.potentialStats = { hp: 10, attack: 20, defense: 30 };
  build.skills = { additional: 3, critical: 4, evasion: 5 };
  build.unlockedRoutes = 0;
  build.slots = { bronze: 'available', silver: 'unknown', gold: 'unavailable' };
  return doc;
}
export function withEffect(
  doc: DefinitionDocument,
  patch: Partial<Effect> = {},
): Effect {
  const effect = {
    ...newEffect(`test:effect-${doc.definition.abilities.length}`),
    amount: 7,
    ...patch,
  };
  doc.definition.abilities.push({
    id: `test:ability-${doc.definition.abilities.length}`,
    name: 'TEST ONLY ability',
    kind: 'passive',
    wording: 'Arithmetic example only.',
    effects: [effect],
  });
  return effect;
}
export function equipment(): Equipment {
  return {
    id: 'test:equip',
    name: 'TEST ONLY equip',
    slot: 'bronze',
    stats: { hp: 1, attack: 2, defense: 3 },
    skills: { additional: 1, critical: 0, evasion: 0 },
    requirements: [{ kind: 'type', value: 'AGL' }],
    otherEffects: '',
    source: userSource('test equip'),
  };
}
export const alternative = (
  doc: DefinitionDocument,
  id = 'test:alternative',
) => {
  const b = structuredClone(doc.configurations[0]!);
  b.id = id;
  b.name = id;
  doc.configurations.push(b);
  return b;
};
export const unknownBuild = () =>
  emptyConfiguration('test:unknown', 'TEST ONLY unknown');
