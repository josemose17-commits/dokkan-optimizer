import { describe, expect, it } from 'vitest';
import type { BuildRequest } from '../character-build/domain';
import { compareBuilds } from '../character-build/comparison';
import { explainGroup } from '../character-build/explanation';
import { fixtureNodeEntry } from '../character-build/registry.fixtures';
import { gokuEntry } from '../data/real/character-build/registry';
import { ORB_IDS } from '../data/real/character-build/goku';
import { changeList, improvementText, whyLines } from './result';

// Expected strings are written out by hand from the documented numbers:
// card ATK 11,111, profile +2,800 each stat, native Additional Attack 5,
// +500 bronze stat items and +2 silver skill items.
const request = (patch: Partial<BuildRequest>): BuildRequest => ({
  ...gokuEntry.defaults(),
  ...patch,
});
function explainBest(r: BuildRequest) {
  const result = compareBuilds(r, gokuEntry);
  const best = result.groups[0]!;
  return explainGroup(result, r, gokuEntry, best.id, 0)!;
}

describe('result text is computed, with units', () => {
  it('states baseline → value with percentage points or stat units', () => {
    expect(improvementText(0.05, 0.07, 'probability')).toBe(
      '5.0% → 7.0% (+2.0 percentage points)',
    );
    expect(improvementText(13911, 14411, 'stat')).toBe(
      '13,911 → 14,411 (+500)',
    );
    expect(improvementText(15327, 15327, 'stat')).toBe('15,327 (no change)');
  });

  it('lists specific changes in the user’s terms', () => {
    const current = {
      choices: {},
      equips: { bronze: null, silver: ORB_IDS.evasion, gold: null },
    };
    expect(
      changeList(
        {
          choices: {},
          equips: { ...current.equips, silver: ORB_IDS.critical },
        },
        current,
        gokuEntry,
      ),
    ).toEqual(['Silver: Evasion +2 · silver → Critical Hit +2 · silver']);
    // TEST ONLY choice node: a changed allocation is listed before equipment.
    expect(
      changeList(
        {
          choices: { 'test-only-node-a': 'critical' },
          equips: { bronze: null, silver: null, gold: null },
        },
        {
          choices: { 'test-only-node-a': 'evasion' },
          equips: { bronze: null, silver: null, gold: null },
        },
        fixtureNodeEntry,
      ),
    ).toEqual(['Choice node test-only-node-a: Evasion → Critical Hit']);
  });

  it('explains a card stat from its sources', () => {
    const x = explainBest(request({ objective: 'attack' }));
    expect(whyLines(x)).toEqual([
      'ATK = 11,111 card + 2,800 Hidden Potential + 500 equipment = 14,411.',
    ]);
  });

  it('explains a skill chance from levels and the written formula', () => {
    const x = explainBest(request({ objective: 'additionalSuper' }));
    expect(whyLines(x)).toEqual([
      'Additional Attack: 5 from Hidden Potential + 2 from equipment = 7 levels.',
      'Initial AA trigger = 7 (Additional Attack levels) × 2.0% (chance per level) = 14.0%.',
      'Initial extra Super = 14.0% (Initial AA trigger) × 50.0% (Super conversion) = 7.0%.',
    ]);
  });
});
