import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ctx={};vm.createContext(ctx);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1]+';this.G={CHARACTER_KITS,guideDefaults,kitRecommendation,normalizeState};',ctx);
const {CHARACTER_KITS,guideDefaults,kitRecommendation,normalizeState}=ctx.G;
const plain=x=>JSON.parse(JSON.stringify(x));
const profile=(id,extra={})=>({...guideDefaults(),profileId:CHARACTER_KITS[id].id,...extra});

test('reviewed recommendations bind to exact current card states and sources',()=>{
 assert.equal(CHARACTER_KITS.length,3);
 assert.equal(new Set(CHARACTER_KITS.map(p=>p.id)).size,3);
 for(const p of CHARACTER_KITS){assert.match(p.source,/^https:\/\/dokkanstats.com\/en\/cards\/\d+\/$/);assert.ok(p.release>='2025-01-01');assert.ok(p.sections.passive&&p.sections.super&&p.sections.active&&p.sections.other)}
 assert.deepEqual(plain(kitRecommendation(profile(0)).order),[1,0,2],'Goku crit unlocks first-Super EX');
 assert.deepEqual(plain(kitRecommendation(profile(1)).order),[0,1,2],'Vegeta additional Super EX and attack thresholds');
 assert.deepEqual(plain(kitRecommendation(profile(2)).excluded),[1],'Broly completed buildup caps native crit');
 assert.equal(kitRecommendation({...guideDefaults(),profileId:'1031921:eza'}).status,'empty','no fallback to another awakening');
});

test('character-first recommendations cannot depend on enemy or damage-calculator inputs',()=>{
 const state=normalizeState({v:3,guide:profile(1)}),before=plain(kitRecommendation(state.guide));
 Object.assign(state,{enemyType:'INT',enemyClass:'Extreme',enemyDef:95,hits:30,dmgShare:60,cardAtk:1,guard:true});
 Object.assign(state.forms[0],{ki:12,k12:999,sa12:4000,crit:100,eva:100});
 assert.deepEqual(plain(kitRecommendation(state.guide)),before);
});

test('dupes unlock gold recommendations without fabricating board-level totals',()=>{
 const inventory='bronze atk 800\nsilver additional 7\ngold additional 7';
 const a=kitRecommendation(profile(1,{inventory,dupes:1}));
 assert.equal(a.slots[2].locked,true);assert.equal(a.slots[2].pick,null);
 const b=kitRecommendation(profile(1,{inventory,dupes:2}));
 assert.equal(b.slots[2].locked,false);assert.equal(b.slots[2].pick.n,'Additional 7');
 assert.match(b.board,/Exact level totals require/);assert.equal('tot' in b,false);
});

test('orb priority matching is ordinal and uses only supplied compatible inventory',()=>{
 const g=profile(1,{dupes:2,inventory:'silver crit 7\nsilver additional 3\nsilver additional 3 atk 500\nsilver additional+crit 3\ngold junk 8'});
 const r=kitRecommendation(g);
 assert.equal(r.bad,1);
 // Three Additional beats zero; among equal Additional, secondary Crit beats ATK.
 assert.equal(r.slots[1].pick.n,'Additional 3 + Crit 3');
 assert.equal(r.slots[0].pick,null);assert.equal(r.slots[2].pick,null);
 assert.ok(r.orbMethod.includes('do not compare exact combat value'));
 const capped=kitRecommendation(profile(2,{inventory:'silver crit 7'}));
 assert.equal(capped.slots[1].pick,null,'do not spend orb slot on capped crit');
});

const manual=(extra={})=>({...guideDefaults(),profileId:'custom',custom:{name:'Unlisted support',awakening:'UR EZA',role:'support',crit:'none',superReward:'no',attackReward:'no',hitReward:'no',critReward:'no',dodgeReward:'no',formChange:'no',...extra}});
test('unlisted characters require reviewed traits and remain provisional',()=>{
 assert.equal(kitRecommendation({...guideDefaults(),profileId:'custom'}).status,'incomplete');
 assert.equal(kitRecommendation(manual({superReward:'unknown'})).status,'incomplete');
 assert.equal(kitRecommendation(manual({crit:'typo'})).status,'incomplete');
 assert.equal(kitRecommendation(manual()).status,'provisional');
 assert.deepEqual(plain(kitRecommendation(manual()).order),[2,0,1]);
 assert.equal(kitRecommendation(manual({critReward:'yes'})).order[0],1);
 assert.equal(kitRecommendation(manual({superReward:'yes'})).order[0],0);
 assert.equal(kitRecommendation(manual({hitReward:'yes'})).order.at(-1),2);
 const capped=kitRecommendation(manual({crit:'guaranteed',critReward:'yes',superReward:'yes'}));
 assert.equal(capped.order[0],0);assert.deepEqual(plain(capped.excluded),[1]);
 assert.ok(kitRecommendation(manual({formChange:'yes'})).reasons.some(r=>r.includes('Another form')));
});

test('v3 calculator saves gain an empty guide; v4 saves retain exact kit and orbs',()=>{
 const old=normalizeState({v:3,name:'Old card',forms:[{addSup:2}],enemyType:'INT'});
 assert.equal(old.v,4);assert.equal(old.guide.profileId,'');assert.equal(old.forms[0].addSup,2);assert.equal(old.enemyType,'INT');
 const g=profile(1,{dupes:2,inventory:'silver additional 7'});
 const n=normalizeState({v:4,guide:g});assert.deepEqual(plain(n.guide),plain(g));
});
