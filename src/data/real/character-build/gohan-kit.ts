import type { Ability, Effect } from '../../../character-definitions/domain';
import type { ReviewedKit } from '../../../character-build/kit';

export const GOHAN_CARD_ID = 'admitted-card:1020091';
export const GOHAN_STATE_ID = 'unknown-region:1020091:eza:lv140:sa15';
export const GOHAN_PAGE = 'https://dokkan.fyi/characters/1020091';
const reviewedAt = '2026-10-19';
const source = (field: string) => ({
  field,
  status: 'source-documented' as const,
  reference: GOHAN_PAGE,
  note: 'Individually read public English EZA description. Source documentation, not independent in-game confirmation.',
});
const effect = (
  id: string,
  label: string,
  values: Partial<Effect>,
): Effect => ({
  id,
  label,
  family: 'other',
  representation: 'structured',
  target: 'self',
  stat: null,
  amount: null,
  unit: 'unknown',
  condition: { kind: 'always' },
  timing: 'start-of-turn',
  duration: { kind: 'permanent', count: null },
  stacking: 'once',
  cap: null,
  reset: '',
  dependencies: [],
  description: label,
  source: source(id),
  ...values,
});
const abilities: Ability[] = [
  {
    id: 'gohan-eza-passive',
    name: "Elder Kai's Ritual",
    kind: 'passive',
    wording:
      'Guard, entry protection, native additional attacks and a guard-triggered ATK benefit.',
    effects: [
      effect('gohan-guard', 'Guards all attacks', { family: 'guard' }),
      effect('gohan-basic-attack', 'ATK bonus at the start of the turn', {
        family: 'percent-stat',
        stat: 'attack',
        amount: 158,
        unit: 'percent',
      }),
      effect('gohan-entry-reduction', 'Entry-turn damage reduction', {
        family: 'damage-reduction',
        amount: 30,
        unit: 'percent',
        condition: {
          kind: 'threshold',
          field: 'appearance',
          operator: '=',
          value: 1,
        },
        duration: { kind: 'turns', count: 1 },
      }),
      effect(
        'gohan-native-additional',
        'Native additional attack with a great chance to be a Super',
        {
          family: 'additional-attack',
          timing: 'after-attack',
          amount: 1,
          unit: 'count',
          description:
            'The Super conversion wording is recorded; its executable probability/check ordering is unavailable.',
        },
      ),
      effect(
        'gohan-three-attacks',
        'Another native additional attack after three attacks in battle',
        {
          family: 'additional-attack',
          timing: 'after-attack',
          amount: 1,
          unit: 'count',
          condition: {
            kind: 'threshold',
            field: 'attacksPerformed',
            operator: '>=',
            value: 3,
          },
          description:
            'Counter activation timing within the turn is unresolved; no attack-chain calculation is implemented.',
        },
      ),
      effect('gohan-guard-attack', 'ATK benefit after guard activation', {
        family: 'percent-stat',
        stat: 'attack',
        amount: 58,
        unit: 'percent',
        timing: 'after-hit',
        dependencies: ['guard-activation'],
        condition: {
          kind: 'other',
          description:
            'Guard activation; detailed source wording also says receiving an attack. Exact event semantics unresolved.',
        },
        duration: { kind: 'turns', count: 3 },
      }),
    ],
  },
  {
    id: 'gohan-eza-super',
    name: 'Z-Sword Slash (Extreme)',
    kind: 'super',
    wording:
      'A Super raises ATK and DEF for a long duration and lowers enemy ATK.',
    effects: [
      effect('gohan-super-defense', 'Lasting DEF raise from a Super', {
        family: 'percent-stat',
        stat: 'defense',
        amount: 50,
        unit: 'percent',
        timing: 'after-attack',
        duration: { kind: 'turns', count: 99 },
        stacking: 'additive',
        description:
          'FYI records 99 turns; DokkanStats displays infinite. Guidance uses only persistence between early appearances, not an executable DEF formula.',
      }),
    ],
  },
];

export const gohanKit: ReviewedKit = {
  cardId: GOHAN_CARD_ID,
  stateId: GOHAN_STATE_ID,
  revision: 'gohan-eza-kit-guidance-2026-10-19.1',
  policy: 'guard-buildup-v1',
  identity: {
    type: 'TEQ',
    rarity: 'UR',
    level: 140,
    sa: 15,
    awakening: 'eza',
    step: null,
    region: null,
    gameVersion: null,
  },
  abilities,
  references: [
    {
      id: 'gohan-kit-fyi',
      label: 'DOKKAN.FYI — exact EZA kit and Super description',
      url: GOHAN_PAGE,
      reviewedAt,
      independentConfirmation: null,
    },
    {
      id: 'gohan-kit-stats',
      label: 'DokkanStats — EZA Standard/Detailed view (read in browser)',
      url: 'https://dokkanstats.com/en/cards/1020091.html',
      reviewedAt,
      independentConfirmation: null,
    },
  ],
  notes: [
    'Scope: the untransformed EZA state during early defensive buildup; Active Skill transformation and the transformed kit are outside this guidance.',
    'English source text does not establish region or game version. Both remain unknown; this state is not silently labeled Global.',
    'The sources agree on the relevant guard, native additional and lasting-Super effects. Shared upstream data is possible; agreement is not independent corroboration.',
    'This is a deliberately partial structured interpretation. Other ATK/DEF, Ki, debuff and Active Skill details are not executable. No damage, battle DEF or survival result follows.',
    'The 99-turn/infinite wording disagreement does not change the early-buildup inference. No late-duration or reset calculation is offered.',
  ],
  buildGaps: [
    'No complete choice/increment/prerequisite list or exhaustive attainable set is bound to this card and a named unlocked-route configuration.',
    'Gohan-compatible equipment records and restrictions have not been admitted. AGL bronze items are not TEQ items; unresolved generic silver records are not promoted.',
    'Native additional attack ordering, Hidden Potential check opportunities and within-turn counter activation are not implemented or independently confirmed.',
    'Guard/received-attack activation semantics remain unresolved for Evasion tradeoffs. No exact remaining Critical/Evasion split is recommended.',
  ],
};
