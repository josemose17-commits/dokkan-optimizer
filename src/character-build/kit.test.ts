import { describe, expect, it } from 'vitest';
import { catalogSnapshot } from '../data/real/catalog';
import {
  gohanKit,
  GOHAN_STATE_ID,
} from '../data/real/character-build/gohan-kit';
import { gokuEntry } from '../data/real/character-build/registry';
import {
  guidanceContext,
  kitEffects,
  resolveKit,
  type ReviewedKit,
} from './kit';
import { inferAssignment } from './assignment';
import { kitGuidance } from './policy';
import { allocationSpace } from './allocation';
import { evidenceStatus, statLayers } from '../character-data/catalog';
import { inspectCondition } from '../character-definitions/evaluation';

const context = () => guidanceContext(GOHAN_STATE_ID);
const copy = () => structuredClone(gohanKit);
const change = (kit: ReviewedKit, id: string) =>
  kit.abilities.flatMap((a) => a.effects).find((e) => e.id === id)!;

describe('reviewed kit identity and evidence (not game-mechanics validation)', () => {
  it('binds only the exact Gohan state and never borrows the Goku evaluator', () => {
    expect(resolveKit(catalogSnapshot, [gohanKit], GOHAN_STATE_ID)).toEqual({
      ok: true,
      kit: gohanKit,
    });
    for (const id of [
      gokuEntry.stateId,
      GOHAN_STATE_ID.replace(':eza:', ':base:'),
      GOHAN_STATE_ID.replace(':eza:', ':seza:'),
      'missing',
    ])
      expect(resolveKit(catalogSnapshot, [gohanKit], id).ok).toBe(false);
    expect(
      resolveKit(catalogSnapshot, [gohanKit, gohanKit], GOHAN_STATE_ID).ok,
    ).toBe(false);
  });
  it.each([
    'card',
    'type',
    'level',
    'sa',
    'awakening',
    'step',
    'region',
    'version',
  ] as const)(
    'rejects a mismatched %s instead of matching by name',
    (field) => {
      const k = copy();
      if (field === 'card') k.cardId = gokuEntry.catalogCardId;
      if (field === 'type') k.identity.type = 'AGL';
      if (field === 'level') k.identity.level = 120;
      if (field === 'sa') k.identity.sa = 10;
      if (field === 'step') k.identity.step = 7;
      if (field === 'region') k.identity.region = 'global-en';
      if (field === 'version') k.identity.gameVersion = 'different-build';
      const s = structuredClone(catalogSnapshot);
      if (field === 'awakening')
        s.states.find((s) => s.id === GOHAN_STATE_ID)!.awakening.kind = 'seza';
      expect(resolveKit(s, [k], GOHAN_STATE_ID).ok).toBe(false);
    },
  );
  it('requires source references and unique effect IDs, not tests as independent confirmation', () => {
    const k = copy();
    change(k, 'gohan-guard').source.reference = '';
    expect(resolveKit(catalogSnapshot, [k], GOHAN_STATE_ID).ok).toBe(false);
    const duplicate = copy();
    duplicate.abilities[0]!.effects.push(duplicate.abilities[0]!.effects[0]!);
    expect(resolveKit(catalogSnapshot, [duplicate], GOHAN_STATE_ID).ok).toBe(
      false,
    );
    expect(
      gohanKit.references.every((r) => r.independentConfirmation === null),
    ).toBe(true);
  });
  it('keeps unknown stats, region and EZA step unknown; no 55% Goku profile leaks into Gohan', () => {
    const state = catalogSnapshot.states.find((s) => s.id === GOHAN_STATE_ID)!;
    expect([
      state.region,
      state.awakening.step,
      state.fields.rawStats.value,
    ]).toEqual([null, null, null]);
    expect(state.potentialProfiles).toEqual([]);
    // null profile means explicitly no additions applied, not unknown totals.
    expect(
      statLayers(state, null, { hp: 0, attack: 0, defense: 0 }),
    ).toMatchObject({
      raw: null,
      potential: { hp: 0, attack: 0, defense: 0 },
      preBattle: null,
      battle: null,
    });
    expect(evidenceStatus(state.fields.passive)).toBe('source-documented');
    expect(state.optimization.evaluatorId).toBeNull();
    expect(allocationSpace(gokuEntry.defaults(), gokuEntry).count).toBe(1);
  });
});

describe('Gohan paper case encoded as reviewed judgment', () => {
  it('does not reuse advice in another form or state context', () => {
    const c = { ...context(), state: 'another-form' };
    expect(inferAssignment(gohanKit, c).position).toBe(
      'insufficient information',
    );
    expect(kitGuidance(gohanKit, c).emphasis).toContain('Cannot determine');
    expect(kitGuidance(gohanKit, c).exactBuild.reasons).toContain(
      'The context does not name this exact state. No advice is substituted.',
    );
  });
  // Independently specified expected classification and source trace. These
  // are policy tests, NOT confirmation of actual event/RNG/DEF formulas.
  it('assigns front position and main rotation separately, with an effect-level reason', () => {
    const a = inferAssignment(gohanKit, context());
    expect([a.position, a.rotation, a.role, a.secondaryRole]).toEqual([
      '1',
      'main rotation',
      'defender',
      'damage dealer',
    ]);
    expect(a.reasons.map((r) => r.effectIds)).toEqual([
      ['gohan-guard'],
      ['gohan-super-defense'],
    ]);
    expect(a.secondary).toEqual([
      '2 when another unit takes the opening attacks',
    ]);
  });
  it('gives an Additional emphasis, not invented levels/items or a numeric winner', () => {
    const g = kitGuidance(gohanKit, context());
    expect(g.emphasis).toBe(
      'Additional-led priorities for the untransformed defensive buildup role.',
    );
    expect(g.method).toBe('reviewed character-aware rule');
    expect(g.why[0]!.effectIds).toEqual(['gohan-super-defense']);
    expect(g.exactBuild.available).toBe(false);
    expect(g.exactBuild.reasons).toHaveLength(4);
    expect(g.conflicts.map((r) => r.effectIds)).toEqual([
      ['gohan-guard-attack'],
      ['gohan-native-additional', 'gohan-three-attacks'],
    ]);
  });
  it('an opening-priority override changes advice, not inferred design or a fabricated survival result', () => {
    const defaultAdvice = kitGuidance(gohanKit, context());
    const opening = kitGuidance(
      gohanKit,
      context(),
      'opening-protection',
      false,
    );
    expect(opening.assignment).toEqual(defaultAdvice.assignment);
    expect(opening.emphasis).toBe(
      'Opening protection first; Additional does not improve protection before the first Super.',
    );
    expect(opening.equipment[0]!.text).toContain('no numeric winner');
    expect(
      opening.conflicts.some((r) => r.text.includes('disables evasion')),
    ).toBe(true);
    expect(opening.conflicts.some((r) => r.text.includes('may postpone'))).toBe(
      false,
    );
  });
  it.each([
    'unknown',
    'not-met',
    'unreviewed',
    'after-attack',
    'other-target',
    'recorded-only',
  ] as const)(
    'does not infer unconditional front-position advice from %s guard',
    (case_) => {
      const k = copy(),
        guard = change(k, 'gohan-guard');
      if (case_ === 'unknown')
        guard.condition = { kind: 'other', description: 'unknown' };
      if (case_ === 'not-met')
        guard.condition = {
          kind: 'threshold',
          field: 'battleTurn',
          operator: '>=',
          value: 5,
        };
      if (case_ === 'unreviewed') guard.source.status = 'user-entered';
      if (case_ === 'after-attack') guard.timing = 'after-attack';
      if (case_ === 'other-target') guard.target = 'other-allies';
      if (case_ === 'recorded-only') guard.representation = 'recorded-only';
      expect(inferAssignment(k, context()).position).toBe(
        'insufficient information',
      );
      expect(kitGuidance(k, context()).emphasis).toContain('Cannot determine');
    },
  );
  it('does not promote an unknown/short DEF effect or another policy into the buildup rule', () => {
    for (const changeEffect of [
      (k: ReviewedKit) => {
        change(k, 'gohan-super-defense').amount = null;
      },
      (k: ReviewedKit) => {
        change(k, 'gohan-super-defense').duration.count = 1;
      },
      (k: ReviewedKit) => {
        change(k, 'gohan-super-defense').condition = {
          kind: 'other',
          description: 'missing',
        };
      },
      (k: ReviewedKit) => {
        k.policy = 'ally-support-v1';
      },
    ]) {
      const k = copy();
      changeEffect(k);
      expect(kitGuidance(k, context()).emphasis).toContain('Cannot determine');
    }
  });
  it('retains event ambiguity and distinguishes first appearance from battle turn', () => {
    const effects = kitEffects(gohanKit);
    const entry = effects.find((e) => e.id === 'gohan-entry-reduction')!;
    expect([entry.amount, entry.unit]).toEqual([30, 'percent']); // magnitude, not activation probability
    expect(inspectCondition(entry.condition, context()).state).toBe('unmet');
    const first = { ...context(), values: { battleTurn: 2, appearance: 1 } };
    expect(inspectCondition(entry.condition, first).state).toBe('met');
    expect(
      inspectCondition(
        effects.find((e) => e.id === 'gohan-guard-attack')!.condition,
        context(),
      ).state,
    ).toBe('unknown');
    expect(
      inspectCondition(
        effects.find((e) => e.id === 'gohan-three-attacks')!.condition,
        context(),
      ).state,
    ).toBe('unknown');
  });
});

describe('different reviewed paper patterns — test-only subsets, not catalog additions', () => {
  it('Toppo-style ally support does not automatically imply slot 3 or floater', () => {
    const k = copy();
    k.policy = 'ally-support-v1';
    const source = {
      field: 'ally support',
      status: 'source-documented' as const,
      reference: 'https://dokkan.fyi/characters/1013881',
      note: 'Paper example: STR UR EZA Toppo, Lv140 SA15. Test-only subset, not executable combat data.',
    };
    k.abilities = [
      {
        id: 'test-toppo-passive',
        name: 'Support subset',
        kind: 'passive',
        wording: 'Ally ATK/DEF support.',
        effects: [
          {
            ...change(copy(), 'gohan-basic-attack'),
            id: 'test-support',
            family: 'support',
            target: 'allies-including-self',
            amount: 40,
            source,
          },
        ],
      },
    ];
    expect(inferAssignment(k, context())).toMatchObject({
      position: 'flexible',
      rotation: 'flexible',
      role: 'support',
    });
    expect(kitGuidance(k, context()).emphasis).toContain('Cannot determine');
  });
  it('UI-style entry evasion leaves assignment conditional outside its window', () => {
    const k = copy();
    k.policy = 'conditional-evasion-v1';
    const source = {
      field: 'entry evasion',
      status: 'source-documented' as const,
      reference: 'https://dokkan.fyi/characters/1020311',
      note: 'Paper example: AGL LR EZA Ultra Instinct Goku, Lv150 SA25. Test-only subset.',
    };
    k.abilities = [
      {
        id: 'test-ui-passive',
        name: 'Entry subset',
        kind: 'passive',
        wording: 'Entry turn evasion guarantee.',
        effects: [
          {
            ...change(copy(), 'gohan-entry-reduction'),
            id: 'test-entry-evasion',
            family: 'evasion',
            timing: 'before-hit',
            amount: 1,
            unit: 'probability',
            source,
          },
        ],
      },
    ];
    const a = inferAssignment(k, context());
    expect([a.position, a.rotation]).toEqual(['flexible', 'flexible']);
    expect(a.conditions[0]!.text).toContain('condition: unmet');
    expect(a.conditions[0]!.text).toContain('incoming attack is evadable');
  });
});
