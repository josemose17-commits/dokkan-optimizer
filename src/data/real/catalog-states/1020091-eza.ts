import type {
  CatalogCard,
  CatalogSource,
  CatalogState,
  Fact,
} from '../../../character-data/domain';
import {
  GOHAN_CARD_ID,
  GOHAN_PAGE,
  GOHAN_STATE_ID,
} from '../character-build/gohan-kit';

export const gohanSource: CatalogSource = {
  id: 'reference:1020091-eza-kit',
  label: 'DOKKAN.FYI — Gohan EZA individual factual reference',
  url: GOHAN_PAGE,
  access: 'public-page',
  license: null,
  permissionReference: null,
  note: 'Individual factual observations, originally paraphrased. Public readable page reviewed 2026-10-19, with a DokkanStats browser cross-check. No artwork, database import, code or long descriptions. Direct host HTML/robots requests returned 403; no bypass or raw-page hash is claimed. This is not a bulk-reuse grant.',
};
const fact = <T>(
  value: T,
  locator: string,
  completeness: 'complete' | 'partial' = 'complete',
): Fact<T> => ({
  value,
  completeness,
  note:
    completeness === 'partial'
      ? 'Partial original summary for kit guidance. Other effects are not normalized or executable here; consult the referenced exact-state description.'
      : null,
  provenance: [
    {
      sourceId: gohanSource.id,
      locator,
      sourceRevision: null,
      retrievedAt: '2026-10-19',
      reviewedAt: '2026-10-19',
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
export const gohanCard: CatalogCard = {
  id: GOHAN_CARD_ID,
  name: fact('Gohan (Teen)', 'Visible card name'),
  title: fact('Power Beyond the Extremes', 'Visible title'),
  aliases: [{ sourceId: gohanSource.id, recordId: '1020091', region: null }],
  form: 'unknown',
  fromCardId: null,
};
export const gohanState: CatalogState = {
  id: GOHAN_STATE_ID,
  cardId: GOHAN_CARD_ID,
  awakening: { kind: 'eza', step: null },
  region: null,
  gameVersion: null,
  fields: {
    type: fact('TEQ', 'EZA UR Super TEQ identity'),
    class: fact('Super', 'EZA UR Super TEQ identity'),
    rarity: fact('UR', 'EZA UR Super TEQ identity'),
    level: fact(140, 'Max level for displayed EZA state'),
    superAttackLevel: fact(15, 'Extreme Super details: maximum SA level 15'),
    rawStats: missing(
      'Raw statistics were not admitted for the kit-guidance slice. HiPo display totals are not substituted.',
    ),
    leaderSkill: missing(
      'Leader description not needed by the admitted kit-guidance policy; not normalized here.',
    ),
    passive: fact(
      'Guard before attacking; entry protection; native additional attacks; a further additional-attack condition after three attacks; ATK benefits tied to guard activation.',
      'Visible EZA passive sections; partial original summary',
      'partial',
    ),
    superAttack: fact(
      'Z-Sword Slash (Extreme) supplies lasting ATK/DEF raises and lowers enemy ATK. The reviewed guidance uses the lasting DEF effect.',
      'Visible EZA Super and structured effect details; partial original summary',
      'partial',
    ),
    links: missing(
      'Not admitted in this kit-guidance record. Unknown does not mean no links.',
    ),
    categories: missing(
      'Not admitted in this kit-guidance record. Unknown does not mean no categories.',
    ),
  },
  potentialProfiles: [],
  optimization: {
    status: 'unavailable',
    evaluatorId: null,
    reason:
      'Reviewed kit guidance is available, but no complete attainable allocation set, compatible equipment catalog or numerical evaluator is admitted for this state.',
  },
};
