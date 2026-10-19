import {
  SLOTS,
  type Build,
  type BuildRequest,
  type CharacterCatalog,
  type EvaluatorEntry,
  type Skill,
  type Slot,
} from './domain';
import { buildErrors, orbErrors, requestErrors } from './legality';

// Per-slot candidates before inventory checks: empty plus every eligible item.
function slotPools(
  request: BuildRequest,
  catalog: CharacterCatalog,
): Record<Slot, (string | null)[]> {
  return Object.fromEntries(
    SLOTS.map((slot) => [
      slot,
      [
        null,
        ...catalog.orbs
          .filter((orb) => !orbErrors(orb, slot, request, catalog).length)
          .map((orb) => orb.id)
          .sort(),
      ],
    ]),
  ) as Record<Slot, (string | null)[]>;
}

// Counts the generator's search space without enumerating it. Inventory and
// one-copy checks can only remove targets, so this is an upper bound.
export function estimateCandidateSpace(
  request: BuildRequest,
  entry: EvaluatorEntry,
) {
  const catalog = entry.model;
  const errors = requestErrors(request, entry);
  if (errors.length) return null;
  const allocations = request.progression.activatedNodes.reduce(
    (product, id) =>
      product * catalog.profile.nodes.find((n) => n.id === id)!.options.length,
    1,
  );
  const pools = slotPools(request, catalog);
  const options = Object.fromEntries(
    SLOTS.map((slot) => [slot, pools[slot].length]),
  ) as Record<Slot, number>;
  const upperBound =
    allocations * SLOTS.reduce((product, slot) => product * options[slot], 1);
  return {
    allocations,
    slotOptions: options,
    upperBound,
    exceedsLimit: upperBound > request.maxCandidates,
  };
}

// Pure, lazy candidate generation. No scoring/evaluation dependency.
export function* generateBuilds(
  request: BuildRequest,
  entry: EvaluatorEntry,
): Generator<Build> {
  const catalog = entry.model;
  const errors = requestErrors(request, entry);
  if (errors.length) throw new Error(errors.join(' '));
  const nodes = request.progression.activatedNodes.map((id) =>
    catalog.profile.nodes.find((n) => n.id === id)!,
  );
  const pools = slotPools(request, catalog);
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
    for (const bronze of pools.bronze)
      for (const silver of pools.silver)
        for (const gold of pools.gold) {
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
