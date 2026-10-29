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
