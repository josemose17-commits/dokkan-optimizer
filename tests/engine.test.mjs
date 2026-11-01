// Smoke checks for the calculation code in index.html (<script id="engine">).
// Run with: node --test
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + ";this.E=ENGINE;", ctx);
const E = ctx.E;

test("the engine loads and reads boards and orbs", () => {
  const b = E.parseBoard("5 crit\n3 additional | crit | dodge\nnot a node");
  assert.equal(b.nodes.length, 2);
  assert.deepEqual([...b.bad], [3]);
  const o = E.parseOrbs("gold crit + additional 5\nsilver dodge 5");
  assert.equal(o.orbs.length, 2);
  assert.equal(o.orbs[0].label, "Additional +5, Critical +5");
});

test("more Crit and more Additional raise damage", () => {
  const c = { lr: true, kiLv: "24", mMain: 5.7, rMain: 50, mAdd: 4.25, rAdd: 30, natS: 0, natC: 1, natQ: 50,
    ncS: 0, ncN: 0, nd: 0, counters: 0, cMult: 200, eat: false, adv: false, statOrbs: false, baseAtk: 22000 };
  const base = E.evalBuild(c, E.Z());
  const crit = E.Z(); crit[1] = 20;
  const add = E.Z(); add[0] = 20;
  assert.ok(E.evalBuild(c, crit).dmg > base.dmg);
  assert.ok(E.evalBuild(c, add).dmg > base.dmg);
});

test("the search finds a build for a standard board", async () => {
  const c = { lr: true, kiLv: "24", mMain: 5.7, rMain: 50, mAdd: 4.25, rAdd: 30, natS: 0, natC: 1, natQ: 50,
    ncS: 0, ncN: 0, nd: 0, counters: 0, cMult: 200, eat: false, adv: false, statOrbs: false, baseAtk: 22000,
    effects: [], forms: [], formStats: [], board: "5 crit\n3 additional | crit | dodge", choiceCap: 15, maxLv: 0,
    orbMode: "std", u0: true, u1: true, u2: true, s0: 2, d0: 2, s1: 5, d1: 5, s2: 5, d2: 5,
    o0: true, o1: true, o2: true, o3: true, o4: true, o5: true, o6: true, own: false };
  const r = await E.search(c);
  assert.ok(r.top.length > 0);
  assert.ok([1, 2, 3].includes(r.slot.pick));
});

// Kits as DokkanStats and the game show them (from the Dokkan wiki's card pages).
const plain = (x) => JSON.parse(JSON.stringify(x));

test("quick fill: basic effects go to section 3, conditional ones stay rows", () => {
  const r = E.readKit({
    sa12: "Greatly raises ATK, raises DEF and causes immense damage to enemy",
    passive: `Basic effect(s)
- ATK & DEF 260%↑
- Damage reduction rate & chance of performing a critical hit 26%↑
- Launches an additional attack that has a high chance of becoming a Super Attack
When there is a "Pure Saiyans" Category enemy
- Launches an additional attack that has a great chance of becoming a Super Attack`,
  }, false, true);
  // Immense damage at SA level 15 (Extreme Z-Awakened UR) = 6.3; "greatly raises ATK" = 50.
  assert.deepEqual(plain(r.atk), { mMain: 6.3, rMain: 50 });
  // Section 3 adds up the rows that count for the build: the basic block, not the Saiyan condition.
  assert.deepEqual(plain(E.deriveAtk(r.rows, null)), { natS: 0, natC: 1, natQ: 50, ncS: 26, ncN: 26, nd: 0, counters: 0, cMult: 200, eat: false });
  const what = r.rows.map((e) => e.what + ":" + e.when + ":" + (e.amt ?? ""));
  assert.ok(what.includes("def:start:260"));
  assert.ok(what.includes("dr:start:26"));
  assert.ok(what.includes("atk:attack:"), "the Super's ATK raise");
  const adds = r.rows.filter((e) => e.what === "add");
  assert.deepEqual(plain(adds.map((e) => [e.count, e.sup, e.build])), [[1, 50, true], [1, 70, false]], "the conditional one doesn't count for the build");
  assert.equal(r.rows.find((e) => e.what === "atk").lasts, "perm", "a raise with no turn count stacks all battle");
  assert.ok(r.check.some((x) => /isn't always on/.test(x)));
});

test("quick fill: LR Supers, guard, counters and conditions", () => {
  const r = E.readKit({
    sa12: "Raises ATK for 4 turns and causes colossal damage to enemy",
    sa18: "Raises ATK & DEF by 58% for 1 turn and causes mega-colossal damage to enemy",
    passive: `Basic effect(s)
- Damage reduction rate 58%↑
- ATK & DEF 58%↑ and damage reduction rate 10%↑ for allies whose names include "Piccolo"
When attacking
- Guards all attacks
As the 1st attacker in a turn
- Great chance of evading enemy's attack
When receiving a Super Attack
- High chance of nullifying it and countering with tremendous power`,
  }, true, false);
  // Colossal 4.25 and mega-colossal 5.7 at LR SA level 20.
  assert.equal(r.atk.mAdd, 4.25);
  assert.equal(r.atk.mMain, 5.7);
  assert.equal(r.atk.rMain, 58);
  const d = E.deriveAtk(r.rows, null);
  assert.equal(d.cMult, 300);
  assert.equal(d.counters, 0.5, "50% chance to counter a Super");
  assert.equal(d.nd, 0, "evasion as the 1st attacker isn't always on");
  const get = (w) => r.rows.find((e) => e.what === w);
  assert.equal(get("guard").when, "attack");
  assert.equal(get("eva").pos, "1");
  assert.equal(get("eva").amt, 70);
  assert.equal(get("nullify").amt, 50);
  assert.equal(get("dr").amt, 58);
  assert.ok(get("ally"), "the allies' boost is an ally row, not its own damage reduction");
  assert.equal(r.rows.filter((e) => e.what === "dr").length, 1);
});

test("section 3 adds up the rows: enter each effect once", () => {
  const rows = [
    { what: "crit", src: "passive", when: "start", amt: 20 },
    { what: "crit", src: "super", when: "attack", amt: 50 },
    { what: "eva", src: "passive", when: "start", amt: 30 },
    { what: "eva", src: "passive", when: "start", amt: 20, build: false },
    { what: "add", src: "passive", when: "start", count: 2, sup: 70 },
    { what: "add", src: "passive", when: "start", count: 1, sup: 30 },
    { what: "add", src: "passive", when: "start", count: 1, sup: 100 },
    { what: "counter", src: "passive", when: "recv", str: 300, per: 1 },
    { what: "eat", src: "passive", when: "start" },
    { what: "crit", src: "passive", when: "start", amt: 40, form: "1" },
  ].map(E.norm);
  const d = plain(E.deriveAtk(rows, 0));
  // Crit: 20 on everything, 50 more on Supers from the Super; the form-2 row is left out.
  assert.equal(d.ncS, 70);
  assert.equal(d.ncN, 20);
  assert.equal(d.nd, 30, "a row not counted for the build is left out");
  // Three attacks that may become a Super average (2 x 70 + 30) / 3 = 57; the sure one is a guaranteed Super.
  assert.deepEqual([d.natC, d.natQ, d.natS], [3, 57, 1]);
  assert.deepEqual([d.counters, d.cMult, d.eat], [1, 300, true]);
  assert.equal(plain(E.deriveAtk(rows, 1)).ncS, 100, "form 2 adds its own 40%, capped at 100");
});
