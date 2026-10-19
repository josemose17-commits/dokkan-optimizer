import { allocationSpace, attainableAllocations } from './allocation';
import {
  SLOTS,
  type Build,
  type BuildRequest,
  type CharacterCatalog,
  type EvaluatorEntry,
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
  const allocations = allocationSpace(request, entry).count;
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

// Pure, lazy candidate generation: every attainable potential allocation
// combined with every eligible equipment combination. No scoring dependency.
export function* candidateBuilds(
  request: BuildRequest,
  entry: EvaluatorEntry,
): Generator<Build> {
  const catalog = entry.model;
  const errors = requestErrors(request, entry);
  if (errors.length) throw new Error(errors.join(' '));
  const pools = slotPools(request, catalog);
  for (const selected of attainableAllocations(request, entry)) {
    for (const bronze of pools.bronze)
      for (const silver of pools.silver)
        for (const gold of pools.gold) {
          const build: Build = {
            choices: selected,
            equips: { bronze, silver, gold },
          };
          yield build;
        }
  }
}

// Eligibility precedes evaluation. The async search consumes raw candidates so
// rejected combinations also count toward its scan budget and cancellation.
export function* generateBuilds(
  request: BuildRequest,
  entry: EvaluatorEntry,
): Generator<Build> {
  for (const build of candidateBuilds(request, entry))
    if (!buildErrors(build, request, entry.model).length) yield build;
}

export function buildKey(build: Build): string {
  return JSON.stringify([
    Object.entries(build.choices).sort(([a], [b]) => a.localeCompare(b)),
    SLOTS.map((slot) => build.equips[slot]),
  ]);
}
