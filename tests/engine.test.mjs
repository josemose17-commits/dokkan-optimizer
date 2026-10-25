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
vm.runInContext(src + ";this.E={defaults,defForm,normalizeState,fromLegacy,parseInv,model,evalBuild,orbOptions,search,adviseSlot};", ctx);
const E = ctx.E;
// Arrays made inside the vm context have another realm's prototype.
const plain = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

// One LR form: 24 Ki multiplier 2, 18 Ki Super x5, 12 Ki Super x4, 12 Ki multiplier 1.5.
function base(extra = {}) {
  const st = E.defaults();
  st.survW = 0;
  Object.assign(st.forms[0], { ki: 24, k12: 1.5, k24: 2, sa12: 4, sa18: 5, xs: 0, xn: 0, nc: 0, nd: 0 });
  Object.assign(st.forms[0], extra.form || {});
  delete extra.form;
  return Object.assign(st, extra);
}
const lv = (o) => [o.A || 0, o.C || 0, o.E || 0, o.S || 0, o.R || 0, o.T || 0, o.D || 0];

test("crit against a Type it beats is (1.5 + Type ATK) x 1.25", () => {
  const M = E.model(base({ typeOn: true }));
  // main hit 2 x 5 = 10; T10 -> 2.0 normal, 2.5 crit; C15 -> 30% crit
  // 10 x (0.3 x 2.5 + 0.7 x 2.0) = 21.5 against a baseline of 10 x 1.5 = 15
  near(E.evalBuild(M, lv({ C: 15, T: 10 }), 1).dmg, (21.5 / 15 - 1) * 100, "type crit");
});

test("neutral crit is 1.875 and Type ATK does nothing", () => {
  const M = E.model(base());
  near(E.evalBuild(M, lv({ C: 15, T: 10 }), 1).dmg, 26.25, "neutral crit");
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
  // main 10 + kit extra Super 1.5 x 4 = 6 -> 16
  // A15: 1 - 0.7^2 = 0.51 chance; half Super (6), half normal (1.5)
  const M = E.model(base({ form: { xs: 1 } }));
  near(E.evalBuild(M, lv({ A: 15 }), 1).dmg, ((16 + 0.51 * 3.75) / 16 - 1) * 100, "additional");
});

test("stacked ATK adds to every Super and shrinks Super Attack Boost's share", () => {
  let M = E.model(base({ form: { xs: 1 } }));
  near(E.evalBuild(M, lv({ S: 10 }), 1).dmg, (17.75 / 16 - 1) * 100, "SA boost, no stack");
  M = E.model(base({ form: { xs: 1, stack: 100 } }));
  near(E.evalBuild(M, lv({ S: 10 }), 1).dmg, (21.25 / 19.5 - 1) * 100, "SA boost, 100% stacked");
});

test("crits ignore enemy DEF", () => {
  // DEF = 50% of the 10 hit; normal 5, crit 18.75
  const M = E.model(base({ enemyDef: 50 }));
  near(E.evalBuild(M, lv({ C: 15 }), 1).dmg, ((0.3 * 18.75 + 0.7 * 5) / 5 - 1) * 100, "DEF");
});

test("Evasion on a counter unit: avoided damage minus the missed counter", () => {
  const M = E.model(base({ hits: 2, hitSize: "heavy", survW: 2, form: { hitVal: 50 } }));
  const r = E.evalBuild(M, lv({ E: 10 }), 1);
  // base turn 10 + 2 hits x 0.5 x 10 = 20; with 10% dodge counters drop to 9
  near(r.dmg, (19 / 20 - 1) * 100, "missed counters");
  near(r.saved, 2 * 25 * 0.1, "team HP saved");
  near(r.score, -5 + 2 * 5, "score");
});

test("Evasion scales with how hard the unit gets hit", () => {
  const fragile = E.model(base({ survW: 2, dr: 0, guard: false }));
  const tank = E.model(base({ survW: 2, dr: 60, guard: true }));
  near(fragile.size, 25, "fragile hit");
  near(tank.size, 5, "tank hit");
  const ev = (M) => E.evalBuild(M, lv({ E: 10 }), 1).saved;
  near(ev(fragile) / ev(tank), 5, "ratio");
  const pick = (extra) => E.search(Object.assign(E.defaults(), { slot: "1", survW: 2 }, extra)).top[0].tot[2];
  assert.ok(pick({ dr: 0 }) >= pick({ dr: 60, guard: true }), "tank never gets more Evasion than a fragile unit");
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

for (const counters of [true, false]) test(`search matches a brute force over every orb setup and Potential split (${counters ? "counter unit" : "no counters"})`, () => {
  const st = E.defaults();
  Object.assign(st, { pool: 7, cap: 4, kmax: 3, typeOn: true, survW: 1.5, recW: 6, hits: 2, enemyDef: 20, starSkill: "3", starLv: 1 });
  st.forms = [Object.assign(E.defForm("A"), { share: 60, xs: 0.5, xn: 1, nc: 20, nd: 10, stack: 30, hitVal: counters ? 20 : 0 }),
              Object.assign(E.defForm("B"), { share: 40, ki: 19, xs: 1, nd: 30 })];
  st.inv = "bronze atk 800\nbronze dodge 2\nsilver crit+additional 4\nsilver evasion 5\ngold type atk 3 atk 500\ngold crit 4\ngold type def+recovery 3";
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

test("previous version's saved inputs carry over", () => {
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
  assert.equal(E.normalizeState({ forms: [{ k12: 1.6 }], bogus: 1 }).forms[0].k12, 1.6);
});

test("slot advice", () => {
  const q = (o) => Object.assign(E.defaults().q, o);
  assert.equal(E.adviseSlot(q({ links: true })).slot, "2");
  const a = E.adviseSlot(q({ kisphere: true, links: true, startpos: true }));
  assert.equal(a.slot, "1");
  assert.match(a.notes.join(" "), /Slot 2, because it relies on links/);
  assert.match(a.notes.join(" "), /starts its next turn 3rd/);
  assert.equal(E.adviseSlot(q({ named: "3", protect: "y" })).slot, "3");
});
