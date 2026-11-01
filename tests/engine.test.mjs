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
  assert.deepEqual(plain(r.atk), { mMain: 6.3, rMain: 50, ncS: 26, ncN: 26, natQ: 50, natC: 1 });
  const what = r.rows.map((e) => e.what + ":" + e.when + ":" + (e.amt ?? ""));
  assert.ok(what.includes("def:start:260"));
  assert.ok(what.includes("dr:start:26"));
  assert.ok(what.includes("atk:attack:"), "the Super's ATK raise");
  assert.ok(what.includes("add:start:"), "the conditional additional attack is a row");
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
  assert.equal(r.atk.cMult, 300);
  const get = (w) => r.rows.find((e) => e.what === w);
  assert.equal(get("guard").when, "attack");
  assert.equal(get("eva").pos, "1");
  assert.equal(get("eva").amt, 70);
  assert.equal(get("nullify").amt, 50);
  assert.equal(get("dr").amt, 58);
  assert.ok(get("ally"), "the allies' boost is an ally row, not its own damage reduction");
  assert.equal(r.rows.filter((e) => e.what === "dr").length, 1);
});
