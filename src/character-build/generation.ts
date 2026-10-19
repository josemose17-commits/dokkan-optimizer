import {
  SLOTS,
  type Build,
  type BuildRequest,
  type CharacterCatalog,
  type Skill,
} from './domain';
import { buildErrors, orbErrors, requestErrors } from './legality';

// Pure, lazy candidate generation. No scoring/evaluation dependency.
export function* generateBuilds(
  request: BuildRequest,
  catalog: CharacterCatalog,
): Generator<Build> {
  const errors = requestErrors(request, catalog);
  if (errors.length) throw new Error(errors.join(' '));
  const nodes = request.progression.activatedNodes.map((id) =>
    catalog.profile.nodes.find((n) => n.id === id)!,
  );
  const pools = SLOTS.map((slot) => [
    null,
    ...catalog.orbs
      .filter((orb) => !orbErrors(orb, slot, request, catalog).length)
      .map((orb) => orb.id)
      .sort(),
  ]);
  function* choices(
    index: number,
    selected: Record<string, Skill>,
  ): Generator<Record<string, Skill>> {
    const node = nodes[index];
    if (!node) {
      yield selected;
      return;
    }
    for (const option of node.options)
      yield* choices(index + 1, { ...selected, [node.id]: option });
  }
  for (const selected of choices(0, {})) {
    for (const bronze of pools[0]!)
      for (const silver of pools[1]!)
        for (const gold of pools[2]!) {
          const build: Build = {
            choices: selected,
            equips: { bronze, silver, gold },
          };
          if (!buildErrors(build, request, catalog).length) yield build;
        }
  }
}

export function buildKey(build: Build): string {
  return JSON.stringify([
    Object.entries(build.choices).sort(([a], [b]) => a.localeCompare(b)),
    SLOTS.map((slot) => build.equips[slot]),
  ]);
}
