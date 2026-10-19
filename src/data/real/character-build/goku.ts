import type {
  BuildRequest,
  CharacterCatalog,
  Evidence,
  Metadata,
  Orb,
} from '../../../character-build/domain';

const reviewedAt = '2026-10-18';
const wiki = 'https://dbz-dokkanbattle.fandom.com/wiki/';
const sources = {
  card: {
    label: 'Dokkan wiki: EZA progression table',
    url: `${wiki}Mystery_Super_Technique_Super_Saiyan_3_Goku`,
    access: 'search-index' as const,
  },
  steps: {
    label: 'Dokkan wiki: EZA step 7',
    url: `${wiki}Extreme_Z-Awakening_Medals%3A_Super_Saiyan_3_Goku_01`,
    access: 'search-index' as const,
  },
  stats: {
    label: 'DokkanStats: statistics (page defaults to SEZA)',
    url: 'https://dokkanstats.com/en/cards/1003211',
    access: 'page' as const,
  },
  potential: {
    label: 'Dokkan wiki: Hidden Potential',
    url: `${wiki}Hidden_Potential_System`,
    access: 'search-index' as const,
  },
  player: {
    label: 'Original player discussion: #131–134',
    url: 'https://gamefaqs.gamespot.com/boards/178921-dragon-ball-z-dokkan-battle/74852076?page=13',
    access: 'page' as const,
  },
  orbs: {
    label: 'Dokkan wiki: Skill Orbs',
    url: `${wiki}Skill_Orbs`,
    access: 'search-index' as const,
  },
  bronze: {
    label: 'FYI: training stage item labels',
    url: 'https://dokkan.fyi/stages/1910011',
    access: 'page' as const,
  },
  silver: {
    label: 'FYI: revamped training stage item labels',
    url: 'https://dokkan.fyi/stages/2520011',
    access: 'search-index' as const,
  },
  calc: {
    label: 'Authored calculator guide',
    url: 'https://kandymanis.github.io/dokkanalytics/guide',
    access: 'page' as const,
  },
  aa: {
    label: 'Dokkan wiki: Additional Attack',
    url: `${wiki}Additional_Attack`,
    access: 'search-index' as const,
  },
  critical: {
    label: 'Dokkan wiki: Critical Hit',
    url: `${wiki}Critical_Hit`,
    access: 'search-index' as const,
  },
  evasion: {
    label: 'Dokkan wiki: Evasion',
    url: `${wiki}Evasion`,
    access: 'search-index' as const,
  },
};

function claim(
  id: string,
  field: string,
  statement: string,
  refs: (keyof typeof sources)[],
  limitation: string,
  status: Evidence['status'] = 'documented',
): Evidence {
  return {
    id,
    field,
    statement,
    sources: refs.map((key) => sources[key]),
    status,
    independentConfirmation: null,
    reviewedAt,
    verifiedAt: null,
    limitation,
  };
}
const metadata = (id: string, evidenceIds: string[]): Metadata => ({
  id,
  evidenceIds,
  support: 'supported',
  reviewedAt,
  verifiedAt: null,
});

export const CARD_STATE_ID = 'global-en:1003211:eza-7:lv140:sa15';
export const PROFILE_ID = 'goku-s-agl:no-dupes:base-board-filled:v1';
export const ORB_IDS = {
  hp: 'agl:bronze:hp:5',
  attack: 'agl:bronze:attack:5',
  defense: 'agl:bronze:defense:5',
  additional: 'generic:silver:additional:2',
  critical: 'generic:silver:critical:2',
  evasion: 'generic:silver:evasion:2',
} as const;

// Six individually recorded numeric items, not a downloaded game database.
const orbs: Orb[] = [
  ...(['hp', 'attack', 'defense'] as const).map((stat): Orb => ({
    ...metadata(ORB_IDS[stat], ['bronze-items', 'slot-gates']),
    label: `AGL ${stat === 'attack' ? 'ATK' : stat === 'defense' ? 'DEF' : 'HP'} +500 · bronze Lv.5`,
    slots: ['bronze'],
    minSuperAttackLevel: 1,
    minRoutes: 0,
    restrictions: [{ kind: 'type', value: 'AGL' }],
    stats: { [stat]: 500 },
    skills: {},
    reusable: false,
    gameItemId: null,
  })),
  ...(['additional', 'critical', 'evasion'] as const).map((skill): Orb => ({
    ...metadata(ORB_IDS[skill], ['silver-items', 'slot-gates']),
    label: `${skill === 'additional' ? 'Additional Attack' : skill === 'critical' ? 'Critical Hit' : 'Evasion'} +2 · silver`,
    slots: ['silver'],
    minSuperAttackLevel: 10,
    minRoutes: 0,
    restrictions: [],
    stats: {},
    skills: { [skill]: 2 },
    reusable: false,
    gameItemId: null,
  })),
];

export const characterCatalog: CharacterCatalog = {
  revision: 'goku-initial-check-2026-10-18.1',
  card: {
    ...metadata(CARD_STATE_ID, ['identity', 'card-stats', 'eza-kit']),
    name: 'Super Saiyan 3 Goku',
    title: 'Mystery Super Technique',
    region: 'global-en',
    type: 'AGL',
    rarity: 'UR',
    awakening: 'eza-step-7',
    level: 140,
    superAttackLevel: 15,
    gameBuild: null,
    sourceAliases: [{ source: 'DokkanStats / FYI', id: '1003211' }],
    baseStats: { hp: 12527, attack: 11111, defense: 5796 },
    // No category-based item is admitted, so no category list is invented/imported.
    categories: [],
    excludedMechanics: [
      'Full Hidden Potential node respec: exact choice/prerequisite graph unresolved.',
      'Combat ATK/DEF: passive, leader, link, support and rounding stages not evaluated.',
      'Damage dealt/taken, enemy DEF debuff, total-turn attack chains and survival are unavailable.',
      'Other awakenings, levels, SA levels, duplicate routes and later turns are outside this catalog.',
    ],
  },
  profile: {
    ...metadata(PROFILE_ID, ['base-board']),
    label: '55% · base board filled · no duplicate routes',
    cardStateId: CARD_STATE_ID,
    routes: [],
    statBonus: { hp: 2800, attack: 2800, defense: 2800 },
    fixedSkills: { additional: 5, critical: 0, evasion: 0 },
    nodes: [],
  },
  orbs,
  evidence: [
    claim(
      'identity',
      'card identity/state',
      'Global English; Super AGL UR; fully EZA step 7, Lv.140, SA15; not Super EZA.',
      ['card', 'steps'],
      'Current database pages often default to SEZA. No independent game capture.',
    ),
    claim(
      'card-stats',
      'card.baseStats',
      'At Lv.140: HP 12527, ATK 11111, DEF 5796 before potential/equips.',
      ['card', 'stats'],
      'Tables agree, but upstream independence is unestablished; only the EZA progression table pins the state.',
    ),
    claim(
      'base-board',
      'potential profile',
      'Filled no-dupe board: +2800 to each stat, native AA5, critical/evasion0, no selectable AA/critical/evasion nodes.',
      ['potential', 'player', 'card'],
      'Full selectable graph is unresolved. This profile admits zero duplicate routes only.',
    ),
    claim(
      'slot-gates',
      'orb eligibility',
      'UR/LR; silver SA10; gold requires two routes.',
      ['orbs'],
      'No gold item or duplicate-route profile is admitted.',
    ),
    claim(
      'bronze-items',
      'bronze item facts',
      'AGL bronze Lv.5 HP, ATK or DEF item: +500 to its named stat.',
      ['bronze', 'orbs'],
      'Internal signature IDs; game item aliases/independent capture unavailable. No acquisition claim.',
    ),
    claim(
      'silver-items',
      'silver item facts',
      'Generic silver Additional Attack, Critical Hit or Evasion Lv.2: adds two skill levels.',
      ['silver', 'orbs'],
      'Stage item labels were indexed; direct current retrieval timed out. Source upstream independence and game item IDs unverified.',
    ),
    claim(
      'raw-stat-addition',
      'card-stat formula',
      'Add flat equip stats to card plus activated potential stats.',
      ['calc'],
      'Card stats only; mathematical tests do not confirm game calculation stages.',
    ),
    claim(
      'aa-initial-check',
      'initial AA check',
      'Trigger .02 per AA level, then a separate .5 chance for the extra to be a Super.',
      ['aa', 'player'],
      'Source-documented. No independent in-game confirmation; no complete turn/chain counts calculated.',
    ),
    claim(
      'critical-check',
      'critical probability',
      'Hidden Potential critical chance .02 per level on an eligible attack.',
      ['critical', 'player'],
      'Only Hidden Potential; no native/external activation or critical damage modeled.',
    ),
    claim(
      'evasion-check',
      'evasion probability',
      'Hidden Potential evasion .01 per level for an eligible incoming attack.',
      ['evasion', 'player'],
      'An evadable/disabled attack is a user assumption, not a named boss claim or survival estimate.',
    ),
    claim(
      'eza-kit',
      'excluded battle mechanics',
      'EZA has a DEF bonus, timed ATK bonus and enemy DEF debuff; no native AA/critical/evasion.',
      ['card', 'steps'],
      'Passive expiry wording and battle calculation stages unresolved. Excluded from card-stat calculations.',
    ),
    claim(
      'damage-gate',
      'outgoing damage',
      'Unavailable until outgoing damage stages and enemy interactions are verified.',
      [],
      'No fabricated performance proxy or damage objective.',
      'unresolved',
    ),
  ],
};

export function defaultRequest(): BuildRequest {
  return {
    cardStateId: CARD_STATE_ID,
    level: 140,
    superAttackLevel: 15,
    progression: {
      profileId: PROFILE_ID,
      systemUnlocked: true,
      routes: [],
      activatedNodes: [],
    },
    current: {
      choices: {},
      equips: { bronze: null, silver: null, gold: null },
    },
    inventory: {},
    mode: 'catalog',
    context: {
      id: 'initial-check-v1',
      battleTurn: 1,
      appearance: 1,
      initialAttack: 'super',
      externalEffects: 'none',
      evasionAllowed: true,
    },
    objective: 'additionalSuper',
    frontierMetrics: [
      'attack',
      'defense',
      'hp',
      'additionalSuper',
      'critical',
      'evasion',
    ],
    maxCandidates: 20000,
  };
}
