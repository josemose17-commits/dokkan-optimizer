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
vm.runInContext(src + ";this.E={MATCH,defaults,defForm,normalizeState,fromLegacy,parseInv,takenMult,kitForm,matchCode,describeMatch,model,evalBuild,orbOptions,search,adviseSlot,sizeAt,readKit};", ctx);
const E = ctx.E;
// Arrays made inside the vm context have another realm's prototype.
const plain = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

// The card's kit in engine terms: multipliers as 1.5 / 4.25, expected extra
// attacks (1.5 = one guaranteed plus a 50% chance), chances and values in %.
function kit(o) {
  const k = {}, split = (x, g, p) => { k[g] = Math.floor(x); k[p] = Math.round((x - Math.floor(x)) * 100); };
  for (const [key, v] of Object.entries(o)) {
    if (["k12", "k24", "sa12", "sa18"].includes(key)) k[key] = Math.round(v * 10000) / 100;
    else if (key === "xs") split(v, "addSup", "addSupPct");
    else if (key === "xn") split(v, "addNorm", "addNormPct");
    else if (key === "nc") k.crit = v;
    else if (key === "nd") k.eva = v;
    else if (key === "stack") { k.stackPer = v; k.stackN = 1; }
    else if (key === "hitVal") k.atkHit = v;
    else if (key === "dodgeVal") k.atkDodge = v;
    else k[key] = v;
  }
  return k;
}
// Matchups as a Super TEQ card against an enemy (TEQ beats AGL, INT beats TEQ).
const MATCHUPS = {
  n1: { enemyClass: "", enemyType: "" }, n2: { enemyClass: "Extreme", enemyType: "" },
  b1: { enemyClass: "", enemyType: "AGL" }, b2: { enemyClass: "Extreme", enemyType: "AGL" },
  w1: { enemyClass: "", enemyType: "INT" }, w2: { enemyClass: "Extreme", enemyType: "INT" },
};
const setMatch = (st, m) => Object.assign(st, { unitClass: "Super", unitType: "TEQ" }, MATCHUPS[m]);

// One LR form: 24 Ki multiplier 2, 18 Ki Super x5, 12 Ki Super x4, 12 Ki multiplier 1.5,
// so the main Super is a 10 hit and kit extras use 1.5 x 4 = 6 (Super) or 1.5 (normal).
// The enemy attacks 5 times a turn and this unit receives 2 of them at teammate size.
function base(extra = {}) {
  const st = E.defaults();
  Object.assign(st, { hitsTotal: 5, hits: 2, hitSize: "1", dmgShare: 40 });
  Object.assign(st.forms[0], kit({ ki: 24, k12: 1.5, k24: 2, sa12: 4, sa18: 5, xs: 0, xn: 0, nc: 0, nd: 0 }));
  Object.assign(st.forms[0], kit(extra.form || {}));
  delete extra.form;
  if (extra.match) setMatch(st, extra.match);
  delete extra.match;
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

test("a Super's ATK raise counts for itself and the attacks after it", () => {
  near(build(base({ form: { xs: 1 } }), { S: 10 }).dmg, (17.75 / 16 - 1) * 100, "SA boost, no stack");
  // "Raises ATK by 100% for the battle", one Super before this fight, a one-turn fight:
  // main 2 x (5 + 2) = 14, extra Super 1.5 x (4 + 3) = 10.5; SA Boost 10 adds 0.5 to both.
  near(build(base({ fightTurns: 1, form: { xs: 1, stack: 100 } }), { S: 10 }).dmg, (26.25 / 24.5 - 1) * 100, "SA boost, 100% stacked");
  // "Raises ATK by 30% for 1 turn": main 2 x 5.3 = 10.6, extra 1.5 x 4.6 = 6.9; S10: 11.6 + 7.65.
  near(build(base({ form: { xs: 1, saTurn: 30 } }), { S: 10 }).dmg, (19.25 / 17.5 - 1) * 100, "1-turn raise");
});

test("battle stacks build up over the turns it attacks, up to their cap", () => {
  // 30% per Super over 3 turns: 2 x 5.3, 2 x 5.6, 2 x 5.9 = 10.6, 11.2, 11.8; SA Boost 10 adds 1 a turn.
  near(build(base({ fightTurns: 3, form: { stackPer: 30 } }), { S: 10 }).dmg, (12.2 / 11.2 - 1) * 100, "3 turns");
  // Capped at 50%: 10.6, 11, 11.
  const avg = 32.6 / 3;
  near(build(base({ fightTurns: 3, form: { stackPer: 30, stackCap: 50 } }), { S: 10 }).dmg, ((avg + 1) / avg - 1) * 100, "cap");
});

test("on-attack ATK boosts add up, then multiply", () => {
  // ATK +50% on Supers: main 10 x 1.5 = 15 and a normal 1.5; S10: 2 x 5.5 x 1.5 = 16.5.
  near(build(base({ form: { xn: 1, atkSup: 50 } }), { S: 10 }).dmg, (18 / 16.5 - 1) * 100, "on Supers");
  // ATK +20% with each attack performed: the normal after the Super gets 1.2x (1.8).
  near(build(base({ form: { xn: 1, atkEach: 20 } }), { S: 10 }).dmg, (12.8 / 11.8 - 1) * 100, "per attack");
  // For the battle, 2 turns: 10, then 12 (S10: 11, then 13.2).
  near(build(base({ fightTurns: 2, form: { atkEach: 20, eachBattle: true } }), { S: 10 }).dmg, (12.1 / 11 - 1) * 100, "per attack, battle");
  // ATK +10% per attack received for the battle, 2 a turn: 10, then 12; capped at 15%: 11.5.
  near(E.model(base({ fightTurns: 2, form: { hitStack: 10 } })).forms[0].D0, 11, "per attack received");
  near(E.model(base({ fightTurns: 2, form: { hitStack: 10, hitCap: 15 } })).forms[0].D0, 10.75, "capped");
});

test("an additional attack that may become a Super, and ATK when attacking", () => {
  // Half the time a 6 Super, half a 1.5 normal: 10 + 3.75.
  near(E.model(base({ form: { addMix: 1, addMixPct: 50 } })).forms[0].D0, 13.75, "may become a Super");
  // ATK +50% when attacking and +50% on Supers add up: main 10 x 2 = 20, normal 1.5 x 1.5 = 2.25.
  near(build(base({ form: { xn: 1, atkAll: 50, atkSup: 50 } }), { S: 10 }).dmg, (24.25 / 22.25 - 1) * 100, "when attacking");
});

test("attacks effective against all Types hit like a Type it beats", () => {
  // Neutral, same class: 1.25 + Type ATK, crit (1.5 + Type ATK) x 1.25, as in the first test.
  near(build(base({ form: { effAll: true } }), { C: 15, T: 10 }).dmg, (19.75 / 12.5 - 1) * 100, "effective");
  near(E.model(base({ hitSize: "auto", form: { effAll: true } })).size, 1, "it still takes neutral hits");
});

test("Ki odds average the Super over the Ki it reaches", () => {
  // 18 Ki: 1.75 x 5; 24 Ki: 2 x 5; half each = 9.375. SA Boost 10 adds 0.5 x 1.875.
  const st = base({ form: { kiOdds: "18:50, 24:50" } });
  near(E.model(st).forms[0].Km, 1.875, "average Ki multiplier");
  near(build(st, { S: 10 }).dmg, (0.9375 / 9.375) * 100, "SA boost");
  // Below 18 Ki it uses the 12 Ki Super: 1.5 x 4 = 6.
  near(E.model(base({ form: { kiOdds: "12:50, 24:50" } })).forms[0].D0, 8, "12 and 24 Ki");
  assert.match(E.model(base({ form: { kiOdds: "30:50" } })).warn.join(" "), /Ki odds/);
});

test("lowered enemy DEF, all-target Supers and Active Skill attacks", () => {
  // Enemy DEF = 50% of the 10 hit = 5. Main 10 - 5 = 5; the extra Super after it 6 - 2.5 = 3.5.
  near(E.model(base({ enemyDef: 50, fightTurns: 1, form: { xs: 1, defLow: 50 } })).forms[0].D0, 8.5, "one turn");
  // The next turn both Supers' debuffs are still up (they last 3 turns): 10 + 6.
  near(E.model(base({ enemyDef: 50, fightTurns: 2, form: { xs: 1, defLow: 50 } })).forms[0].D0, 12.25, "two turns");
  // A Super that hits 3 enemies: 30, plus a normal 1.5.
  near(E.model(base({ form: { xn: 1, aoe: 3 } })).forms[0].D0, 31.5, "all-target Super");
  // A 500% Active Skill once in a 5-turn fight, at the 24 Ki multiplier (2): 10 / 5 = 2 a turn,
  // and a Hidden Potential check every 5 turns. SA Boost 10 adds 0.5 x 2 / 5 to it and 1 to the Super.
  const st = base({ actMult: 500, actUses: 1, fightTurns: 5 });
  near(E.model(st).forms[0].D0, 12, "Active Skill");
  near(build(st, { S: 10 }).dmg, (13.2 / 12 - 1) * 100, "SA Boost counts for it");
  near(build(st, { A: 15 }).sup, 50 * (1 - Math.pow(0.7, 1.2)), "its additional check");
});

test("with the enemy's ATK, DEF is subtracted before guard", () => {
  const def = { hitSize: "auto", enemyAtk: 100000, def: 20000, mateDef: 10000, dr: 50 };
  // Normal 100000 x 0.5 - 20000 = 30000, Super 250000 x 0.5 - 20000 = 105000, 20% Supers;
  // a teammate takes 90000 and 240000.
  near(E.model(base(def)).size, (0.8 * 30000 + 0.2 * 105000) / (0.8 * 90000 + 0.2 * 240000), "neutral");
  // Against a Type it beats: (x 0.9 - DEF) x 0.5; Type DEF 15 turns 0.9 into 0.75.
  const M = E.model(base(Object.assign({ match: "b1" }, def)));
  near(E.sizeAt(M, 0), (0.8 * 12500 + 0.2 * 46250) / 120000, "beats");
  near(E.sizeAt(M, 15), (0.8 * 8750 + 0.2 * 36875) / 120000, "Type DEF");
  // Without it: 20% DR, 50% against Supers, Supers 2.5x normals.
  near(E.model(base({ hitSize: "auto", dr: 20, drSup: 30 })).size, (0.8 * 0.8 + 0.2 * 2.5 * 0.5) / (0.8 + 0.2 * 2.5), "DR against Supers");
});

test("Recovery Boost heals 0.0015 x level x DEF x Ki Spheres of its Type", () => {
  // 0.0015 x 20000 x 4 = 120 HP a level against 120000 a teammate hit; the team takes 5 hits a turn.
  const st = base({ enemyAtk: 100000, def: 20000, mateDef: 10000, dr: 50, spheres: 4, recOff: 50 });
  near(build(st, { R: 10 }).cut, (100 * 120 * 10) / 120000 / 5, "formula, the estimate is ignored");
  near(build(base({ unevadable: 50 }), { E: 10 }).cut, 2, "half the attacks can't be evaded");
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
    setMatch(st, "b2");
    Object.assign(st, { recOff: 10, dmgShare: 45, hits: 2, hitSize: "auto", dr: 20, enemyDef: 20 });
    Object.assign(st.forms[0], { atkHit: 20, atkDodge: 5, ctrHit: 150 });
  },
  "evade-reward unit, same class": (st) => {
    setMatch(st, "b1");
    Object.assign(st, { dmgShare: 15, hitSize: "1.5" });
    st.forms[0].ctrDodge = 200;
  },
  "neutral, two-skill limit": (st) => {
    setMatch(st, "w2");
    Object.assign(st, { kmax: 2, dmgShare: 33, hitSize: "2", recOff: 15 });
  },
  "stacks, Ki odds, all-target Supers, an Active Skill, lowered DEF": (st) => {
    Object.assign(st, { enemyDef: 30, fightTurns: 3, actMult: 400, actUses: 1, dmgShare: 45 });
    Object.assign(st.forms[0], { stackPer: 30, stackCap: 60, saTurn: 20, defLow: 30, aoe: 2, kiOdds: "18:40, 24:60", atkSup: 30 });
    Object.assign(st.forms[1], { atkEach: 10, eachBattle: true, eachCap: 30, hitStack: 5 });
  },
  "counters, DEF hit sizes, attacks it can't evade, effective against all Types": (st) => {
    setMatch(st, "w1");
    Object.assign(st, { hitSize: "auto", enemyAtk: 200000, def: 30000, dr: 30, drSup: 20, unevadable: 25, spheres: 3, hits: 2, dmgShare: 33 });
    Object.assign(st.forms[0], { ctrHit: 200, ctrOn: "normal", atkHit: 15, effAll: true });
    Object.assign(st.forms[1], { ctrDodge: 300, atkDodge: 20, atkHit: 10 });
  },
  "one form, plain": (st) => { st.forms = [st.forms[0]]; },
  "one form, gains when hit": (st) => { setMatch(st, "b1"); st.forms = [Object.assign(st.forms[0], { atkHit: 30 })]; },
  "one form, counters": (st) => {
    setMatch(st, "b1");
    Object.assign(st, { dmgShare: 33, hits: 2.5, hitSize: "1.5" });
    st.forms = [Object.assign(st.forms[0], kit({ hitVal: 40, dodgeVal: 10, xs: 1.5, xn: 0.5 }), { critOn: "super", crit: 30 })];
  },
};
for (const [name, patch] of Object.entries(bruteCases)) {
  test(`search matches a brute force over every orb setup and Potential split (${name})`, () => {
    const st = E.defaults();
    Object.assign(st, { pool: 7, cap: 4, kmax: 3, starSkill: "3", starLv: 1 });
    st.forms = [Object.assign(E.defForm("A"), kit({ share: 60, xs: 0.5, xn: 1, nc: 20, nd: 10, stack: 30 })),
                Object.assign(E.defForm("B"), kit({ share: 40, ki: 19, xs: 1, nd: 30 }))];
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
  const old = { name: "TEQ LR", slot: "Slot 2", nc: "40", ncUp: "50", n: "3", s0: "2", d0: "2", s1: "5", d1: "5", s2: "5", d2: "5", dual: true, u0: true, o4: false, inv: "silver crit 5" };
  const keep = E.fromLegacy(old, false);
  assert.equal(keep.name, "TEQ LR");
  assert.equal(keep.slot, "2");
  assert.equal(keep.forms[0].crit, 20, "40% crit on half the attacks");
  assert.equal(keep.forms[0].addSup, 2);
  assert.deepEqual(plain([keep.orbs[1].one, keep.orbs[1].two, keep.orbs[0].one, keep.orbs[0].stat]), [5, 5, 2, 0]);
  assert.equal(keep.orbOk[4], false);
  const fresh = E.fromLegacy(old, true);
  assert.deepEqual(plain([fresh.orbs[1].one, fresh.orbs[1].two, fresh.orbs[0].stat]), [7, 4, 800]);
  // Version 1: a Type checkbox and absolute hit sizes.
  const v1 = E.normalizeState({ v: 1, typeOn: true, hitSize: "heavy", survW: 2, hits: "3", forms: [{ k12: 1.6 }] });
  assert.equal(v1.v, 4);
  assert.equal(E.matchCode(v1), "b1");
  assert.equal(v1.hitSize, "1");
  assert.equal(v1.hits, "3");
  assert.equal(v1.forms[0].k12, 160);
  assert.equal("survW" in v1, false);
  assert.equal(E.normalizeState({ v: 1, hitSize: "light" }).hitSize, "0.25");
  // Version 2: matchup menu, free damage share, engine-style form numbers.
  const v2 = E.normalizeState({ v: 2, match: "b2", dmgShare: 40, q: { job: "sup", links: true }, forms: [
    { name: "Base", share: 100, ki: 20, k12: 1.5, k24: 2, sa12: 4.25, sa18: 5.4, stack: 30, xs: 1.5, xn: 0.7, nc: 40, ncUp: 50, nd: 10, hitVal: 20, dodgeVal: 5 }] });
  assert.equal(E.matchCode(v2), "b2");
  assert.equal(v2.dmgShare, 45, "nearest share option");
  assert.equal(v2.q.links, true);
  assert.equal("job" in v2.q, false);
  assert.deepEqual(plain(v2.forms[0]), { name: "Base", share: 100, sa12: 425, sa18: 540, ki: 20, kiOdds: "", k12: 150, k24: 200,
    saTurn: 0, stackPer: 30, stackCap: 0, stackN: 1, defLow: 0, aoe: 1, atkAll: 0, atkSup: 0, atkEach: 0, eachBattle: false, eachCap: 0, hitStack: 0, hitCap: 0,
    addSup: 1, addSupPct: 50, addMix: 0, addMixPct: 50, addNorm: 0, addNormPct: 70, crit: 20, critOn: "all", eva: 10, effAll: false,
    ctrHit: 0, ctrOn: "all", atkHit: 20, ctrDodge: 0, atkDodge: 5, dist: "" });
  assert.equal(v2.fightTurns, 1, "old stacks keep a one-turn fight");
  // Version 3: stacks were a snapshot, so they keep a one-turn fight.
  assert.equal(E.normalizeState({ v: 3, forms: [{ stackPer: 30, stackN: 2 }] }).fightTurns, 1);
  assert.equal(E.normalizeState({ v: 3, forms: [{ stackPer: 30 }] }).fightTurns, 5);
  assert.equal(E.normalizeState({ v: 3, forms: [{ ctrOn: "bogus" }] }).forms[0].ctrOn, "all");
  assert.equal(E.normalizeState({ v: 3, unitType: "bogus", enemyType: "bogus", dmgShare: 50 }).unitType, "AGL");
});

test("the matchup comes from the card's and the enemy's class and Type", () => {
  const code = (o) => E.matchCode(Object.assign(E.defaults(), o));
  assert.equal(code({ unitClass: "Super", unitType: "TEQ", enemyType: "AGL" }), "b1", "TEQ beats AGL");
  assert.equal(code({ unitClass: "Super", unitType: "TEQ", enemyClass: "Extreme", enemyType: "AGL" }), "b2");
  assert.equal(code({ unitClass: "Extreme", unitType: "TEQ", enemyClass: "Extreme", enemyType: "INT" }), "w1", "INT beats TEQ");
  assert.equal(code({ unitClass: "Super", unitType: "STR", enemyType: "STR" }), "n1", "same Type is neutral");
  assert.equal(code({ unitClass: "Super", unitType: "STR", enemyClass: "Extreme", enemyType: "" }), "n2", "mixed Types");
  assert.match(E.describeMatch(Object.assign(E.defaults(), { unitType: "TEQ", enemyType: "AGL" })), /It beats this Type: its normal hits deal 1.25×.*takes 0.45×/);
});

test("a Type that beats it: 0.9 / 1.0 hits, 1.25 / 1.5 taken, crits and guard still work", () => {
  // Normal 10 x 0.9 = 9; crit 30% at 1.875.
  near(build(base({ match: "w1" }), { C: 15 }).dmg, ((0.3 * 1.875 + 0.7 * 0.9) / 0.9 - 1) * 100, "same class");
  const t = (m, guard) => E.takenMult(E.MATCH[m], guard, 0);
  near(t("w1", false), 1.25, "taken, same class");
  near(t("w2", false), 1.5, "taken, Super vs Extreme");
  near(t("w1", true), 0.45, "guard ignores the disadvantage");
});

test("the kit's lines turn into attacks, crits and counters", () => {
  // One guaranteed additional Super and a 50% chance of another: 1.5 extra Supers,
  // 2 or 3 attacks before the Hidden Potential additional.
  let k = E.kitForm(Object.assign(E.defForm("A"), { addSup: 1, addSupPct: 50, addNorm: 0, addNormPct: 20 }), true);
  near(k.xs, 1.5, "extra Supers");
  near(k.xn, 0.2, "extra normal attacks");
  assert.deepEqual(plain(k.dist.map((x) => x[0])), [2, 3, 4]);
  near(k.dist[0][1], 0.5 * 0.8, "two attacks");
  near(k.dist[2][1], 0.5 * 0.2, "four attacks");
  // 60% crit on Supers only: 2.5 Supers of 3 attacks.
  k = E.kitForm(Object.assign(E.defForm("A"), { addSup: 1, addSupPct: 50, addNorm: 0, addNormPct: 50, crit: 60, critOn: "super" }), true);
  near(k.nc, 0.6 * 2.5 / 3, "Supers-only crit");
  // "Raises ATK by 20% for the battle" after 3 Supers.
  near(E.kitForm(Object.assign(E.defForm("A"), { stackPer: 20, stackN: 3 }), true).st, 0.6, "stacked ATK");
  // A 300% counter, 2 attacks received: 6 on top of the 10 turn; ATK +10% per hit
  // before it attacks adds 0.2 x 10. Counters still happen when it evades.
  const ctr = base({ form: { ctrHit: 300, atkHit: 10 } });
  near(E.model(ctr).forms[0].D0, 18, "counter plus ATK per hit");
  // SA Boost 10 lifts only its own attacks: 11 + 6 + 0.2 x 11.
  near(build(ctr, { S: 10 }).dmg, (19.2 / 18 - 1) * 100, "SA Boost skips counters");
  // Crit lifts the counters too: everything x (0.3 x 1.875 + 0.7).
  near(build(ctr, { C: 15 }).dmg, 26.25, "Crit");
  // 10% dodge: the counters stay, ATK per hit falls to 2 x 0.9 x 0.1.
  near(build(ctr, { E: 10 }).dmg, (17.8 / 18 - 1) * 100, "Evasion");
  // Each counter is a Hidden Potential check: 1 - 0.7^(1 + 2).
  near(build(ctr, { A: 15 }).sup, 50 * (1 - Math.pow(0.7, 3)), "additional chance");
  near(E.model(base({ form: { ctrHit: 300, ctrOn: "normal" } })).forms[0].D0, 10 + 2 * 0.8 * 3, "counters normal attacks only");
  // Counters when it evades, against a Type it beats: 2 x 3 x 1.25 per unit of dodge on a 12.5 turn.
  near(build(base({ match: "b1", form: { ctrDodge: 300 } }), { E: 10 }).dmg, 6, "counter on evade");
});

test("slot advice weighs the answers", () => {
  const q = (o) => Object.assign(E.defaults().q, o);
  const a = (o, M) => E.adviseSlot(q(o), M);
  const hit = (size, hv, dv) => ({ size, forms: [{ w: 1, gains: hv > 0 || dv > 0 }] });
  assert.equal(a({ links: true }).slot, "2");
  assert.equal(a({ protect: "y", links: true }).slot, "1");
  let r = a({ kisphere: true, links: true, startpos: true });
  assert.equal(r.slot, "1");
  assert.deepEqual(plain([r.pts[1], r.pts[2], r.pts[3]]), [2, 2, 0]);
  assert.match(r.notes.join(" "), /close call/);
  assert.match(r.notes.join(" "), /starts its next turn 3rd/);
  assert.equal(a({ payoff: "y" }).slot, "23");
  assert.equal(a({ named: "3", protect: "y" }).slot, "3");
  assert.equal(a({}, hit(1, 0.3, 0)).slot, "1", "counters favour slot 1");
  assert.equal(a({ payoff: "y" }, hit(1, 0.3, 0)).slot, "23");
  assert.equal(a({}, hit(0.3, 0, 0)).slot, "1");
  r = a({ links: true }, hit(2, 0, 0));
  assert.deepEqual(plain([r.pts[1], r.pts[2]]), [-1, 2]);
  assert.equal(r.breakdown, "slot 1 −1 (big hits −1); slot 2 2 (links +2); slot 3 0");
  assert.equal(a({}).slot, "");
  r = a({}, hit(1.5, 0, 0.2));
  assert.equal(r.slot, "");
  assert.match(r.why, /cancel out/);
});

// Ten example characters (representative values, not exact cards). The checks
// are directions the picks must move in, not exact builds.
const ARCH = {
  nuker: (s) => { Object.assign(s, { dmgShare: 45, slot: "2" }); },
  support: (s) => { Object.assign(s, { rarity: "UR", dmgShare: 15, slot: "1", hitSize: "1.5" }); Object.assign(s.forms[0], kit({ sa12: 3.5, xs: 0 })); },
  tank: (s) => { Object.assign(s, { rarity: "UR", dmgShare: 15, slot: "1", dr: 60, guard: true }); Object.assign(s.forms[0], kit({ sa12: 3.5, xs: 0 })); },
  counter: (s) => { Object.assign(s, { rarity: "UR", dmgShare: 25, slot: "1", hitSize: "1.5" }); Object.assign(s.forms[0], kit({ xs: 0, hitVal: 60 })); },
  counterNone: (s) => { ARCH.counter(s); s.forms[0].atkHit = 0; },
  evader: (s) => { Object.assign(s, { rarity: "UR", dmgShare: 33, slot: "1" }); Object.assign(s.forms[0], kit({ nd: 20, xs: 0.5, dodgeVal: 50 })); },
  evaderNone: (s) => { ARCH.evader(s); s.forms[0].atkDodge = 0; },
  nativeDodge: (s) => { Object.assign(s, { rarity: "UR", dmgShare: 33, slot: "1" }); Object.assign(s.forms[0], kit({ nd: 30, xs: 0.5, dodgeVal: 30 })); },
  nativeDodgeNone: (s) => { ARCH.nativeDodge(s); s.forms[0].eva = 0; },
  highCrit: (s) => { ARCH.nuker(s); s.forms[0].crit = 70; },
  stacker: (s) => { ARCH.nuker(s); Object.assign(s.forms[0], kit({ stack: 200, xs: 1.5 })); },
  typeAdv: (s) => { ARCH.nuker(s); setMatch(s, "b1"); },
  transform: (s) => {
    ARCH.nuker(s);
    s.forms = [Object.assign({}, s.forms[0], kit({ name: "Base", share: 40, sa12: 3.5, sa18: 4.5, k12: 1.4, xs: 0.5 })),
               Object.assign({}, s.forms[0], kit({ name: "Transformed", share: 60, xs: 2, nc: 30 }))];
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

// Kits as the game and DokkanStats show them (from the Dokkan wiki's card pages).
const BROLY = {
  sa12: "Greatly raises ATK, raises DEF and causes immense damage to enemy",
  passive: `Basic effect(s)
- Ki +3
- ATK & DEF 260%↑
- Damage reduction rate & chance of performing a critical hit 26%↑
- Launches an additional attack that has a high chance of becoming a Super Attack
When attacking
- ATK & DEF 26%↑
When there is a "Pure Saiyans", "Hybrid Saiyans" or "Movie Heroes" Category enemy
- Ki +3
- Launches an additional attack that has a great chance of becoming a Super Attack
- Damage reduction rate & chance of performing a critical hit 18%↑ when attacking`,
  active: "Ki +6, ATK +60% and attacks effective against all Types for 1 turn",
};

test("reading a pasted kit: basic effects count, conditions wait for a tick", () => {
  const r = E.readKit(BROLY, false, true);
  // Immense damage at SA level 15 (an Extreme Z-Awakened UR) is 630%; "greatly raises ATK" for the battle is +50%.
  assert.deepEqual(plain(r.form), { sa12: 630, stackPer: 50, crit: 26, addMix: 1, addMixPct: 50, atkAll: 26 });
  assert.deepEqual(plain(r.card), { dr: 26, drSup: 0, guard: false });
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0].on, false);
  assert.ok(r.skipped.some((x) => /Start-of-turn/.test(x)), "ATK & DEF 260% is left out");
  assert.ok(r.skipped.some((x) => /Active Skill without an attack/.test(x)));
  // Ticking the Saiyan condition adds its effects; the two additional attacks average 50% and 70%.
  const on = E.readKit(BROLY, false, true, [r.groups[0].head]);
  assert.deepEqual(plain(on.form), { sa12: 630, stackPer: 50, crit: 44, addMix: 2, addMixPct: 60, atkAll: 26 });
  assert.equal(on.card.dr, 44);
});

test("reading a LR kit: Ultra Super, stated percentages and an Active Skill", () => {
  const r = E.readKit({
    sa12: "Raises ATK for 4 turns and causes colossal damage to enemy",
    sa18: "Raises ATK & DEF by 58% for 1 turn and causes mega-colossal damage to enemy",
    passive: `Basic effect(s)
- Ki +7 and ATK & DEF 350%↑
- Damage reduction rate 58%↑
- Guards all attacks
- ATK & DEF 58%↑ and damage reduction rate 10%↑ for allies whose names include "Piccolo"`,
    active: "Raises ATK by 580% temporarily and causes ultimate damage to enemy; DEF +100% for 1 turn",
  }, true, false);
  // Colossal 425% and mega-colossal 570% at LR SA level 20; the 18 Ki Super's raise is the one used.
  assert.deepEqual(plain(r.form), { sa12: 425, sa18: 570, saTurn: 58 });
  assert.deepEqual(plain(r.card), { dr: 58, drSup: 0, guard: true }, "the allies' 10% is left out");
  // Ultimate damage 550% + 580%.
  assert.deepEqual(plain(r.act), { actMult: 1130, actUses: 1 });
});

test("reading an older passive written in one line", () => {
  const r = E.readKit({ passive: "ATK & DEF +120%; ATK +50% when performing a Super Attack; launches an additional Super Attack; high chance of evading enemy's attack; counters with tremendous power; rare chance of performing a critical hit" }, false, false);
  assert.deepEqual(plain(r.form), { atkSup: 50, eva: 50, addSup: 1, ctrHit: 300, ctrOn: "all" });
  assert.ok(r.check.some((x) => /rare/.test(x)), "a rare chance needs a number");
  assert.ok(r.check.some((x) => /Ki multiplier/.test(x)));
  // Counters on Supers with a chance: 50% x 300%.
  const n = E.readKit({ passive: "When receiving a Super Attack\n- High chance of nullifying it and countering with tremendous power" }, false, false, ["When receiving a Super Attack"]);
  assert.equal(n.form.ctrHit, 150, "entered in %");
  assert.equal(n.form.ctrOn, "super");
});
