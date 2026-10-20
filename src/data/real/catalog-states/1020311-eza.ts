import type {
  CatalogCard,
  CatalogSource,
  CatalogState,
  Fact,
} from '../../../character-data/domain';
import {
  UI_GOKU_CARD_ID,
  UI_GOKU_STATE_ID,
  UI_GOKU_PAGE,
} from '../character-build/ui-goku-kit';

export const uiGokuSource: CatalogSource = {
  id: 'reference:1020311-eza-events',
  label: 'DOKKAN.FYI — individual Ultra Instinct Goku EZA facts',
  url: UI_GOKU_PAGE,
  access: 'public-page',
  license: null,
  permissionReference: null,
  note: 'Two individually targeted public references were read through web retrieval on 2026-10-20. No API, scraping, assets, calculator implementation or bulk dataset was used. robots.txt was unavailable through the retrieval tool. No bypass, raw response hash, data-license grant or independent confirmation is asserted.',
};
const fact = <T>(value: T, locator: string, partial = false): Fact<T> => ({
  value,
  completeness: partial ? 'partial' : 'complete',
  note: partial
    ? 'Selected individual effects only; other effects remain recorded or unavailable.'
    : null,
  provenance: [
    {
      sourceId: uiGokuSource.id,
      locator,
      sourceRevision: null,
      retrievedAt: '2026-10-20',
      reviewedAt: '2026-10-20',
      status: 'source-documented',
      independentConfirmation: null,
    },
  ],
});
const missing = <T>(note: string): Fact<T> => ({
  value: null,
  completeness: 'missing',
  note,
  provenance: [],
});
export const uiGokuCard: CatalogCard = {
  id: UI_GOKU_CARD_ID,
  name: fact('Goku (Ultra Instinct)', 'Visible name'),
  title: fact('True Ultra Instinct', 'Visible title'),
  form: 'unknown',
  fromCardId: null,
  aliases: [{ sourceId: uiGokuSource.id, recordId: '1020311', region: null }],
};
export const uiGokuState: CatalogState = {
  id: UI_GOKU_STATE_ID,
  cardId: UI_GOKU_CARD_ID,
  awakening: { kind: 'eza', step: null },
  region: null,
  gameVersion: null,
  fields: {
    type: fact('AGL', 'EZA LR Super AGL page identity'),
    class: fact('Super', 'Page identity'),
    rarity: fact('LR', 'Page identity'),
    level: fact(150, 'Max level'),
    superAttackLevel: fact(25, 'EZA Super details: maximum SA level'),
    rawStats: missing(
      'Visible HiPo totals are not established raw card stats. No subtraction or potential profile is inferred.',
    ),
    leaderSkill: missing('Not normalized for this event-mechanics slice.'),
    passive: fact(
      'Native additional Super and evasion chances are 77%; entry-turn evasion guarantee; evasion-triggered Ki/DEF and evasion buildup; conditional critical guarantee; HP/revival contributions.',
      'Selected EZA passive factual fields',
      true,
    ),
    superAttack: fact(
      '12-Ki: ATK50% for one turn. 18-Ki: ATK100% for one turn. Both describe self critical50% and team critical7% with different team-support durations.',
      'Distinct 12-Ki / 18-Ki EZA effect tables',
      true,
    ),
    links: missing('Not admitted for this exact-state slice.'),
    categories: missing('Not admitted for this exact-state slice.'),
  },
  potentialProfiles: [],
  optimization: {
    status: 'unavailable',
    evaluatorId: null,
    reason:
      'Reviewed kit guidance and a bounded native-event preview are available. Full build search is blocked on an attainable board/equipment mapping and essential chain, critical-overlap and later-evasion rules.',
  },
};
