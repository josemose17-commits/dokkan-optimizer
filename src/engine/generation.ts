import type { OwnedInstance } from '../domain/types';

export function combinationCount(n: number, k: number): number {
  if (n < k || k < 0) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - i + 1)) / i;
  return Math.round(result);
}

/** Pure reference generator; no scoring, catalog, React, or browser dependencies. */
export function generateCandidates(
  owned: OwnedInstance[],
  leaderId: string,
  limit: number,
) {
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error('Candidate limit must be a positive integer.');
  if (new Set(owned.map((instance) => instance.id)).size !== owned.length)
    throw new Error('Duplicate owned instance IDs.');
  if (!owned.some((instance) => instance.id === leaderId))
    throw new Error('Selected leader must be owned.');
  const rest = owned
    .map((instance) => instance.id)
    .filter((id) => id !== leaderId)
    .sort();
  const possible = combinationCount(rest.length, 5);
  const candidates: string[][] = [];
  const visit = (start: number, chosen: string[]) => {
    if (candidates.length >= limit) return;
    if (chosen.length === 5) {
      candidates.push([leaderId, ...chosen]);
      return;
    }
    for (let i = start; i <= rest.length - (5 - chosen.length); i++) {
      visit(i + 1, [...chosen, rest[i]!]);
      if (candidates.length >= limit) return;
    }
  };
  visit(0, []);
  return { candidates, possible, truncated: candidates.length < possible };
}
