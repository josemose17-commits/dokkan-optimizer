import type {
  CatalogSource,
  CatalogState,
  Fact,
} from '../../../character-data/domain';

// One individually recorded real state: the pre-EZA base state of card
// 1003211, from a single public page retrieved once on 2026-10-19 (see
// docs/character-build/DATA_ACCESS.md). Facts were recorded by hand; no
// dataset, artwork or page text beyond short factual effects is copied.
// Source-documented only: no independent confirmation exists.

export const BASE_STATE_ID = 'unknown-region:1003211:base:lv120:sa10';
const PAGE = 'https://dokkan.fyi/characters/1003211';
// SHA-256 of the retrieved HTML pins the exact page revision that was read.
const PAGE_SHA256 =
  'sha256:facce003bb3f6389a0fd4195f31efd1eb91cf0ff5dca877b1522cf4d5d64d3ab';
const RETRIEVED = '2026-10-19';

export const baseStateSource: CatalogSource = {
  id: `reference:${PAGE}`,
  label: 'DOKKAN.FYI: character page 1003211',
  url: PAGE,
  access: 'public-page',
  license: null,
  permissionReference: null,
  note: 'One public page retrieved individually on 2026-10-19 (robots.txt allows /characters/). Facts recorded manually from the delivered page data. No dataset-reuse grant; no bulk use, assets or hidden endpoints.',
};

const documented = <T>(
  value: T,
  locator: string,
  note: string | null = null,
  completeness: 'complete' | 'partial' = 'complete',
): Fact<T> => ({
  value,
  completeness,
  note,
  provenance: [
    {
      sourceId: baseStateSource.id,
      locator: `Page data (embedded JSON) for card 1003211: ${locator}`,
      sourceRevision: PAGE_SHA256,
      retrievedAt: RETRIEVED,
      reviewedAt: RETRIEVED,
      status: 'source-documented',
      independentConfirmation: null,
    },
  ],
});
const missing = <T>(note: string): Fact<T> => ({
  value: null,
  completeness: 'missing',
  provenance: [],
  note,
});

const ATTRIBUTION =
  'Attributed to the base state from the page data structure (top-level card fields, separate from the nested awakening block); the page shows no visible base/Lv.120 label.';

export function baseState(cardId: string): CatalogState {
  return {
    id: BASE_STATE_ID,
    cardId,
    awakening: { kind: 'base', step: null },
    // The page states no region; its English text is not region evidence.
    region: null,
    gameVersion: null,
    fields: {
      type: documented('AGL', 'character.type_text = "AGL"'),
      class: documented('Super', 'character.awakening_type_text = "Super"'),
      rarity: documented('UR', 'character.rarity_text = "UR"'),
      level: documented(120, 'character.max_level = 120', ATTRIBUTION),
      superAttackLevel: documented(
        10,
        'character.max_super_attack_level = 10',
        ATTRIBUTION,
      ),
      rawStats: documented(
        { hp: 9500, attack: 8672, defense: 4623 },
        'character.stats.{hp,atk,def}.max = 9500 / 8672 / 4623',
        'Raw stats at the state’s max level, before Hidden Potential (the page keeps potential bonuses separately). The sibling key `eza` equals the admitted EZA Lv.140 stats, which supports this reading of `max`.',
      ),
      leaderSkill: documented(
        'AGL Type Ki +3 and ATK +3000.',
        'character.leader_skill (id 100321)',
      ),
      passive: documented(
        'Battle to the End: ATK +100% for 7 turns from the character’s entry turn.',
        'character.passive_skill (id 438)',
        'Normalized from the source wording. Turn counting and battle-stage interpretation are not modeled.',
      ),
      superAttack: documented(
        'Dragon Fist (12 Ki): supreme damage to the enemy and lowers DEF.',
        'character.super_attacks: "Dragon Fist", ki 12, SA level 0 entry',
        'The source shows no damage multiplier or DEF-reduction amount for this state.',
        'partial',
      ),
      links: missing(
        'The source lists links for the card without tying them to a state; they are not assigned to this state. Unknown does not mean no links.',
      ),
      categories: missing(
        'The source lists current categories for the card without tying them to a state or date; they are not assigned to this state. Unknown does not mean no categories.',
      ),
    },
    // No Hidden Potential profile is admitted for this state.
    potentialProfiles: [],
    optimization: {
      status: 'unavailable',
      evaluatorId: null,
      reason:
        'No evaluator: the progression profile, eligible equipment and evaluation contexts for this pre-EZA state are not admitted. Descriptive record only.',
    },
  };
}
