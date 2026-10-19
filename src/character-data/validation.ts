import type { CatalogSnapshot } from './domain.ts';
import { AWAKENINGS, RARITIES, TYPES } from './domain.ts';

type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= 100_000;
const nullableText = (v: unknown) => v === null || text(v);
const integer = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const date = (v: unknown) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const url = (v: unknown) => {
  if (v === null) return true;
  if (!text(v)) return false;
  try {
    const parsed = new URL(v);
    return (
      ['http:', 'https:'].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
};
const enumValue = (values: readonly string[]) => (v: unknown) =>
  typeof v === 'string' && values.includes(v);
const strings = (v: unknown) =>
  Array.isArray(v) &&
  v.length <= 1000 &&
  v.every(text) &&
  new Set(v).size === v.length;
const stats = (v: unknown) =>
  object(v) &&
  Object.keys(v).length === 3 &&
  ['hp', 'attack', 'defense'].every((k) => integer(v[k]));

export type ValidationResult =
  | { ok: true; snapshot: CatalogSnapshot; errors: [] }
  | { ok: false; snapshot: null; errors: string[] };

/** Structural validation, not a license grant, source review or game validation. */
export function validateCatalog(
  input: unknown,
  options: { allowTestFixtures?: boolean } = {},
): ValidationResult {
  const errors: string[] = [];
  const fail = (path: string, reason: string) => {
    errors.push(`${path}: ${reason}`);
  };
  const check = (
    condition: boolean,
    path: string,
    reason = 'invalid or missing value',
  ) => {
    if (!condition) fail(path, reason);
  };
  // Every object has a closed key set: unknown content (including deeply
  // nested data under an unexpected key) is rejected, never carried along.
  const known = (value: Obj, allowed: readonly string[], path: string) => {
    for (const key of Object.keys(value))
      if (!allowed.includes(key))
        fail(
          `${path}.${key.length > 60 ? `${key.slice(0, 59)}…` : key}`,
          'field is not in this schema; normalize explicitly rather than silently dropping it',
        );
  };
  if (!object(input))
    return { ok: false, snapshot: null, errors: ['snapshot: object required'] };
  known(
    input,
    [
      'schemaVersion',
      'id',
      'revision',
      'createdAt',
      'origin',
      'coverage',
      'sources',
      'cards',
      'states',
      'stateAliases',
    ],
    'snapshot',
  );
  check(
    input.schemaVersion === 1,
    'schemaVersion',
    'unsupported schema version',
  );
  for (const key of ['id', 'revision']) check(text(input[key]), key);
  check(date(input.createdAt), 'createdAt');
  check(
    enumValue(['admitted-records', 'normalized-export', 'test-fixtures'])(
      input.origin,
    ),
    'origin',
  );
  if (input.origin === 'test-fixtures' && !options.allowTestFixtures)
    fail('origin', 'test fixtures are not admitted to the application catalog');
  const list = (value: unknown, path: string): Obj[] => {
    if (
      !Array.isArray(value) ||
      value.length > 100_000 ||
      !value.every(object)
    ) {
      fail(path, 'array of objects required (maximum 100000)');
      return [];
    }
    return value;
  };
  const sources = list(input.sources, 'sources');
  const cards = list(input.cards, 'cards');
  const states = list(input.states, 'states');
  const aliases = list(input.stateAliases, 'stateAliases');
  const ids = (items: Obj[], path: string) => {
    const result = new Set<string>();
    items.forEach((item, i) => {
      check(text(item.id), `${path}[${i}].id`);
      if (text(item.id)) {
        if (result.has(item.id)) fail(`${path}[${i}].id`, 'duplicate identity');
        result.add(item.id);
      }
    });
    return result;
  };
  const sourceIds = ids(sources, 'sources');
  const cardIds = ids(cards, 'cards');
  const stateIds = ids(states, 'states');
  const cardsWithStates = new Set(states.map((s) => s.cardId));
  cards.forEach((card, i) => {
    if (!cardsWithStates.has(card.id))
      fail(
        `cards[${i}]`,
        'card requires an explicit state, including an unknown state when necessary',
      );
  });
  sources.forEach((source, i) => {
    const path = `sources[${i}]`;
    known(
      source,
      [
        'id',
        'label',
        'url',
        'access',
        'license',
        'permissionReference',
        'note',
      ],
      path,
    );
    check(text(source.label), `${path}.label`);
    check(
      url(source.url),
      `${path}.url`,
      'public http(s) URL or null required; credentials prohibited',
    );
    check(
      enumValue([
        'public-page',
        'search-index',
        'existing-record',
        'approved-export',
        'test-fixture',
      ])(source.access),
      `${path}.access`,
    );
    if (source.access === 'test-fixture' && input.origin !== 'test-fixtures')
      fail(`${path}.access`, 'fixture source in a non-fixture snapshot');
    for (const key of ['license', 'permissionReference'])
      check(nullableText(source[key]), `${path}.${key}`);
    check(text(source.note), `${path}.note`);
    if (source.access === 'approved-export')
      check(
        text(source.permissionReference),
        `${path}.permissionReference`,
        'approved-export requires a recorded grant reference; schema validation does not authenticate it',
      );
  });
  const fact = (
    value: unknown,
    path: string,
    valid: (v: unknown) => boolean,
  ) => {
    if (!object(value)) {
      fail(path, 'fact object required');
      return;
    }
    known(value, ['value', 'completeness', 'provenance', 'note'], path);
    check(
      enumValue(['complete', 'partial', 'missing'])(value.completeness),
      `${path}.completeness`,
    );
    check(nullableText(value.note), `${path}.note`);
    if (value.completeness === 'missing') {
      check(
        value.value === null && text(value.note),
        path,
        'missing facts require null and a reason',
      );
    } else {
      check(valid(value.value), `${path}.value`);
      if (!Array.isArray(value.provenance) || !value.provenance.length)
        fail(
          `${path}.provenance`,
          'present values require field-level provenance',
        );
      if (value.completeness === 'partial')
        check(
          text(value.note),
          `${path}.note`,
          'partial facts require a limitation',
        );
    }
    list(value.provenance, `${path}.provenance`).forEach((ref, i) => {
      const p = `${path}.provenance[${i}]`;
      known(
        ref,
        [
          'sourceId',
          'locator',
          'sourceRevision',
          'retrievedAt',
          'reviewedAt',
          'status',
          'independentConfirmation',
        ],
        p,
      );
      check(
        text(ref.sourceId) && sourceIds.has(ref.sourceId),
        `${p}.sourceId`,
        'unknown source',
      );
      check(text(ref.locator), `${p}.locator`);
      check(nullableText(ref.sourceRevision), `${p}.sourceRevision`);
      for (const key of ['retrievedAt', 'reviewedAt'])
        check(ref[key] === null || date(ref[key]), `${p}.${key}`);
      check(
        enumValue([
          'source-documented',
          'independently-confirmed',
          'unresolved',
        ])(ref.status),
        `${p}.status`,
      );
      const confirmation = ref.independentConfirmation;
      if (object(confirmation))
        known(
          confirmation,
          ['reference', 'date'],
          `${p}.independentConfirmation`,
        );
      if (confirmation !== null)
        check(
          object(confirmation) &&
            text(confirmation.reference) &&
            date(confirmation.date),
          `${p}.independentConfirmation`,
        );
      if (ref.status === 'independently-confirmed')
        check(
          object(confirmation) &&
            text(confirmation.reference) &&
            date(confirmation.date) &&
            date(ref.reviewedAt),
          p,
          'independent confirmation requires a dated reference and review',
        );
    });
  };
  const sourceAliases = new Set<string>();
  cards.forEach((card, i) => {
    const p = `cards[${i}]`;
    known(card, ['id', 'name', 'title', 'aliases', 'form', 'fromCardId'], p);
    fact(card.name, `${p}.name`, text);
    fact(card.title, `${p}.title`, text);
    check(
      enumValue(['starting', 'awakened', 'transformation', 'unknown'])(
        card.form,
      ),
      `${p}.form`,
    );
    check(
      card.fromCardId === null ||
        (text(card.fromCardId) &&
          cardIds.has(card.fromCardId) &&
          card.fromCardId !== card.id),
      `${p}.fromCardId`,
    );
    list(card.aliases, `${p}.aliases`).forEach((alias, j) => {
      known(alias, ['sourceId', 'recordId', 'region'], `${p}.aliases[${j}]`);
      check(
        text(alias.sourceId) &&
          sourceIds.has(alias.sourceId) &&
          text(alias.recordId) &&
          nullableText(alias.region),
        `${p}.aliases[${j}]`,
      );
      const key = JSON.stringify([
        alias.sourceId,
        alias.recordId,
        alias.region,
      ]);
      if (sourceAliases.has(key))
        fail(`${p}.aliases[${j}]`, 'source alias assigned more than once');
      sourceAliases.add(key);
    });
  });
  // Reject awakening cycles; a record is not its own ordinary awakening ancestor.
  const parents = new Map(cards.map((c) => [c.id, c.fromCardId]));
  const checkedAncestors = new Set<unknown>();
  cards.forEach((card, i) => {
    const visited = new Set<unknown>();
    let current: unknown = card.id;
    while (
      current !== null &&
      parents.has(current) &&
      !checkedAncestors.has(current)
    ) {
      if (visited.has(current)) {
        fail(`cards[${i}].fromCardId`, 'awakening cycle');
        break;
      }
      visited.add(current);
      current = parents.get(current);
    }
    for (const id of visited) checkedAncestors.add(id);
  });
  const fieldChecks = {
    type: enumValue(TYPES),
    class: enumValue(['Super', 'Extreme']),
    rarity: enumValue(RARITIES),
    level: (v: unknown) => integer(v) && v > 0,
    superAttackLevel: (v: unknown) => integer(v) && v > 0,
    rawStats: stats,
    leaderSkill: text,
    passive: text,
    superAttack: text,
    links: strings,
    categories: strings,
  };
  states.forEach((state, i) => {
    const p = `states[${i}]`;
    known(
      state,
      [
        'id',
        'cardId',
        'awakening',
        'region',
        'gameVersion',
        'fields',
        'potentialProfiles',
        'optimization',
      ],
      p,
    );
    check(
      text(state.cardId) && cardIds.has(state.cardId),
      `${p}.cardId`,
      'unknown card',
    );
    const awakening = state.awakening;
    if (!object(awakening)) fail(`${p}.awakening`, 'object required');
    else {
      known(awakening, ['kind', 'step'], `${p}.awakening`);
      check(enumValue(AWAKENINGS)(awakening.kind), `${p}.awakening.kind`);
      check(
        awakening.kind === 'base' || awakening.kind === 'unknown'
          ? awakening.step === null
          : integer(awakening.step) && awakening.step > 0,
        `${p}.awakening.step`,
      );
    }
    check(nullableText(state.region), `${p}.region`);
    check(nullableText(state.gameVersion), `${p}.gameVersion`);
    if (!object(state.fields)) fail(`${p}.fields`, 'object required');
    else {
      known(state.fields, Object.keys(fieldChecks), `${p}.fields`);
      for (const [key, valid] of Object.entries(fieldChecks))
        fact(state.fields[key], `${p}.fields.${key}`, valid);
    }
    const profiles = list(state.potentialProfiles, `${p}.potentialProfiles`);
    ids(profiles, `${p}.potentialProfiles`);
    profiles.forEach((profile, j) => {
      known(
        profile,
        ['id', 'label', 'assumptions', 'statAdditions'],
        `${p}.potentialProfiles[${j}]`,
      );
      check(
        text(profile.label) && text(profile.assumptions),
        `${p}.potentialProfiles[${j}]`,
      );
      fact(
        profile.statAdditions,
        `${p}.potentialProfiles[${j}].statAdditions`,
        stats,
      );
    });
    if (!object(state.optimization))
      fail(`${p}.optimization`, 'object required');
    else {
      const optimization = state.optimization;
      known(
        optimization,
        ['status', 'evaluatorId', 'reason'],
        `${p}.optimization`,
      );
      check(
        enumValue(['unavailable', 'limited'])(optimization.status) &&
          text(optimization.reason),
        `${p}.optimization`,
      );
      check(
        optimization.status === 'limited'
          ? text(optimization.evaluatorId)
          : optimization.evaluatorId === null,
        `${p}.optimization.evaluatorId`,
      );
    }
  });
  const aliasNames = new Set<string>();
  aliases.forEach((alias, i) => {
    known(alias, ['alias', 'stateId'], `stateAliases[${i}]`);
    check(
      text(alias.alias) &&
        !stateIds.has(alias.alias) &&
        !aliasNames.has(String(alias.alias)),
      `stateAliases[${i}].alias`,
      'duplicate or conflicting alias',
    );
    check(
      text(alias.stateId) && stateIds.has(alias.stateId),
      `stateAliases[${i}].stateId`,
      'unknown canonical state',
    );
    aliasNames.add(String(alias.alias));
  });
  if (!object(input.coverage)) fail('coverage', 'object required');
  else {
    known(input.coverage, ['sourceCardCount', 'scope', 'excluded'], 'coverage');
    check(
      input.coverage.sourceCardCount === null ||
        integer(input.coverage.sourceCardCount),
      'coverage.sourceCardCount',
    );
    check(text(input.coverage.scope), 'coverage.scope');
    const exclusions = new Set<string>();
    list(input.coverage.excluded, 'coverage.excluded').forEach((entry, i) => {
      known(
        entry,
        ['sourceId', 'recordId', 'reason'],
        `coverage.excluded[${i}]`,
      );
      check(
        text(entry.sourceId) &&
          sourceIds.has(entry.sourceId) &&
          text(entry.recordId) &&
          text(entry.reason),
        `coverage.excluded[${i}]`,
      );
      const key = JSON.stringify([entry.sourceId, entry.recordId]);
      if (exclusions.has(key))
        fail(`coverage.excluded[${i}]`, 'duplicate excluded source record');
      exclusions.add(key);
    });
    if (integer(input.coverage.sourceCardCount))
      check(
        input.coverage.sourceCardCount ===
          cards.length +
            (Array.isArray(input.coverage.excluded)
              ? input.coverage.excluded.length
              : 0),
        'coverage.sourceCardCount',
        'source card count must reconcile with cards plus explicitly excluded records',
      );
  }
  return errors.length
    ? { ok: false, snapshot: null, errors }
    : {
        ok: true,
        snapshot: structuredClone(input) as unknown as CatalogSnapshot,
        errors: [],
      };
}
