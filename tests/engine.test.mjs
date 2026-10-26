// Hand-arithmetic checks for the calculation code in index.html.
// Run with: node --test
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + ";this.E={MATCH,defaults,defForm,normalizeState,fromLegacy,parseInv,takenMult,model,evalBuild,orbOptions,search,adviseSlot};", ctx);
const E = ctx.E;
// Arrays made inside the vm context have another realm's prototype.
const plain = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

// One LR form: 24 Ki multiplier 2, 18 Ki Super x5, 12 Ki Super x4, 12 Ki multiplier 1.5,
// so the main Super is a 10 hit and kit extras use 1.5 x 4 = 6 (Super) or 1.5 (normal).
// The enemy attacks 5 times a turn and this unit receives 2 of them at teammate size.
function base(extra = {}) {
  const st = E.defaults();
  Object.assign(st, { hitsTotal: 5, hits: 2, hitSize: "1", dmgShare: 40 });
  Object.assign(st.forms[0], { ki: 24, k12: 1.5, k24: 2, sa12: 4, sa18: 5, xs: 0, xn: 0, nc: 0, nd: 0 });
  Object.assign(st.forms[0], extra.form || {});
  delete extra.form;
  return Object.assign(st, extra);
}
const lv = (o) => [o.A || 0, o.C || 0, o.E || 0, o.S || 0, o.R || 0, o.T || 0, o.D || 0];
const build = (st, levels) => E.evalBuild(E.model(st), lv(levels), 1);

test("hit and crit multipliers for each Type matchup", () => {
  // A Type it beats, same class: normal 1.25 + Type ATK, crit (1.5 + Type ATK) x 1.25.
  // T10, C15: 10 x (0.3 x 2.5 + 0.7 x 1.75) = 19.75 against 10 x 1.25.
  near(build(base({ match: "b1" }), { C: 15, T: 10 }).dmg, (19.75 / 12.5 - 1) * 100, "beats, same class");
  // Super vs Extreme: normal 1.5 + Type ATK. 10 x (0.75 + 0.7 x 2.0) = 21.5 against 15.
  near(build(base({ match: "b2" }), { C: 15, T: 10 }).dmg, (21.5 / 15 - 1) * 100, "beats, Super vs Extreme");
  // Neutral Super vs Extreme: normal 1.15, crit 1.875; Type ATK does nothing.
  near(build(base({ match: "n2" }), { C: 15, T: 10 }).dmg, ((0.3 * 1.875 + 0.7 * 1.15) / 1.15 - 1) * 100, "neutral, Super vs Extreme");
  near(build(base(), { C: 15, T: 10 }).dmg, 26.25, "neutral, same class");
});

test("damage taken: type advantage and guard use 0.9 or 1.0, then the 0.5 guard", () => {
  const t = (m, guard, td) => E.takenMult(E.MATCH[m], guard, td);
  near(t("b1", false, 0), 0.45, "beats, same class");
  near(t("b1", false, 15), 0.375, "Type DEF 15 (kamigame: about 0.45 to 0.375)");
  near(t("b2", false, 0), 0.5, "beats, Super vs Extreme");
  near(t("b2", true, 15), 0.425, "Type DEF with guard");
  near(t("n1", true, 15), 0.45, "guard, Type DEF does nothing at neutral");
  near(t("n2", false, 0), 1.15, "neutral Super vs Extreme");
  near(t("n1", false, 0), 1, "neutral");
  near(E.model(base({ hitSize: "auto", dr: 60, guard: true })).size, 0.4 * 0.45, "auto size with DR and guard");
  near(E.model(base({ hitSize: "auto", match: "n2", guard: true })).size, 0.5 / 1.15, "compared with a Super vs Extreme teammate");
});

test("Ki multiplier blends 12 and 24 Ki; 18 Ki switches the Super", () => {
  let M = E.model(base({ form: { ki: 18, k12: 1.4, k24: 2 } }));
  near(M.forms[0].Km, 1.7, "18 Ki multiplier");
  near(M.forms[0].SAm, 5, "18 Ki Super");
  M = E.model(base({ form: { ki: 17, k12: 1.4, k24: 2 } }));
  near(M.forms[0].Km, 1.4 + 0.6 * 5 / 12, "17 Ki multiplier");
  near(M.forms[0].SAm, 4, "12 Ki Super below 18 Ki");
  M = E.model(base({ rarity: "UR", form: { ki: 24, k12: 1.45 } }));
  near(M.forms[0].Km, 1.45, "UR uses its 12 Ki multiplier");
  near(M.forms[0].SAm, 4, "UR uses its 12 Ki Super");
});

test("additionals use the 12 Ki Super and 12 Ki multiplier, one check per eligible attack", () => {
  // main 10 + kit extra Super 6 = 16; A15: 1 - 0.7^2 = 0.51, half Super (6), half normal (1.5)
  near(build(base({ form: { xs: 1 } }), { A: 15 }).dmg, ((16 + 0.51 * 3.75) / 16 - 1) * 100, "additional");
});

test("stacked ATK adds to every Super and shrinks Super Attack Boost's share", () => {
  near(build(base({ form: { xs: 1 } }), { S: 10 }).dmg, (17.75 / 16 - 1) * 100, "SA boost, no stack");
  near(build(base({ form: { xs: 1, stack: 100 } }), { S: 10 }).dmg, (21.25 / 19.5 - 1) * 100, "SA boost, 100% stacked");
});

test("crits ignore enemy DEF", () => {
  // DEF = 50% of the 10 hit; normal 5, crit 18.75
  near(build(base({ enemyDef: 50 }), { C: 15 }).dmg, ((0.3 * 18.75 + 0.7 * 5) / 5 - 1) * 100, "DEF");
});

test("team margin: damage counts by its share, dodges by the share of hits it takes", () => {
  const M = E.model(base());
  near(M.inShare, 0.4, "takes 2 of 5 equal hits");
  // 10% dodge on 2 of 5 hits cuts team HP loss by 0.2 / 5 = 4%.
  let r = build(base(), { E: 10 });
  near(r.cut, 4, "cut");
  near(r.score, (1 / 0.96 - 1) * 100, "dodge only");
  r = build(base(), { C: 15, E: 10 });
  near(r.score, ((1 + 0.4 * 0.2625) / 0.96 - 1) * 100, "damage and dodge multiply");
});

test("Type DEF and Recovery cut team HP loss", () => {
  // Against a Type it beats each hit is 0.45; Type DEF 15 takes it to 0.375.
  const r = build(base({ match: "b1", hitSize: "auto" }), { D: 15 });
  near(r.cut, 100 * (2 * 0.45 - 2 * 0.375) / (2 * 0.45 + 3), "Type DEF");
  near(build(base({ recOff: 20 }), { R: 15 }).score, (1 / 0.8 - 1) * 100, "Recovery at 15 levels");
  near(build(base({ recOff: 20 }), { R: 6 }).cut, 8, "Recovery at 6 levels");
});

test("counters and on-evade gains: a dodge swaps one value for the other", () => {
  // On-hit factor 1 + 2 hits x 0.5 = 2; with 10% dodge 1 + 2 x (0.9 x 0.5 + 0.1 x 0.2) = 1.94.
  let r = build(base({ form: { hitVal: 50, dodgeVal: 20 } }), { E: 10 });
  near(r.dmg, (1.94 / 2 - 1) * 100, "damage");
  near(r.cut, 4, "cut");
  near(r.score, ((1 + 0.4 * -0.03) / 0.96 - 1) * 100, "score");
  // The values grow with its damage: Crit 15 makes its attacks 1.2625x.
  r = build(base({ form: { hitVal: 50, dodgeVal: 20 } }), { C: 15, E: 10 });
  near(r.dmg, (1.2625 * 0.97 - 1) * 100, "with Crit");
});

test("attacks received default to the slot's share of the enemy's attacks", () => {
  const h = (slot, total) => E.model(Object.assign(E.defaults(), { slot, hitsTotal: total })).h;
  near(h("1", 5), 2, "slot 1");
  near(h("2", 5), 1.5, "slot 2");
  near(h("", 5), 5 / 3, "flexible");
  near(h("1", 10), 4, "more enemy attacks");
});

test("realistic orb defaults: bronze stats only, 7 for one skill, 4 + 4 for two", () => {
  const st = E.defaults();
  assert.deepEqual(plain(st.orbs), [
    { use: true, one: 0, two: 0, atk: 0, stat: 800 },
    { use: true, one: 7, two: 4, atk: 0, stat: 0 },
    { use: true, one: 7, two: 4, atk: 0, stat: 0 },
  ]);
  const M = E.model(st);
  const inv = E.parseInv("");
  assert.deepEqual(plain(E.orbOptions(st, M, 0, inv).map((o) => o.n)), ["Empty", "ATK +800"]);
  assert.ok(E.orbOptions(st, M, 1, inv).some((o) => o.n === "Crit 4 + SA Boost 4"));
});

test("ATK on listed orbs always counts", () => {
  const st = E.defaults();
  st.inv = "bronze atk 800\ngold crit 7 atk 900\nsilver crit+additional 4";
  const r = E.search(st);
  assert.equal(r.inv.bad, 0);
  const b = r.top[0];
  assert.equal(b.n[0], "ATK +800");
  assert.equal(b.n[2], "Crit 7 and ATK +900");
  assert.equal(b.atk, 1700);
});

test("orb list parsing", () => {
  const p = E.parseInv("gold type atk 7 atk 900\nsilver crit + additional 4\ngold +900 atk crit 7\nbronze dodge 2\nsilver foo 5\nplatinum crit 7");
  assert.equal(p.bad, 2);
  assert.deepEqual(plain(p.list.map((x) => [x.s, x.n, x.atk])), [
    [2, "Type ATK 7 and ATK +900", 900],
    [1, "Crit 4 + Additional 4", 0],
    [2, "Crit 7 and ATK +900", 900],
    [0, "Evasion 2", 0],
  ]);
});

// The margin is not additive, so check the search against every orb setup and
// every Potential split, with Evasion both able and unable to lower the score.
const bruteCases = {
  "counter unit, Super vs Extreme": (st) => {
    Object.assign(st, { match: "b2", recOff: 10, dmgShare: 40, hits: 2, hitSize: "auto", dr: 20, enemyDef: 20 });
    st.forms[0].hitVal = 20;
    st.forms[0].dodgeVal = 5;
  },
  "evade-reward unit, same class": (st) => {
    Object.assign(st, { match: "b1", dmgShare: 25, hitSize: "1.5" });
    st.forms[0].dodgeVal = 30;
  },
  "neutral, two-skill limit": (st) => {
    Object.assign(st, { kmax: 2, dmgShare: 30, hitSize: "2", recOff: 15 });
  },
  "one form, counters": (st) => {
    Object.assign(st, { match: "b1", dmgShare: 35, hits: 2.5, hitSize: "1.5" });
    st.forms = [Object.assign(st.forms[0], { hitVal: 40, dodgeVal: 10 })];
  },
};
for (const [name, patch] of Object.entries(bruteCases)) {
  test(`search matches a brute force over every orb setup and Potential split (${name})`, () => {
    const st = E.defaults();
    Object.assign(st, { pool: 7, cap: 4, kmax: 3, starSkill: "3", starLv: 1 });
    st.forms = [Object.assign(E.defForm("A"), { share: 60, xs: 0.5, xn: 1, nc: 20, nd: 10, stack: 30 }),
                Object.assign(E.defForm("B"), { share: 40, ki: 19, xs: 1, nd: 30 })];
    st.inv = "bronze atk 800\nbronze dodge 2\nsilver crit+additional 4\nsilver evasion 5\ngold type atk 3 atk 500\ngold crit 4\ngold type def+recovery 3";
    patch(st);
    const r = E.search(st);
    const M = E.model(st), inv = E.parseInv(st.inv), opts = [0, 1, 2].map((s) => E.orbOptions(st, M, s, inv));
    let best = -Infinity;
    const x = Array(7).fill(0);
    const walk = (i, left, l, u) => {
      if (i === 7) {
        if (x.filter((q) => q > 0).length > st.kmax) return;
        const v = E.evalBuild(M, l.map((q, j) => q + x[j]), u).score;
        if (v > best) best = v;
        return;
      }
      for (let q = 0; q <= Math.min(st.cap, left); q++) { x[i] = q; walk(i + 1, left - q, l, u); }
      x[i] = 0;
    };
    for (const b of opts[0]) for (const s of opts[1]) for (const g of opts[2]) {
      const l = [0, 0, 0, 1, 0, 0, 0];
      [b, s, g].forEach((o) => o.d.forEach((q, i) => (l[i] += q)));
      walk(0, st.pool, l, (st.cardAtk + b.atk + s.atk + g.atk) / st.cardAtk);
    }
    near(r.top[0].score, best, "best score");
  });
}

test("saved inputs from earlier versions carry over", () => {
  const old = { name: "TEQ LR", slot: "Slot 2", nc: "40", ncUp: "50", n: "3", s0: "2", d0: "2", s1: "5", d1: "5", s2: "5", d2: "5", dual: true, u0: true, o4: false, inv: "silver crit 5", hitdep: true };
  const keep = E.fromLegacy(old, false);
  assert.equal(keep.name, "TEQ LR");
  assert.equal(keep.slot, "2");
  assert.equal(keep.forms[0].nc, 40);
  assert.equal(keep.forms[0].xs, 2);
  assert.deepEqual(plain([keep.orbs[1].one, keep.orbs[1].two, keep.orbs[0].one, keep.orbs[0].stat]), [5, 5, 2, 0]);
  assert.equal(keep.orbOk[4], false);
  assert.equal(keep.q.hitdep, true);
  const fresh = E.fromLegacy(old, true);
  assert.deepEqual(plain([fresh.orbs[1].one, fresh.orbs[1].two, fresh.orbs[0].stat]), [7, 4, 800]);
  // Version 1 of this page: a Type checkbox and absolute hit sizes.
  const v1 = E.normalizeState({ v: 1, typeOn: true, hitSize: "heavy", survW: 2, hits: "3", forms: [{ k12: 1.6 }] });
  assert.equal(v1.v, 2);
  assert.equal(v1.match, "b1");
  assert.equal(v1.hitSize, "1");
  assert.equal(v1.hits, "3");
  assert.equal(v1.forms[0].k12, 1.6);
  assert.equal("survW" in v1, false);
  assert.equal(E.normalizeState({ v: 1, hitSize: "light" }).hitSize, "0.25");
  assert.equal(E.normalizeState({ v: 2, match: "bogus", hitSize: "9" }).match, "n1");
});

test("slot advice weighs the answers", () => {
  const q = (o) => Object.assign(E.defaults().q, o);
  const a = (o, M) => E.adviseSlot(q(o), M);
  assert.equal(a({ links: true }).slot, "2");
  assert.equal(a({ protect: "y", links: true }).slot, "1");
  let r = a({ kisphere: true, links: true, startpos: true });
  assert.equal(r.slot, "1");
  assert.deepEqual(plain([r.pts[1], r.pts[2], r.pts[3]]), [2, 2, 0]);
  assert.match(r.notes.join(" "), /close call/);
  assert.match(r.notes.join(" "), /starts its next turn 3rd/);
  assert.equal(a({ payoff: "y" }).slot, "23");
  assert.equal(a({ named: "3", protect: "y" }).slot, "3");
  assert.equal(a({ hitdep: true }).slot, "1");
  assert.equal(a({ payoff: "y", hitdep: true }).slot, "23");
  assert.equal(a({}, { size: 0.3 }).slot, "1");
  r = a({ links: true }, { size: 2 });
  assert.deepEqual(plain([r.pts[1], r.pts[2]]), [-1, 2]);
  assert.equal(r.breakdown, "slot 1 −1 (big hits −1); slot 2 2 (links +2); slot 3 0");
  assert.equal(a({}).slot, "");
  r = a({ dodgedep: true }, { size: 1.5 });
  assert.equal(r.slot, "");
  assert.match(r.why, /cancel out/);
});

// Ten example characters (representative values, not exact cards). The checks
// are directions the picks must move in, not exact builds.
const ARCH = {
  nuker: (s) => { Object.assign(s, { dmgShare: 45, slot: "2" }); },
  support: (s) => { Object.assign(s, { rarity: "UR", dmgShare: 15, slot: "1", hitSize: "1.5" }); Object.assign(s.forms[0], { sa12: 3.5, xs: 0 }); },
  tank: (s) => { Object.assign(s, { rarity: "UR", dmgShare: 15, slot: "1", dr: 60, guard: true }); Object.assign(s.forms[0], { sa12: 3.5, xs: 0 }); },
  counter: (s) => { Object.assign(s, { rarity: "UR", dmgShare: 25, slot: "1", hitSize: "1.5" }); Object.assign(s.forms[0], { xs: 0, hitVal: 60 }); },
  counterNone: (s) => { ARCH.counter(s); s.forms[0].hitVal = 0; },
  evader: (s) => { Object.assign(s, { rarity: "UR", dmgShare: 33, slot: "1" }); Object.assign(s.forms[0], { nd: 20, xs: 0.5, dodgeVal: 50 }); },
  evaderNone: (s) => { ARCH.evader(s); s.forms[0].dodgeVal = 0; },
  nativeDodge: (s) => { Object.assign(s, { rarity: "UR", dmgShare: 33, slot: "1" }); Object.assign(s.forms[0], { nd: 30, xs: 0.5, dodgeVal: 30 }); },
  nativeDodgeNone: (s) => { ARCH.nativeDodge(s); s.forms[0].nd = 0; },
  highCrit: (s) => { ARCH.nuker(s); s.forms[0].nc = 70; },
  stacker: (s) => { ARCH.nuker(s); Object.assign(s.forms[0], { stack: 200, xs: 1.5 }); },
  typeAdv: (s) => { ARCH.nuker(s); s.match = "b1"; },
  transform: (s) => {
    ARCH.nuker(s);
    s.forms = [Object.assign({}, s.forms[0], { name: "Base", share: 40, sa12: 3.5, sa18: 4.5, k12: 1.4, xs: 0.5 }),
               Object.assign({}, s.forms[0], { name: "Transformed", share: 60, xs: 2, nc: 30 })];
  },
  defWall: (s) => { ARCH.nuker(s); s.enemyDef = 60; },
};
const best = (name, patch) => { const st = E.defaults(); ARCH[name](st); if (patch) patch(st); return E.search(st).top[0]; };

test("ten example characters: picks move the right way", () => {
  const [A, C, EV, S, , T] = [0, 1, 2, 3, 4, 5];
  const nuker = best("nuker");
  assert.equal(nuker.tot[EV], 0, "a damage dealer in slot 2 takes no Evasion");
  assert.ok(best("support").tot[EV] >= 20, "a fragile support stacks Evasion");
  assert.equal(best("tank").tot[EV], 0, "a guarding tank with 60% DR takes no Evasion");
  assert.ok(best("counter").tot[EV] < best("counterNone").tot[EV], "counters make Evasion worth less");
  assert.ok(best("evader").tot[EV] > best("evaderNone").tot[EV], "gains on evading make Evasion worth more");
  assert.ok(best("nativeDodge").tot[EV] < best("nativeDodgeNone").tot[EV], "native dodge overlaps with Evasion");
  assert.ok(best("highCrit").tot[C] < nuker.tot[C], "native crit overlaps with Crit");
  const st = best("stacker");
  assert.ok(st.tot[S] < nuker.tot[S] && st.tot[A] > nuker.tot[A], "stacked ATK moves levels from SA Boost to Additional");
  const ta = best("typeAdv");
  assert.ok(ta.tot[T] > 0 && ta.tot[C] < nuker.tot[C], "a Type it beats favours Type ATK over Crit");
  assert.equal(best("transform").per.length, 2, "both forms are scored");
  const dw = best("defWall");
  assert.ok(dw.tot[C] >= nuker.tot[C] && dw.dmg > nuker.dmg, "enemy DEF makes Crit worth more");
});

test("Evasion falls as the unit's share of team damage rises", () => {
  let last = Infinity;
  for (const share of [5, 15, 25, 35, 45, 60]) {
    const e = best("support", (s) => (s.dmgShare = share)).tot[2];
    assert.ok(e <= last, `share ${share}: Evasion ${e} after ${last}`);
    last = e;
  }
  assert.equal(last, 0, "a main damage dealer that takes big hits still prefers damage at 60%");
});
