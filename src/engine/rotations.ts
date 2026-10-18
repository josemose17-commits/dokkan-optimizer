import type { RotationLayout } from '../domain/types';

/** All 105 unordered two-pair/three-floater partitions of seven distinct slots. */
export function enumerateRotations(participantIds: string[]): RotationLayout[] {
  if (participantIds.length !== 7 || new Set(participantIds).size !== 7)
    throw new Error('Rotations require seven distinct participant IDs.');
  const ids = [...participantIds].sort();
  const pairs: [string, string][] = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i]!, ids[j]!]);
  const layouts: RotationLayout[] = [];
  for (let a = 0; a < pairs.length; a++)
    for (let b = a + 1; b < pairs.length; b++) {
      const first = pairs[a]!,
        second = pairs[b]!;
      const fixed = new Set([...first, ...second]);
      if (fixed.size !== 4) continue;
      const floaters = ids.filter((id) => !fixed.has(id)) as [
        string,
        string,
        string,
      ];
      layouts.push({ pairs: [first, second], floaters });
    }
  return layouts;
}
