import { AWAKENINGS, RARITIES, TYPES } from '../character-data/domain';
import {
  ABILITIES,
  CONTEXT_FIELDS,
  FAMILIES,
  OPERATORS,
  PHASES,
  SKILLS,
  SLOTS,
  STATS,
  type DefinitionLibrary,
} from './domain';

export const LIMITS = {
  bytes: 1_048_576,
  documents: 100,
  configurations: 30,
  equipment: 60,
  abilities: 60,
  effects: 120,
  conditionDepth: 6,
  conditionNodes: 64,
} as const;
export type Validation =
  { ok: true; library: DefinitionLibrary } | { ok: false; errors: string[] };
type Obj = Record<string, unknown>;
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);

export function validateLibrary(input: unknown): Validation {
  const errors: string[] = [];
  const error = (path: string, message: string) => {
    if (errors.length < 80) errors.push(`${path}: ${message}`);
  };
  // Bound traversal before any recursive shape checks; never follow prototypes.
  const pending = [{ value: input, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++visited > 80_000 || depth > 24)
      return {
        ok: false,
        errors: ['Input exceeds structural size or nesting limits.'],
      };
    if (
      typeof value === 'function' ||
      typeof value === 'symbol' ||
      typeof value === 'bigint' ||
      value === undefined
    )
      return { ok: false, errors: ['Only JSON data values are accepted.'] };
    if (value && typeof value === 'object') {
      if (
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null
      )
        return { ok: false, errors: ['Only plain data objects are accepted.'] };
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (Object.values(descriptors).some((d) => d.get || d.set))
        return {
          ok: false,
          errors: ['Accessor properties are not data and are not accepted.'],
        };
      for (const [key, child] of Object.entries(value)) {
        if (forbidden.has(key))
          return {
            ok: false,
            errors: ['Prototype-named fields are not accepted.'],
          };
        pending.push({ value: child, depth: depth + 1 });
      }
    }
  }
  const object = (value: unknown, path: string, keys: string[]): Obj => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      error(path, 'Expected an object.');
      return {};
    }
    const v = value as Obj;
    if (
      Object.keys(v).some((k) => !keys.includes(k)) ||
      keys.some((k) => !Object.hasOwn(v, k))
    )
      error(path, 'Fields do not match schema version 1.');
    return v;
  };
  const text = (v: unknown, p: string, required = false, max = 8000) => {
    if (typeof v !== 'string' || v.length > max || (required && !v.trim()))
      error(
        p,
        `Expected ${required ? 'nonempty ' : ''}text (at most ${max} characters).`,
      );
  };
  const id = (v: unknown, p: string) => {
    if (
      typeof v !== 'string' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,159}$/.test(v) ||
      forbidden.has(v)
    )
      error(p, 'Invalid stable ID.');
  };
  const number = (
    v: unknown,
    p: string,
    nullable = true,
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    integer = true,
  ) => {
    if (v === null && nullable) return;
    if (
      typeof v !== 'number' ||
      !Number.isFinite(v) ||
      (integer && !Number.isSafeInteger(v)) ||
      v < min ||
      v > max
    )
      error(
        p,
        `Expected ${nullable ? 'unknown/null or ' : ''}${integer ? 'an integer' : 'a finite number'} in [${min}, ${max}].`,
      );
  };
  const enumeration = (
    v: unknown,
    p: string,
    options: readonly unknown[],
    nullable = false,
  ) => {
    if (!(nullable && v === null) && !options.includes(v))
      error(p, 'Unsupported choice.');
  };
  const array = (v: unknown, p: string, max: number): unknown[] => {
    if (!Array.isArray(v) || v.length > max) {
      error(p, `Expected at most ${max} records.`);
      return [];
    }
    return v;
  };
  const strings = (v: unknown, p: string, nullable = false) => {
    if (nullable && v === null) return;
    const list = array(v, p, 100);
    list.forEach((x) => text(x, p, true, 300));
    if (new Set(list).size !== list.length) error(p, 'Duplicate values.');
  };
  const values = (v: unknown, p: string, keys: readonly string[]) => {
    const o = object(v, p, [...keys]);
    keys.forEach((k) => number(o[k], `${p}.${k}`));
  };
  const source = (v: unknown, p: string) => {
    const o = object(v, p, ['field', 'status', 'reference', 'note']);
    text(o.field, `${p}.field`);
    enumeration(o.status, `${p}.status`, ['user-entered', 'source-documented']);
    text(o.reference, `${p}.reference`);
    text(o.note, `${p}.note`);
    if (
      o.status === 'source-documented' &&
      (typeof o.reference !== 'string' || !o.reference.trim())
    )
      error(
        p,
        'Source-documented needs a readable reference; this is not independent verification.',
      );
  };
  let conditionNodes = 0;
  const condition = (v: unknown, p: string, depth: number) => {
    if (
      ++conditionNodes > LIMITS.conditionNodes ||
      depth > LIMITS.conditionDepth
    ) {
      error(p, 'Condition tree exceeds node/depth limit.');
      return;
    }
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      error(p, 'Expected a condition.');
      return;
    }
    const c = v as Obj;
    if (c.kind === 'always') object(v, p, ['kind']);
    else if (c.kind === 'all' || c.kind === 'any') {
      const o = object(v, p, ['kind', 'children']);
      const list = array(o.children, `${p}.children`, 12);
      if (!list.length) error(p, 'AND/OR needs at least one child.');
      list.forEach((x, i) => condition(x, `${p}.${i}`, depth + 1));
    } else if (c.kind === 'threshold') {
      const o = object(v, p, ['kind', 'field', 'operator', 'value']);
      enumeration(o.field, p, Object.keys(CONTEXT_FIELDS));
      enumeration(o.operator, p, OPERATORS);
      const spec = CONTEXT_FIELDS[o.field as keyof typeof CONTEXT_FIELDS];
      if (spec) number(o.value, p, false, spec.min, spec.max, spec.integer);
    } else if (c.kind === 'ally') {
      const o = object(v, p, [
        'kind',
        'scope',
        'includeSelf',
        'match',
        'value',
        'minimum',
      ]);
      enumeration(o.scope, p, ['team', 'rotation']);
      enumeration(o.includeSelf, p, [true, false]);
      enumeration(o.match, p, ['name', 'category', 'type']);
      text(o.value, p, true, 300);
      number(o.minimum, p, false);
    } else if (c.kind === 'state') {
      const o = object(v, p, ['kind', 'value']);
      text(o.value, p, true, 300);
    } else if (c.kind === 'other') {
      const o = object(v, p, ['kind', 'description']);
      text(o.description, p, true);
    } else
      error(
        p,
        'Unknown condition kind; use Other to record unsupported wording.',
      );
  };

  const root = object(input, 'library', ['schemaVersion', 'documents']);
  if (root.schemaVersion !== 1)
    error(
      'schemaVersion',
      'Only version 1 is supported. Newer versions are never downgraded.',
    );
  const documents = array(root.documents, 'documents', LIMITS.documents);
  const revisions = new Set<string>();
  const identities = new Map<string, string>();
  const awakeningKinds = new Map<string, unknown>();
  const awakeningSteps = new Map<string, unknown>();
  const relationTargets: { from: string; to: unknown }[] = [];
  documents.forEach((doc, index) => {
    const p = `documents[${index}]`;
    const d = object(doc, p, [
      'definition',
      'configurations',
      'equipment',
      'baselineId',
      'context',
    ]);
    const c = object(d.definition, `${p}.definition`, [
      'id',
      'cardId',
      'revision',
      'origin',
      'name',
      'title',
      'type',
      'rarity',
      'level',
      'superAttackLevel',
      'awakening',
      'region',
      'gameVersion',
      'rawStats',
      'links',
      'categories',
      'relations',
      'sourceBinding',
      'sourceNotes',
      'notes',
      'abilities',
    ]);
    id(c.id, `${p}.id`);
    id(c.cardId, `${p}.cardId`);
    number(c.revision, p, false, 1);
    enumeration(c.origin, p, ['user']);
    text(c.name, `${p}.name`, true, 300);
    text(c.title, p, false, 300);
    enumeration(c.type, p, TYPES, true);
    enumeration(c.rarity, p, RARITIES, true);
    number(c.level, p, true, 1);
    number(c.superAttackLevel, p, true, 1);
    const aw = object(c.awakening, p, ['kind', 'step']);
    enumeration(aw.kind, p, AWAKENINGS);
    number(aw.step, p);
    text(c.region, p, false, 300);
    text(c.gameVersion, p, false, 300);
    text(c.notes, p);
    values(c.rawStats, `${p}.rawStats`, STATS);
    strings(c.links, p, true);
    strings(c.categories, p, true);
    const identity = typeof c.id === 'string' ? c.id : '<invalid>',
      revisionKey = `${identity}@${typeof c.revision === 'number' ? c.revision : '<invalid>'}`;
    if (revisions.has(revisionKey)) error(p, 'Duplicate state/revision.');
    revisions.add(revisionKey);
    if (identities.has(identity) && identities.get(identity) !== c.cardId)
      error(p, 'A state ID cannot move to a different card across revisions.');
    identities.set(
      identity,
      typeof c.cardId === 'string' ? c.cardId : '<invalid>',
    );
    if (aw.kind !== 'unknown') {
      if (
        awakeningKinds.has(identity) &&
        awakeningKinds.get(identity) !== aw.kind
      )
        error(
          p,
          'Base/EZA/SEZA states need distinct state IDs. Duplicate as another state instead of revising an awakening identity.',
        );
      awakeningKinds.set(identity, aw.kind);
      if (aw.step !== null) {
        if (
          awakeningSteps.has(identity) &&
          awakeningSteps.get(identity) !== aw.step
        )
          error(p, 'A different awakening step needs a distinct state ID.');
        awakeningSteps.set(identity, aw.step);
      }
    }
    if (c.sourceBinding !== null) {
      const b = object(c.sourceBinding, p, [
        'cardId',
        'stateId',
        'catalogRevision',
      ]);
      id(b.cardId, p);
      id(b.stateId, p);
      text(b.catalogRevision, p, true, 300);
    }
    array(c.sourceNotes, p, 100).forEach((s) => source(s, p));
    array(c.relations, p, 40).forEach((v) => {
      const r = object(v, p, ['kind', 'targetId', 'note']);
      enumeration(r.kind, p, [
        'awakens-from',
        'transforms-to',
        'exchanges-with',
        'alternate',
      ]);
      id(r.targetId, p);
      text(r.note, p);
      relationTargets.push({ from: identity, to: r.targetId });
    });
    const effectIds = new Set<unknown>();
    const dependencies: { from: unknown; to: unknown[] }[] = [];
    let effectCount = 0;
    const abilityIds = new Set<unknown>();
    array(c.abilities, p, LIMITS.abilities).forEach((value, ai) => {
      const ap = `${p}.abilities[${ai}]`;
      const a = object(value, ap, ['id', 'name', 'kind', 'wording', 'effects']);
      id(a.id, ap);
      if (abilityIds.has(a.id)) error(ap, 'Duplicate ability ID.');
      abilityIds.add(a.id);
      text(a.name, ap, true, 300);
      text(a.wording, ap);
      enumeration(a.kind, ap, ABILITIES);
      array(a.effects, ap, LIMITS.effects).forEach((value, ei) => {
        if (++effectCount > LIMITS.effects) {
          error(ap, 'Too many effects.');
          return;
        }
        const ep = `${ap}.effects[${ei}]`;
        const e = object(value, ep, [
          'id',
          'label',
          'family',
          'representation',
          'target',
          'stat',
          'amount',
          'unit',
          'condition',
          'timing',
          'duration',
          'stacking',
          'cap',
          'reset',
          'dependencies',
          'description',
          'source',
        ]);
        id(e.id, ep);
        if (effectIds.has(e.id)) error(ep, 'Duplicate effect ID.');
        effectIds.add(e.id);
        text(e.label, ep, true, 300);
        enumeration(e.family, ep, FAMILIES);
        enumeration(e.representation, ep, ['recorded-only', 'structured']);
        enumeration(e.target, ep, [
          'self',
          'allies-including-self',
          'other-allies',
          'enemy',
          'other',
        ]);
        enumeration(e.stat, ep, STATS, true);
        enumeration(e.unit, ep, [
          'flat',
          'percent',
          'probability',
          'count',
          'unknown',
        ]);
        number(
          e.amount,
          `${ep}.amount`,
          true,
          e.unit === 'probability' ? 0 : -Number.MAX_SAFE_INTEGER,
          e.unit === 'probability' ? 100 : Number.MAX_SAFE_INTEGER,
          e.unit !== 'percent' && e.unit !== 'probability',
        );
        conditionNodes = 0;
        condition(e.condition, `${ep}.condition`, 0);
        enumeration(e.timing, ep, PHASES);
        const duration = object(e.duration, ep, ['kind', 'count']);
        enumeration(duration.kind, ep, [
          'snapshot',
          'turns',
          'appearances',
          'permanent',
          'other',
        ]);
        number(duration.count, ep, true, 1);
        if (
          (duration.kind === 'turns' || duration.kind === 'appearances') &&
          duration.count === null
        )
          error(ep, 'A counted duration needs its count.');
        if (
          duration.kind !== 'turns' &&
          duration.kind !== 'appearances' &&
          duration.count !== null
        )
          error(ep, 'Only turn/appearance durations accept a count.');
        enumeration(e.stacking, ep, [
          'once',
          'additive',
          'multiplicative',
          'unknown',
        ]);
        number(e.cap, ep);
        text(e.reset, ep);
        text(e.description, ep);
        const deps = array(e.dependencies, ep, LIMITS.effects);
        deps.forEach((x) => id(x, ep));
        dependencies.push({ from: e.id, to: deps });
        source(e.source, ep);
      });
    });
    dependencies.forEach(({ to }) =>
      to.forEach((target) => {
        if (!effectIds.has(target)) error(p, 'Unknown effect dependency.');
      }),
    );
    const deps = new Map(dependencies.map((d) => [d.from, d.to]));
    // The graph is small; visited-path memoization is unnecessary but bound walks.
    const visiting = new Set<unknown>(),
      done = new Set<unknown>();
    const cycle = (key: unknown): boolean => {
      if (visiting.has(key)) return true;
      if (done.has(key)) return false;
      visiting.add(key);
      for (const to of deps.get(key) ?? []) if (cycle(to)) return true;
      visiting.delete(key);
      done.add(key);
      return false;
    };
    if ([...deps.keys()].some(cycle)) error(p, 'Cyclic effect dependencies.');
    const equipIds = new Set<unknown>();
    array(d.equipment, p, LIMITS.equipment).forEach((value) => {
      const e = object(value, p, [
        'id',
        'name',
        'slot',
        'stats',
        'skills',
        'requirements',
        'otherEffects',
        'source',
      ]);
      id(e.id, p);
      if (equipIds.has(e.id)) error(p, 'Duplicate equipment ID.');
      equipIds.add(e.id);
      text(e.name, p, true, 300);
      enumeration(e.slot, p, SLOTS);
      values(e.stats, p, STATS);
      values(e.skills, p, SKILLS);
      source(e.source, p);
      text(e.otherEffects, p);
      array(e.requirements, p, 20).forEach((value) => {
        const r = value as Obj;
        if (
          r &&
          typeof r.kind === 'string' &&
          ['type', 'category', 'state'].includes(r.kind)
        ) {
          const o = object(value, p, ['kind', 'value']);
          text(o.value, p, true, 300);
        } else if (r && (r.kind === 'routes' || r.kind === 'sa')) {
          const o = object(value, p, ['kind', 'minimum']);
          number(
            o.minimum,
            p,
            false,
            0,
            r.kind === 'routes' ? 4 : Number.MAX_SAFE_INTEGER,
          );
        } else if (r?.kind === 'other') {
          const o = object(value, p, ['kind', 'description']);
          text(o.description, p, true);
        } else error(p, 'Unknown equipment requirement.');
      });
    });
    const buildIds = new Set<unknown>();
    const configs = array(d.configurations, p, LIMITS.configurations);
    if (!configs.length) error(p, 'At least one configuration is required.');
    configs.forEach((value) => {
      const b = object(value, p, [
        'id',
        'name',
        'mode',
        'potentialStats',
        'skills',
        'unlockedRoutes',
        'slots',
        'equips',
        'notes',
      ]);
      id(b.id, p);
      if (buildIds.has(b.id)) error(p, 'Duplicate build ID.');
      buildIds.add(b.id);
      text(b.name, p, true, 300);
      enumeration(b.mode, p, ['custom']);
      values(b.potentialStats, p, STATS);
      values(b.skills, p, SKILLS);
      number(b.unlockedRoutes, p, true, 0, 4);
      text(b.notes, p);
      const slots = object(b.slots, p, [...SLOTS]),
        equips = object(b.equips, p, [...SLOTS]);
      SLOTS.forEach((slot) => {
        enumeration(slots[slot], p, ['available', 'unavailable', 'unknown']);
        if (equips[slot] !== null && !equipIds.has(equips[slot]))
          error(p, 'Unknown equipped-item reference.');
      });
    });
    if (!buildIds.has(d.baselineId))
      error(p, 'Current-build reference is missing.');
    const ctx = object(d.context, p, [
      'provenance',
      'phase',
      'values',
      'allies',
      'state',
    ]);
    enumeration(ctx.provenance, p, ['manual']);
    enumeration(ctx.phase, p, PHASES);
    if (ctx.state !== null) text(ctx.state, p, true, 300);
    const contextValues = ctx.values;
    if (
      !contextValues ||
      typeof contextValues !== 'object' ||
      Array.isArray(contextValues)
    )
      error(p, 'Context values must be an object.');
    else
      Object.entries(contextValues).forEach(([key, value]) => {
        const spec = CONTEXT_FIELDS[key as keyof typeof CONTEXT_FIELDS];
        if (!spec) error(p, 'Unknown context value.');
        else number(value, p, true, spec.min, spec.max, spec.integer);
      });
    const allyKeys = new Set<string>();
    array(ctx.allies, p, 64).forEach((value) => {
      const a = object(value, p, [
        'scope',
        'includeSelf',
        'match',
        'value',
        'count',
      ]);
      enumeration(a.scope, p, ['team', 'rotation']);
      enumeration(a.includeSelf, p, [true, false]);
      enumeration(a.match, p, ['name', 'category', 'type']);
      text(a.value, p, true, 300);
      number(a.count, p);
      const key = JSON.stringify([a.scope, a.includeSelf, a.match, a.value]);
      if (allyKeys.has(key)) error(p, 'Duplicate ally-context key.');
      allyKeys.add(key);
    });
  });
  relationTargets.forEach((r) => {
    if (r.from === r.to || typeof r.to !== 'string' || !identities.has(r.to))
      error(
        'relations',
        'Form/state relation must reference another authored state in the library.',
      );
  });
  // Only serialize after the closed schema has rejected executable/non-data
  // fields. The same byte limit applies to merged imports and stored libraries.
  if (
    !errors.length &&
    new TextEncoder().encode(JSON.stringify(input)).byteLength > LIMITS.bytes
  )
    error(
      'library',
      'Combined library exceeds the 1 MiB limit. Export a backup before starting a separate library.',
    );
  return errors.length
    ? { ok: false, errors }
    : { ok: true, library: structuredClone(input) as DefinitionLibrary };
}

export function parseLibrary(text: string): Validation {
  if (new TextEncoder().encode(text).byteLength > LIMITS.bytes)
    return { ok: false, errors: ['File exceeds the 1 MiB input limit.'] };
  try {
    return validateLibrary(JSON.parse(text));
  } catch {
    return { ok: false, errors: ['Unreadable JSON; no records were changed.'] };
  }
}
