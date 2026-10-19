import { describe, expect, it } from 'vitest';
import { catalogSnapshot } from '../data/real/catalog';
import { productionRegistry } from '../data/real/character-build/registry';
import { compareBuilds } from '../character-build/comparison';
import { copyCatalogState } from './catalog-copy';
import { newEffect, type Condition, type DefinitionLibrary } from './domain';
import {
  compareDefinitions,
  configurationChanges,
  equipmentChecks,
  evaluateDefinition,
  inspectCondition,
  inspectEffect,
  metricValue,
  requiredConditions,
} from './evaluation';
import {
  alternative,
  equipment,
  example,
  unknownBuild,
  withEffect,
} from './definition.fixtures';
import {
  DEFINITION_KEY,
  appendRevision,
  duplicateDocument,
  latestDocuments,
  loadDefinitions,
  planImport,
  writeDefinitions,
} from './library';
import { LIMITS, parseLibrary, validateLibrary } from './validation';

const library = (
  ...documents: ReturnType<typeof example>[]
): DefinitionLibrary => ({ schemaVersion: 1, documents });
const context = () => example().context;
const threshold: Condition = {
  kind: 'threshold',
  field: 'hpPercent',
  operator: '>=',
  value: 50,
};
const check = (doc = example()) => validateLibrary(library(doc));

describe('definition contract and identities', () => {
  it('does not revise a known base state into EZA under the same ID', () => {
    const a = example(),
      b = example();
    a.definition.awakening.kind = 'base';
    b.definition.awakening.kind = 'eza';
    b.definition.revision = 2;
    expect(validateLibrary(library(a, b)).ok).toBe(false);
  });
  it('rejects executable values and accessors without invoking them', () => {
    let accessed = false;
    const data = { schemaVersion: 1, documents: [] };
    Object.defineProperty(data, 'run', {
      get: () => {
        accessed = true;
        return [];
      },
      enumerable: true,
    });
    expect(validateLibrary(data).ok).toBe(false);
    expect(accessed).toBe(false);
    expect(
      validateLibrary({ schemaVersion: 1, documents: [], execute: () => {} })
        .ok,
    ).toBe(false);
  });
  it('admits reusable authored definitions with unknown fields', () => {
    const d = example();
    d.definition.level = null;
    d.definition.links = null;
    withEffect(d, {
      family: 'other',
      representation: 'recorded-only',
      amount: null,
      stat: null,
      description: 'Unmodeled ability.',
    });
    expect(check(d).ok).toBe(true);
  });
  it('keeps base/EZA/SEZA exact states separate while sharing a card ID', () => {
    const base = example(),
      eza = example(),
      seza = example();
    base.definition.awakening.kind = 'base';
    eza.definition.id = 'test:eza';
    eza.definition.awakening.kind = 'eza';
    seza.definition.id = 'test:seza';
    seza.definition.awakening.kind = 'seza';
    const r = validateLibrary(library(base, eza, seza));
    expect(r.ok).toBe(true);
    expect(
      latestDocuments(library(base, eza, seza)).map((d) => d.definition.id),
    ).toEqual(['test:state', 'test:eza', 'test:seza']);
  });
  it('does not admit user imports as bundled source records', () => {
    const d = example();
    (d.definition as { origin: string }).origin = 'admitted-records';
    expect(check(d).ok).toBe(false);
  });
  it('requires explicit revision identities and rejects card reassignment', () => {
    const d = example(),
      next = structuredClone(d);
    next.definition.revision = 2;
    next.definition.cardId = 'test:different-card';
    expect(validateLibrary(library(d, next)).ok).toBe(false);
    expect(validateLibrary(library(d, structuredClone(d))).ok).toBe(false);
  });
  it('does not convert unknown collections to empty lists', () => {
    const d = example();
    d.definition.links = null;
    const r = check(d);
    expect(r.ok && r.library.documents[0]!.definition.links).toBe(null);
  });
  it('uses safe-integer bounds, not guessed game maxima', () => {
    const d = example();
    d.configurations[0]!.skills.additional = 1000;
    d.definition.rawStats.hp = 999_999;
    expect(check(d).ok).toBe(true);
    d.definition.rawStats.hp = Number.MAX_SAFE_INTEGER + 1;
    expect(check(d).ok).toBe(false);
  });
  it.each([-1, 1.5, Infinity, NaN])('rejects invalid raw stat %s', (value) => {
    const d = example();
    d.definition.rawStats.attack = value;
    expect(check(d).ok).toBe(false);
  });
  it('rejects unknown schema versions without migrating them', () => {
    expect(parseLibrary('{"schemaVersion":2,"documents":[]}').ok).toBe(false);
  });
  it('rejects excess input bytes before parsing', () => {
    expect(parseLibrary(' '.repeat(LIMITS.bytes + 1))).toEqual({
      ok: false,
      errors: ['File exceeds the 1 MiB input limit.'],
    });
  });
  it('rejects oversized record counts', () => {
    expect(
      validateLibrary({
        schemaVersion: 1,
        documents: Array.from({ length: 101 }, example),
      }).ok,
    ).toBe(false);
  });
  it.each(['__proto__', 'constructor', 'prototype'])(
    'rejects prototype field %s',
    (key) => {
      expect(
        parseLibrary(`{"schemaVersion":1,"documents":[],"${key}":{}}`).ok,
      ).toBe(false);
    },
  );
  it('rejects unknown keys and unsafe IDs', () => {
    const d = example();
    (d as unknown as Record<string, unknown>).execute = 'anything';
    expect(check(d).ok).toBe(false);
    delete (d as unknown as Record<string, unknown>).execute;
    d.definition.id = '<script>';
    expect(check(d).ok).toBe(false);
  });
  it('rejects malformed effect fields', () => {
    const d = example();
    const e = withEffect(d);
    (e as unknown as Record<string, unknown>).formula = 'alert(1)';
    expect(check(d).ok).toBe(false);
  });
  it('requires citations for a source-documented assertion', () => {
    const d = example();
    const e = withEffect(d);
    e.source.status = 'source-documented';
    expect(check(d).ok).toBe(false);
    e.source.reference = 'User-provided source page, section 2';
    expect(check(d).ok).toBe(true);
  });
  it('rejects unknown item, baseline and form references', () => {
    const d = example();
    d.configurations[0]!.equips.bronze = 'test:absent';
    expect(check(d).ok).toBe(false);
    d.configurations[0]!.equips.bronze = null;
    d.baselineId = 'test:absent';
    expect(check(d).ok).toBe(false);
    d.baselineId = d.configurations[0]!.id;
    d.definition.relations = [
      { kind: 'alternate', targetId: 'test:absent', note: '' },
    ];
    expect(check(d).ok).toBe(false);
  });
  it('rejects unknown and cyclic effect dependencies', () => {
    const d = example();
    const a = withEffect(d),
      b = withEffect(d);
    a.dependencies = ['test:absent'];
    expect(check(d).ok).toBe(false);
    a.dependencies = [b.id];
    b.dependencies = [a.id];
    expect(check(d).ok).toBe(false);
  });
  it('rejects empty and over-nested AND/OR groups', () => {
    const d = example();
    const e = withEffect(d);
    e.condition = { kind: 'all', children: [] };
    expect(check(d).ok).toBe(false);
    let c: Condition = { kind: 'always' };
    for (let i = 0; i < 8; i++) c = { kind: 'all', children: [c] };
    e.condition = c;
    expect(check(d).ok).toBe(false);
  });
  it('bounds deeply nested unknown data before recursive validation', () => {
    let data: unknown = {};
    for (let i = 0; i < 100; i++) data = { x: data };
    expect(validateLibrary(data).ok).toBe(false);
  });
  it('requires duration counts and bounds routes and HP context explicitly', () => {
    const d = example();
    const e = withEffect(d);
    e.duration = { kind: 'turns', count: null };
    expect(check(d).ok).toBe(false);
    e.duration.count = 3;
    d.configurations[0]!.unlockedRoutes = 5;
    expect(check(d).ok).toBe(false);
    d.configurations[0]!.unlockedRoutes = 4;
    d.context.values.hpPercent = 101;
    expect(check(d).ok).toBe(false);
  });
  it('keeps zero distinct from unknown on round trip', () => {
    const d = example();
    d.definition.rawStats.hp = 0;
    d.configurations[0]!.potentialStats.hp = null;
    const r = parseLibrary(JSON.stringify(library(d)));
    expect(r.ok && r.library.documents[0]!.definition.rawStats.hp).toBe(0);
    expect(
      r.ok && r.library.documents[0]!.configurations[0]!.potentialStats.hp,
    ).toBe(null);
  });
});

describe('manual conditions and capability coverage', () => {
  it.each([
    [49, 'unmet'],
    [50, 'met'],
    [51, 'met'],
  ] as const)('HP threshold boundary %s', (hp, expected) => {
    const c = context();
    c.values.hpPercent = hp;
    expect(inspectCondition(threshold, c).state).toBe(expected);
  });
  it('does not assume unknown HP is zero', () =>
    expect(inspectCondition(threshold, context()).state).toBe('unknown'));
  it('evaluates nested AND/OR with three-valued unknowns', () => {
    const c = context();
    c.values.hpPercent = 60;
    const unknown: Condition = { kind: 'other', description: 'Unimplemented' };
    expect(
      inspectCondition({ kind: 'all', children: [threshold, unknown] }, c)
        .state,
    ).toBe('unknown');
    expect(
      inspectCondition({ kind: 'any', children: [threshold, unknown] }, c)
        .state,
    ).toBe('met');
    c.values.hpPercent = 40;
    expect(
      inspectCondition({ kind: 'all', children: [threshold, unknown] }, c)
        .state,
    ).toBe('unmet');
    expect(
      inspectCondition({ kind: 'any', children: [threshold, unknown] }, c)
        .state,
    ).toBe('unknown');
  });
  it('does not equate turns with appearances', () => {
    const c = context();
    c.values.battleTurn = 5;
    c.values.appearance = 2;
    expect(
      inspectCondition(
        { kind: 'threshold', field: 'battleTurn', operator: '>=', value: 3 },
        c,
      ).state,
    ).toBe('met');
    expect(
      inspectCondition(
        { kind: 'threshold', field: 'appearance', operator: '>=', value: 3 },
        c,
      ).state,
    ).toBe('unmet');
  });
  it('distinguishes team/rotation and self/other allies', () => {
    const c = context();
    c.allies = [
      {
        scope: 'team',
        includeSelf: true,
        match: 'category',
        value: 'Test',
        count: 3,
      },
    ];
    const condition: Condition = {
      kind: 'ally',
      scope: 'team',
      includeSelf: true,
      match: 'category',
      value: 'Test',
      minimum: 3,
    };
    expect(inspectCondition(condition, c).state).toBe('met');
    expect(
      inspectCondition({ ...condition, includeSelf: false }, c).state,
    ).toBe('unknown');
    expect(inspectCondition({ ...condition, scope: 'rotation' }, c).state).toBe(
      'unknown',
    );
  });
  it('requires an explicit exact form/state context', () => {
    const c = context();
    expect(
      inspectCondition({ kind: 'state', value: 'Transformed' }, c).state,
    ).toBe('unknown');
    c.state = 'Base';
    expect(
      inspectCondition({ kind: 'state', value: 'Transformed' }, c).state,
    ).toBe('unmet');
  });
  it('separates recorded, structured, implemented and supported states', () => {
    const e = newEffect('test:effect');
    expect(inspectEffect(e, context())).toMatchObject({
      recorded: true,
      structured: true,
      implemented: true,
      supported: false,
    });
    e.amount = 3;
    expect(inspectEffect(e, context()).supported).toBe(true);
    e.family = 'guard';
    expect(inspectEffect(e, context())).toMatchObject({
      structured: true,
      implemented: false,
      supported: false,
    });
    e.representation = 'recorded-only';
    expect(inspectEffect(e, context()).structured).toBe(false);
  });
  it('requires the declared timing and does not infer history for durations', () => {
    const e = newEffect('test:effect');
    e.amount = 2;
    e.timing = 'before-attack';
    const c = context();
    expect(inspectEffect(e, c).supported).toBe(false);
    c.phase = 'before-attack';
    expect(inspectEffect(e, c).supported).toBe(true);
    e.duration = { kind: 'turns', count: 3 };
    expect(inspectEffect(e, c).supported).toBe(false);
  });
  it.each(['cap', 'reset', 'dependencies', 'stacking'] as const)(
    'does not execute unsupported %s',
    (key) => {
      const e = newEffect('test:e');
      e.amount = 2;
      if (key === 'cap') e.cap = 5;
      else if (key === 'reset') e.reset = 'each turn';
      else if (key === 'dependencies') e.dependencies = ['test:other'];
      else e.stacking = 'additive';
      expect(inspectEffect(e, context()).supported).toBe(false);
    },
  );
  it('discovers only explicit required context values', () => {
    const d = example();
    withEffect(d, {
      condition: {
        kind: 'all',
        children: [
          threshold,
          {
            kind: 'threshold',
            field: 'attacksReceived',
            operator: '>=',
            value: 2,
          },
        ],
      },
    });
    expect(requiredConditions(d)).toEqual([
      threshold,
      { kind: 'threshold', field: 'attacksReceived', operator: '>=', value: 2 },
    ]);
  });
});

describe('independent arithmetic and traces, not combat tests', () => {
  it('records additional equipment mechanics instead of silently dropping them', () => {
    const d = example(),
      item = equipment();
    item.otherEffects = 'Unmodeled equip mechanic';
    d.equipment = [item];
    d.configurations[0]!.equips.bronze = item.id;
    const e = evaluateDefinition(d, d.configurations[0]!);
    expect(e.layers.preEffect.attack).toBe(222);
    expect(e.layers.modeled.attack).toBe(null);
    expect(e.unstructuredAbilities).toEqual([
      'Equipment TEST ONLY equip: Unmodeled equip mechanic',
    ]);
  });
  it('adds raw 200 + potential 20 + equip 2 + effect 7 = 229', () => {
    const d = example();
    d.equipment.push(equipment());
    d.configurations[0]!.equips.bronze = 'test:equip';
    withEffect(d);
    const e = evaluateDefinition(d, d.configurations[0]!);
    expect(e.layers.preEffect).toEqual({ hp: 111, attack: 222, defense: 333 });
    expect(e.layers.modeled).toEqual({ hp: 111, attack: 229, defense: 333 });
    expect(e.skills).toEqual({ additional: 4, critical: 4, evasion: 5 });
    expect(
      e.trace.filter((t) => t.stat === 'attack').map((t) => t.value),
    ).toEqual([200, 20, 2, 7]);
  });
  it('traces sum to each computed supported result', () => {
    const d = example();
    withEffect(d, { stat: 'hp', amount: 5 });
    withEffect(d, { stat: 'attack', amount: -10 });
    const e = evaluateDefinition(d, d.configurations[0]!);
    expect(e.layers.modeled).toEqual({ hp: 115, attack: 210, defense: 330 });
    expect(
      e.trace.filter((t) => t.stat === 'hp').reduce((n, t) => n + t.value!, 0),
    ).toBe(115);
    expect(
      e.trace
        .filter((t) => t.stat === 'attack')
        .reduce((n, t) => n + t.value!, 0),
    ).toBe(210);
  });
  it('activates a conditional addition only when its explicit threshold is met', () => {
    const d = example();
    withEffect(d, { amount: 50, condition: threshold });
    d.context.values.hpPercent = 49;
    expect(
      evaluateDefinition(d, d.configurations[0]!).layers.modeled.attack,
    ).toBe(220);
    d.context.values.hpPercent = 50;
    expect(
      evaluateDefinition(d, d.configurations[0]!).layers.modeled.attack,
    ).toBe(270);
    delete d.context.values.hpPercent;
    expect(
      evaluateDefinition(d, d.configurations[0]!).layers.modeled.attack,
    ).toBe(null);
  });
  it('missing values propagate instead of becoming zero', () => {
    const d = example();
    d.definition.rawStats.hp = null;
    d.configurations[0]!.potentialStats.attack = null;
    const e = evaluateDefinition(d, d.configurations[0]!);
    expect(e.layers.preEffect).toEqual({
      hp: null,
      attack: null,
      defense: 330,
    });
  });
  it('recorded-only or unknown effects block affected modeled metrics, not all browsing', () => {
    const d = example();
    withEffect(d, { family: 'percent-stat', unit: 'percent', amount: 50 });
    const e = evaluateDefinition(d, d.configurations[0]!);
    expect(e.layers.modeled).toEqual({ hp: 110, attack: null, defense: 330 });
    expect(e.layers.preEffect.attack).toBe(220);
    withEffect(d, {
      family: 'other',
      stat: null,
      representation: 'recorded-only',
    });
    expect(evaluateDefinition(d, d.configurations[0]!).layers.modeled).toEqual({
      hp: null,
      attack: null,
      defense: null,
    });
    expect(check(d).ok).toBe(true);
  });
  it('never treats an unstructured ability as no effects', () => {
    const d = example();
    d.definition.abilities.push({
      id: 'test:a',
      name: 'Unparsed passive',
      kind: 'passive',
      wording: 'Recorded',
      effects: [],
    });
    const e = evaluateDefinition(d, d.configurations[0]!);
    expect(e.unstructuredAbilities).toEqual(['Unparsed passive']);
    expect(e.layers.modeled.attack).toBe(null);
    expect(e.layers.preEffect.attack).toBe(220);
  });
  it('does not clamp overflow or negative totals', () => {
    const d = example();
    d.definition.rawStats.attack = Number.MAX_SAFE_INTEGER;
    expect(
      evaluateDefinition(d, d.configurations[0]!).layers.preEffect.attack,
    ).toBe(null);
    d.definition.rawStats.attack = 0;
    withEffect(d, { amount: -100 });
    expect(
      evaluateDefinition(d, d.configurations[0]!).layers.modeled.attack,
    ).toBe(null);
  });
  it('has no Goku evaluator fallback and no probability conversion for custom totals', () => {
    const d = example();
    d.configurations[0]!.skills.additional = 1000;
    const e = evaluateDefinition(d, d.configurations[0]!);
    expect(e.key).toContain('test:state');
    expect(e.skills.additional).toBe(1000);
    expect(e.unavailable).toContain(
      'Critical/AA/evasion probabilities for authored definitions',
    );
    expect(e).not.toHaveProperty('probabilities');
  });
});

describe('equipment requirements', () => {
  it('reports the exact checks and a compatible entered item', () => {
    const d = example();
    expect(
      equipmentChecks(
        equipment(),
        'bronze',
        d.definition,
        d.configurations[0]!,
      ),
    ).toEqual([]);
  });
  it('rejects wrong slots and unavailable slots', () => {
    const d = example();
    expect(
      equipmentChecks(equipment(), 'gold', d.definition, d.configurations[0]!),
    ).toEqual([
      'Slot mismatch: TEST ONLY equip belongs in bronze.',
      'gold slot unavailable.',
    ]);
  });
  it('does not assume an unknown slot is available', () => {
    const d = example();
    const e = equipment();
    e.slot = 'silver';
    expect(
      equipmentChecks(e, 'silver', d.definition, d.configurations[0]!),
    ).toEqual(['silver slot availability unknown.']);
  });
  it('enforces type, category and exact-state restrictions', () => {
    const d = example();
    const e = equipment();
    e.requirements = [
      { kind: 'type', value: 'TEQ' },
      { kind: 'category', value: 'Missing' },
      { kind: 'state', value: 'test:other' },
    ];
    expect(
      equipmentChecks(e, 'bronze', d.definition, d.configurations[0]!),
    ).toEqual([
      'Character type restriction not met: TEQ.',
      'Character category restriction not met: Missing.',
      'Exact character state restriction not met.',
    ]);
  });
  it('distinguishes unknown categories from established empty categories', () => {
    const d = example(),
      e = equipment();
    e.requirements = [{ kind: 'category', value: 'Test' }];
    d.definition.categories = null;
    expect(
      equipmentChecks(e, 'bronze', d.definition, d.configurations[0]!),
    ).toEqual(['Character categories unknown.']);
    d.definition.categories = [];
    expect(
      equipmentChecks(e, 'bronze', d.definition, d.configurations[0]!),
    ).toEqual(['Character category restriction not met: Test.']);
  });
  it('checks unlocked routes and SA at their boundaries', () => {
    const d = example(),
      e = equipment();
    e.requirements = [
      { kind: 'routes', minimum: 2 },
      { kind: 'sa', minimum: 10 },
    ];
    expect(
      equipmentChecks(e, 'bronze', d.definition, d.configurations[0]!),
    ).toEqual(['Requires 2 unlocked routes; 0 entered.']);
    d.configurations[0]!.unlockedRoutes = 2;
    expect(
      equipmentChecks(e, 'bronze', d.definition, d.configurations[0]!),
    ).toEqual([]);
  });
  it('unsupported requirements cannot pass silently', () => {
    const d = example(),
      e = equipment();
    e.requirements = [{ kind: 'other', description: 'Unknown event gate' }];
    d.equipment = [e];
    d.configurations[0]!.equips.bronze = e.id;
    const evaluated = evaluateDefinition(d, d.configurations[0]!);
    expect(evaluated.equipmentProblems).toEqual([
      'Unsupported requirement: Unknown event gate',
    ]);
    expect(evaluated.layers.preEffect.attack).toBe(null);
  });
});

describe('comparisons preserve scope, alternatives and ties', () => {
  it('explains actual entered differences by name', () => {
    const d = example();
    const b = alternative(d);
    b.potentialStats.attack = 50;
    b.slots.silver = 'available';
    expect(configurationChanges(b, d.configurations[0]!, [])).toEqual([
      'Potential attack: 20 → 50.',
      'silver availability assertion: unknown → available.',
    ]);
  });
  it('compares baseline deltas with independently computed answers', () => {
    const d = example();
    alternative(d).potentialStats.attack = 42;
    const r = compareDefinitions(d, ['preEffect.attack']);
    expect(r.baseline.layers.preEffect.attack).toBe(220);
    const alt = r.groups[1]!;
    expect(metricValue(alt.evaluation, 'preEffect.attack')).toBe(242);
    expect(alt.deltas['preEffect.attack']).toEqual({
      absolute: 22,
      relative: 0.1,
    });
    expect(alt.frontier).toBe(true);
    expect(r.groups[0]!.frontier).toBe(false);
  });
  it('retains equivalent named configurations and objective ties', () => {
    const d = example();
    alternative(d);
    const r = compareDefinitions(d, ['preEffect.attack']);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.alternatives.map((b) => b.id)).toEqual([
      'test:current',
      'test:alternative',
    ]);
    expect(r.groups[0]!.frontier).toBe(true);
  });
  it('preserves non-dominated stat tradeoffs', () => {
    const d = example();
    const a = alternative(d);
    a.potentialStats.attack = 25;
    a.potentialStats.defense = 20;
    const r = compareDefinitions(d, ['preEffect.attack', 'preEffect.defense']);
    expect(r.groups.map((g) => g.frontier)).toEqual([true, true]);
  });
  it('uses a common metric set and missing values cannot create false dominance', () => {
    const d = example();
    const b = alternative(d);
    b.potentialStats.attack = null;
    b.potentialStats.defense = 40;
    const r = compareDefinitions(d, ['preEffect.attack', 'preEffect.defense']);
    expect(r.common).toEqual(['preEffect.defense']);
    expect(r.omitted).toEqual(['preEffect.attack']);
    const none = compareDefinitions(d, ['preEffect.attack']);
    expect(none.groups.every((g) => !g.frontier)).toBe(true);
  });
  it('keeps baseline in a truncated frontier pool', () => {
    const d = example();
    const alt = alternative(d);
    alt.potentialStats.attack = 50;
    d.baselineId = alt.id;
    const r = compareDefinitions(d, ['preEffect.attack'], 1);
    expect(r.search).toEqual({
      compared: 1,
      available: 2,
      limit: 1,
      truncated: true,
    });
    expect(r.groups[0]!.frontier).toBe(false);
  });
  it('does not compare across contexts or definitions', () => {
    const d = example();
    withEffect(d, { condition: threshold });
    d.context.values.hpPercent = 60;
    alternative(d);
    const r = compareDefinitions(d, ['modeled.attack']);
    expect(r.groups[0]!.alternatives).toHaveLength(2);
    const changed = structuredClone(d);
    changed.context.values.hpPercent = 40;
    expect(
      evaluateDefinition(changed, changed.configurations[0]!).key,
    ).not.toBe(r.baseline.key);
  });
  it('relative change is unavailable from zero baseline', () => {
    const d = example();
    d.definition.rawStats.attack = 0;
    d.configurations[0]!.potentialStats.attack = 0;
    alternative(d).potentialStats.attack = 10;
    expect(
      compareDefinitions(d, ['preEffect.attack']).groups[1]!.deltas[
        'preEffect.attack'
      ],
    ).toEqual({ absolute: 10, relative: null });
  });
  it('no hidden metric fallback when every value is unknown', () => {
    const d = example();
    d.configurations = [unknownBuild()];
    d.baselineId = 'test:unknown';
    expect(compareDefinitions(d, ['preEffect.attack']).common).toEqual([]);
  });
});

describe('versioned storage, immutable revisions and import plans', () => {
  it('will not directly write over an unreadable captured library', () => {
    const s = new Map([[DEFINITION_KEY, '{"schemaVersion":99}']]);
    const store = {
      getItem: (k: string) => s.get(k) ?? null,
      setItem: (k: string, v: string) => {
        s.set(k, v);
      },
    };
    expect(
      writeDefinitions(store, s.get(DEFINITION_KEY)!, library(example())).ok,
    ).toBe(false);
    expect(s.get(DEFINITION_KEY)).toBe('{"schemaVersion":99}');
  });
  it('does not bind imported relationships to a skipped conflicting state', () => {
    const old = example(),
      changed = example(),
      dependent = example();
    changed.definition.rawStats.hp = 999;
    dependent.definition.id = 'test:dependent';
    dependent.definition.relations = [
      { kind: 'alternate', targetId: changed.definition.id, note: '' },
    ];
    const r = planImport(
      library(old),
      library(changed, dependent),
      'skip',
      () => 'user:unused',
    );
    expect(r.errors.join(' ')).toContain('skipped conflicting state');
  });
  it('preserves shared card identity when copying related incoming states', () => {
    const old = example(),
      changed = example(),
      eza = example();
    changed.definition.rawStats.hp = 999;
    eza.definition.id = 'test:eza';
    eza.definition.awakening.kind = 'eza';
    let n = 0;
    const r = planImport(
      library(old),
      library(changed, eza),
      'copy',
      () => `user:${++n}`,
    );
    expect(r.errors).toEqual([]);
    expect(r.library.documents[1]!.definition.cardId).toBe(
      r.library.documents[2]!.definition.cardId,
    );
    expect(r.library.documents[0]!.definition.cardId).not.toBe(
      r.library.documents[1]!.definition.cardId,
    );
  });
  const memory = () => {
    const values = new Map<string, string>();
    return {
      values,
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
    };
  };
  it('saves a new revision without modifying previous snapshots', () => {
    const d = example(),
      old = JSON.stringify(d);
    const lib = library(d);
    const draft = structuredClone(d);
    draft.definition.rawStats.hp = 500;
    const next = appendRevision(lib, draft);
    expect(next.documents.map((d) => d.definition.revision)).toEqual([1, 2]);
    expect(JSON.stringify(lib.documents[0])).toBe(old);
    expect(latestDocuments(next)[0]!.definition.rawStats.hp).toBe(500);
  });
  it('duplicates under new state/card IDs while retaining independent configs', () => {
    const d = example();
    const copy = duplicateDocument(d, 'user:new-state', 'user:new-card');
    copy.configurations[0]!.potentialStats.hp = 500;
    expect(copy.definition.id).toBe('user:new-state');
    expect(copy.definition.cardId).toBe('user:new-card');
    expect(d.configurations[0]!.potentialStats.hp).toBe(10);
  });
  it('round-trips definitions and keeps every unrelated saved key unchanged', () => {
    const store = memory();
    store.setItem('dokkan.character-builds.v1', '{"old":"exact Goku bytes"}');
    store.setItem('dokkan.character-library.v1', 'named Goku build bytes');
    store.setItem('dokkan-team-lab.collection.v1', 'team bytes');
    expect(writeDefinitions(store, null, library(example())).ok).toBe(true);
    expect(loadDefinitions(store).library).toEqual(library(example()));
    expect(store.getItem('dokkan.character-builds.v1')).toBe(
      '{"old":"exact Goku bytes"}',
    );
    expect(store.getItem('dokkan.character-library.v1')).toBe(
      'named Goku build bytes',
    );
    expect(store.getItem('dokkan-team-lab.collection.v1')).toBe('team bytes');
  });
  it('protects unreadable/newer storage and blocked storage', () => {
    const store = memory();
    store.setItem(DEFINITION_KEY, '{"schemaVersion":2}');
    expect(loadDefinitions(store)).toMatchObject({
      writable: false,
      raw: '{"schemaVersion":2}',
    });
    const broken = {
      getItem: () => {
        throw Error('blocked');
      },
      setItem: () => {},
    };
    expect(loadDefinitions(broken).writable).toBe(false);
    expect(writeDefinitions(broken, null, library(example())).ok).toBe(false);
  });
  it('does not overwrite another tab’s changes', () => {
    const store = memory();
    store.setItem(DEFINITION_KEY, 'other tab');
    expect(writeDefinitions(store, null, library(example())).ok).toBe(false);
    expect(store.getItem(DEFINITION_KEY)).toBe('other tab');
  });
  it('previews identical duplicates without replacing them', () => {
    const a = library(example());
    const r = planImport(a, structuredClone(a), 'skip', () => 'user:new');
    expect(r.added).toEqual([]);
    expect(r.skipped).toHaveLength(1);
    expect(r.library).toEqual(a);
  });
  it('skips ID conflicts or explicitly copies them under new identities', () => {
    const a = library(example()),
      b = library(example());
    b.documents[0]!.definition.rawStats.attack = 999;
    const skipped = planImport(a, b, 'skip', () => 'user:unused');
    expect(skipped.library).toEqual(a);
    let n = 0;
    const copied = planImport(a, b, 'copy', () => `user:copy${++n}`);
    expect(copied.errors).toEqual([]);
    expect(copied.added).toHaveLength(1);
    expect(copied.library.documents[1]!.definition.id).toBe('user:copy1');
    expect(copied.library.documents[0]!.definition.rawStats.attack).toBe(200);
  });
  it('preserves multiple incoming revisions under one copied identity', () => {
    const old = library(example());
    const incoming = appendRevision(library(example()), example());
    incoming.documents[1]!.definition.rawStats.hp = 999;
    let n = 0;
    const r = planImport(old, incoming, 'copy', () => `user:id${++n}`);
    expect(r.errors).toEqual([]);
    expect(
      r.library.documents
        .slice(1)
        .map((d) => [d.definition.id, d.definition.revision]),
    ).toEqual([
      ['user:id1', 1],
      ['user:id1', 2],
    ]);
  });
  it('is detached from incoming objects', () => {
    const a = example();
    const r = parseLibrary(JSON.stringify(library(a)));
    if (!r.ok) throw Error('fixture');
    a.definition.rawStats.hp = 999;
    expect(r.library.documents[0]!.definition.rawStats.hp).toBe(100);
  });
});

describe('existing Goku compatibility and catalog copying', () => {
  it('copies facts into a user record without inferring formulas, skill totals or equipment', () => {
    const state = catalogSnapshot.states[0]!;
    const copy = copyCatalogState(catalogSnapshot, state.id, {
      state: 'user:copy',
      card: 'user:card',
      build: 'user:build',
    })!;
    expect(copy.definition.rawStats).toEqual({
      hp: 12527,
      attack: 11111,
      defense: 5796,
    });
    expect(copy.definition.origin).toBe('user');
    expect(copy.definition.sourceBinding?.stateId).toBe(state.id);
    expect(copy.equipment).toEqual([]);
    expect(copy.configurations[0]!.mode).toBe('custom');
    expect(copy.configurations[0]!.skills.additional).toBe(null);
    expect(copy.definition.abilities.every((a) => a.effects.length === 0)).toBe(
      true,
    );
    expect(check(copy).ok).toBe(true);
  });
  it('copies the recorded base state as its own state, never the EZA facts', () => {
    const copy = copyCatalogState(
      catalogSnapshot,
      'unknown-region:1003211:base:lv120:sa10',
      { state: 'user:base', card: 'user:card', build: 'user:build' },
    )!;
    const d = copy.definition;
    expect(d.rawStats).toEqual({ hp: 9500, attack: 8672, defense: 4623 });
    expect([d.level, d.superAttackLevel]).toEqual([120, 10]);
    expect(d.awakening).toEqual({ kind: 'base', step: null });
    // Unknown region stays unknown rather than borrowing "global-en".
    expect(d.region).toBe('');
    expect(d.sourceBinding?.stateId).toBe(
      'unknown-region:1003211:base:lv120:sa10',
    );
    expect(d.links).toBe(null);
    expect(d.categories).toBe(null);
    expect(d.abilities.map((a) => a.wording)).toEqual([
      'AGL Type Ki +3 and ATK +3000.',
      'Battle to the End: ATK +100% for 7 turns from the character’s entry turn.',
      'Dragon Fist (12 Ki): supreme damage to the enemy and lowers DEF.',
    ]);
    expect(d.abilities.every((a) => a.effects.length === 0)).toBe(true);
    expect(check(copy).ok).toBe(true);
  });
  it('never substitutes Goku when a requested source state is absent', () =>
    expect(
      copyCatalogState(catalogSnapshot, 'missing', {
        state: 'user:s',
        card: 'user:c',
        build: 'user:b',
      }),
    ).toBe(null));
  it('retains the source 55% regression result without making it the authored model', () => {
    const entry = productionRegistry[0]!;
    const r = compareBuilds(entry.defaults(), entry);
    expect(r.errors).toEqual([]);
    expect(r.search.evaluated).toBe(16);
    expect(r.current!.metrics.additionalSuper.value).toBeCloseTo(0.05);
    expect(r.current!.stats).toEqual({
      hp: 15327,
      attack: 13911,
      defense: 8596,
    });
  });
});
