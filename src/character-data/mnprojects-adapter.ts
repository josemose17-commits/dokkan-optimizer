import type {
  CatalogCard,
  CatalogSource,
  CatalogState,
  Fact,
  StatBlock,
} from './domain';

// Provider-specific interpretation is deliberately outside catalog/search and
// the optimizer. Input is a bounded factual projection, never executable data.
export interface MNSource {
  source: CatalogSource;
  revision: string;
  retrievedAt: string;
}
type Row = Record<string, unknown> & {
  id: string;
  name: string;
  title: string;
  rarity: 'UR' | 'LR';
  sourceRow: number;
  hasEzaDescriptions: boolean;
  embeddedForms: number;
};
const text = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 2000;
const integer = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) >= 0;
const keys = new Set([
  'sourceRow',
  'id',
  'name',
  'title',
  'rarity',
  'type',
  'class',
  'maxLevel',
  'maxSALevel',
  'links',
  'categories',
  'baseHP',
  'maxLevelHP',
  'freeDupeHP',
  'rainbowHP',
  'baseAttack',
  'maxLevelAttack',
  'freeDupeAttack',
  'rainbowAttack',
  'baseDefence',
  'maxDefence',
  'freeDupeDefence',
  'rainbowDefence',
  'hasEzaDescriptions',
  'embeddedForms',
]);
const identity = (r: Row) =>
  JSON.stringify([r.name, r.title, r.rarity, r.type ?? null, r.class ?? null]);

export function importMNProjects(input: unknown, metadata: MNSource) {
  if (!Array.isArray(input) || input.length > 10_000)
    throw new Error('Expected at most 10,000 factual rows.');
  const exclusions: { sourceId: string; recordId: string; reason: string }[] =
    [];
  const groups = new Map<string, Row[]>();
  const excludedRows: number[] = [];
  const reject = (row: number, recordId: string, reason: string) => {
    exclusions.push({ sourceId: metadata.source.id, recordId, reason });
    excludedRows.push(row);
  };
  const locations = new Set<number>();
  for (let i = 0; i < input.length; i++) {
    const raw: unknown = input[i];
    if (
      !raw ||
      typeof raw !== 'object' ||
      Array.isArray(raw) ||
      Object.keys(raw).some((k) => !keys.has(k))
    )
      throw new Error(`Invalid factual row structure at ${i}.`);
    const r = raw as Row;
    if (
      !text(r.id) ||
      !/^\d+$/.test(r.id) ||
      !text(r.name) ||
      !text(r.title) ||
      !integer(r.sourceRow) ||
      locations.has(r.sourceRow) ||
      typeof r.hasEzaDescriptions !== 'boolean' ||
      !integer(r.embeddedForms)
    )
      throw new Error(`Invalid factual row identity at ${i}.`);
    locations.add(r.sourceRow);
    if (r.rarity !== 'UR' && r.rarity !== 'LR') {
      reject(
        r.sourceRow,
        `${r.id}@row-${r.sourceRow}`,
        'Outside the UR/LR catalog scope.',
      );
      continue;
    }
    // Specific material classification; unknown class/SA alone is not a reason
    // to discard a character (the promotional Heroines row remains visible).
    if (r.id === '11148' && r.name === 'Hercule Statue (Diamond)') {
      reject(
        r.sourceRow,
        `${r.id}@row-${r.sourceRow}`,
        'Non-character Zeni material: Hercule Statue (Diamond).',
      );
      continue;
    }
    const group = groups.get(r.id) ?? [];
    group.push(r);
    groups.set(r.id, group);
  }
  const cards: CatalogCard[] = [],
    states: CatalogState[] = [];
  const conflicts: { id: string; rows: number[]; fields: string[] }[] = [];
  const missing = <T>(note: string): Fact<T> => ({
    value: null,
    completeness: 'missing',
    provenance: [],
    note,
  });
  function fact<T>(
    value: T,
    rows: Row[],
    locator: string,
    note: string | null = null,
  ): Fact<T> {
    return {
      value,
      completeness: note ? 'partial' : 'complete',
      note,
      provenance: rows.map((r) => ({
        sourceId: metadata.source.id,
        locator: `data/DokkanCharacterData.json $[${r.sourceRow}] ${locator}`,
        sourceRevision: metadata.revision,
        retrievedAt: metadata.retrievedAt,
        reviewedAt: metadata.retrievedAt,
        status: 'source-documented',
        independentConfirmation: null,
      })),
    };
  }
  const stats = (r: Row, names: string[]): StatBlock | null =>
    names.every((k) => integer(r[k]))
      ? {
          hp: r[names[0]!] as number,
          attack: r[names[1]!] as number,
          defense: r[names[2]!] as number,
        }
      : null;
  for (const [id, rows] of groups) {
    if (new Set(rows.map(identity)).size > 1) {
      for (const r of rows)
        reject(
          r.sourceRow,
          `${id}@row-${r.sourceRow}`,
          `Conflicting source ID ${id}: ${rows.map((r) => `${r.title} / ${r.name}`).join(' versus ')}. No identity guessed.`,
        );
      continue;
    }
    const first = rows[0]!;
    const cardId = `mnprojects:card:${id}`;
    const common = <T>(key: string, valid: (v: unknown) => v is T): Fact<T> => {
      if (!rows.every((r) => valid(r[key])))
        return missing(`Historical source ${key} is missing or malformed.`);
      if (
        !rows.every(
          (r) => JSON.stringify(r[key]) === JSON.stringify(first[key]),
        )
      )
        return missing(
          `Historical source rows disagree on ${key}; no row was silently preferred.`,
        );
      return fact(first[key] as T, rows, key);
    };
    const strings = (v: unknown): v is string[] =>
      Array.isArray(v) && v.length <= 1000 && v.every(text);
    const labels = (key: string): Fact<string[]> => {
      const f = common(key, strings);
      if (f.value === null) return f;
      const unique = [...new Set(f.value)];
      return unique.length === f.value.length
        ? f
        : {
            ...f,
            value: unique,
            completeness: 'partial',
            note: 'Exact duplicate labels in the historical source were removed; membership is unchanged.',
          };
    };
    const eza = rows.filter((r) => r.hasEzaDescriptions);
    const knownBaseLevel = eza.length
      ? null
      : common('maxLevel', (v): v is number => integer(v) && v > 0 && v <= 150)
          .value;
    const knownBaseSA = eza.length
      ? null
      : common('maxSALevel', (v): v is number => integer(v) && v > 0 && v <= 25)
          .value;
    const differing = [...keys].filter((k) =>
      rows.some((r) => JSON.stringify(r[k]) !== JSON.stringify(first[k])),
    );
    if (rows.length > 1)
      conflicts.push({
        id,
        rows: rows.map((r) => r.sourceRow),
        fields: differing,
      });
    cards.push({
      id: cardId,
      name: fact(first.name, rows, 'name'),
      title: fact(first.title, rows, 'title'),
      aliases: [{ sourceId: metadata.source.id, recordId: id, region: null }],
      form: 'unknown',
      fromCardId: null,
    });
    for (const kind of [
      'base',
      ...(eza.length ? ['eza' as const] : []),
    ] as const) {
      const stateRows = kind === 'eza' ? eza : rows;
      const level = kind === 'base' ? knownBaseLevel : null;
      const sa = kind === 'base' ? knownBaseSA : null;
      const baseStats =
        !eza.length && rows.length === 1
          ? stats(first, ['maxLevelHP', 'maxLevelAttack', 'maxDefence'])
          : null;
      const state: CatalogState = {
        id: `${cardId}:${kind}:lv${level ?? 'unknown'}:sa${sa ?? 'unknown'}`,
        cardId,
        awakening: { kind, step: null },
        region: null,
        gameVersion: null,
        fields: {
          type: common(
            'type',
            (v): v is 'AGL' | 'TEQ' | 'INT' | 'STR' | 'PHY' =>
              ['AGL', 'TEQ', 'INT', 'STR', 'PHY'].includes(String(v)),
          ),
          class: common(
            'class',
            (v): v is 'Super' | 'Extreme' => v === 'Super' || v === 'Extreme',
          ),
          rarity: fact(first.rarity, rows, 'rarity'),
          level:
            level === null
              ? missing(
                  'Source max-level fields can mix base and EZA scopes; no state level inferred.',
                )
              : fact(level, stateRows, 'maxLevel'),
          superAttackLevel:
            sa === null
              ? missing(
                  'Exact SA level for this awakening is unresolved in the historical snapshot.',
                )
              : fact(sa, stateRows, 'maxSALevel'),
          rawStats:
            baseStats && level !== null
              ? fact(
                  baseStats,
                  rows,
                  'maxLevelHP / maxLevelAttack / maxDefence',
                )
              : missing(
                  'Historical stat columns are not assigned to this awakening/level. See source-reported tables; no raw-stat substitution.',
                ),
          links: labels('links'),
          categories: labels('categories'),
          leaderSkill: missing(
            'Copied source prose omitted: icons and original-text reuse need separate treatment. No replacement formula is inferred.',
          ),
          passive: missing(
            'Copied source prose omitted; no executable character-kit support is inferred from roster inclusion.',
          ),
          superAttack: missing(
            'Copied source prose and unresolved footnotes omitted. Super/Ultra Super mechanics are not inferred.',
          ),
        },
        potentialProfiles: [],
        optimization: {
          status: 'unavailable',
          evaluatorId: null,
          reason:
            'Historical UR/LR reference record only. No reviewed kit policy, exact potential template, equipment mapping or numerical evaluator. Existing Goku/Gohan support is never borrowed.',
        },
      };
      // Preserve source columns as separate reported totals; no subtraction,
      // interpolation, default 55/69/79/90/100 ladder or choice graph.
      if (kind === 'base')
        state.reportedStats = rows.flatMap((r) =>
          [
            [
              'base-column',
              'Source base column',
              ['baseHP', 'baseAttack', 'baseDefence'],
              null,
            ],
            [
              'max-level',
              'Source max-level column',
              ['maxLevelHP', 'maxLevelAttack', 'maxDefence'],
              knownBaseLevel,
            ],
            [
              'free-dupe',
              'Source free-dupe column',
              ['freeDupeHP', 'freeDupeAttack', 'freeDupeDefence'],
              knownBaseLevel,
            ],
            [
              'rainbow',
              'Source rainbow column',
              ['rainbowHP', 'rainbowAttack', 'rainbowDefence'],
              knownBaseLevel,
            ],
          ].map(([key, label, names, tableLevel]) => {
            const value = stats(r, names as string[]);
            const note =
              'Source-reported column only. Exact potential percentage, duplicate routes and selected skills are not recorded; no intermediate profiles or EZA stat growth are inferred.';
            return {
              id: `${key}:row-${r.sourceRow}`,
              label: `${label}${rows.length > 1 ? ` (source row ${r.sourceRow})` : ''}`,
              level: tableLevel as number | null,
              potentialPercent: null,
              dupeRoutes: null,
              note,
              totals: value
                ? fact(value, [r], (names as string[]).join(' / '), note)
                : missing<StatBlock>(
                    'One or more source stat values are missing; the total is unavailable, not zero.',
                  ),
            };
          }),
        );
      states.push(state);
    }
  }
  return {
    cards,
    states,
    exclusions,
    report: {
      sourceRows: input.length,
      acceptedRows: input.length - excludedRows.length,
      importedCards: cards.length,
      importedStates: states.length,
      baseStates: states.filter((s) => s.awakening.kind === 'base').length,
      ezaStates: states.filter((s) => s.awakening.kind === 'eza').length,
      sezaStates: 0,
      excludedRows: excludedRows.sort((a, b) => a - b),
      duplicateRowGroups: conflicts,
      embeddedFormsNotMapped: input.reduce(
        (n, r) => n + Number((r as Row).embeddedForms),
        0,
      ),
    },
  };
}
