# Dokkan build finder

A single-page tool that picks Hidden Potential levels and skill orbs for one Dokkan Battle character. Open `index.html` in a browser. It has no build step or dependencies, and it works offline apart from the web font.

It tries every orb setup in the bronze, silver and gold slots and every way to place your Potential levels. It ranks the builds by how much they widen the team's margin in a fight.

## What you enter

Everything comes from the card, its DokkanStats page, or the fight:

1. **The card:** rarity, class and Type, damage reduction (also against Supers only) and guard from its passive, and its DEF in battle (optional).
2. **The kit, per form:** only the Super Attack is needed. The 12 and 18 Ki Super multipliers and the Ki multipliers in %, or the odds of the Ki it reaches. Optional sections open when the kit has something in them:
   - **Super Attack effects:** "raises ATK for 1 turn", "raises ATK" for the battle (with a limit), "lowers DEF", Supers that hit all enemies.
   - **Additional attacks:** guaranteed and chance-based additional Supers and attacks.
   - **Crit, evasion and Type:** crit and evasion chances, "attacks effective against all Types".
   - **ATK boosts when it attacks:** "when performing a Super Attack", "with each attack performed" (within the turn or for the battle), "with each attack received" for the battle.
   - **When it's attacked:** counters (any attack, normal attacks only or Supers only), counters when it evades, ATK gained per hit or dodge before it attacks.
   - **Active or Finish Skill attacks:** their multiplier and how often.
   A "Where each line of the kit goes" list on the page maps kit wording to these inputs and lists what to skip.
3. **The fight:** the enemy's class and Type (the matchup is worked out from them), its slot, how many attacks the enemy makes, and how much of the team's damage it deals. Under "More about the fight": the turns it attacks, enemy DEF, attacks it can't evade, the share and size of enemy Supers, the enemy's ATK and teammates' DEF.
4. **Orbs and Hidden Potential:** the orbs you own, or orb levels to try, and your board limits.
5. **Which slot?:** questions about the kit for the slot advice.

## How builds are scored

A fight is treated as a race between the team's damage and its HP:

**team margin = (1 + damage share × damage gain) ÷ (1 − cut in team HP loss) − 1**

- **Damage gain:** this unit's expected damage per turn against no Hidden Potential skills and no orbs, averaged over its forms by share of turns. It counts by the unit's share of the team's damage on its turns: little (15%), an even share (33%), a lot (45%) or most of it (60%).
- **Cut in team HP loss:** the team shares one HP bar, so a dodge counts by the share of the team's incoming damage this unit takes. That share is the enemy attacks it receives in its slot (about 40% in slot 1, 30% in slots 2 and 3 unless you enter a count) times how big its hits are next to a teammate's (from its damage reduction, guard and Type matchup, or picked). Type DEF and Recovery also cut the loss.
- 1% more team damage is worth the same as 1% less team HP lost per turn. So Evasion wins on fragile units that deal little damage, and loses on tanks and main damage dealers.
- **A turn** is its main Super, the kit's extra Supers and attacks, then the Hidden Potential additional (half of them Supers), averaged over the turns it attacks in the fight. A Super's ATK raise counts for that Super and the attacks after it, and "for the battle" raises carry over (up to their limit). On-attack boosts (on Supers, per attack performed or received, per hit before it attacks) add up with each other and then multiply. Start-of-turn boosts, leader skills and links multiply every attack alike, so they don't change the ranking and aren't asked for.
- **Counters** hit for ATK × (1 + raised ATK) × the counter multiplier × the Type multiplier. Crit and Type ATK count for them; SA Boost and Additional don't. It counters whether it's hit or evades, and each counter, like each attack and Active Skill attack, is a separate Hidden Potential additional check. "ATK +X%" per hit before it attacks is lost when it dodges; per dodge it's gained.
- **Hits it takes,** with the enemy's ATK entered: (enemy ATK × (1 − damage reduction) × Type multiplier − DEF) × guard, for normal attacks and Supers, against a teammate with no damage reduction or guard. Without it, DEF is left out.

The search is exact. Damage skills (Additional, Crit, SA Boost, Type ATK) and defence skills (Evasion, Type DEF, Recovery) form two blocks. A form's damage is a straight line in its dodge chance, so it's written as non-negative parts with weights set by the defence split (its damage if it never dodged, weight 1 − dodge; if it always dodged, weight dodge). For every defence split, the margin only rises with the weighted damage parts, so the best damage split for the remaining levels is the right partner. Each part is crit chance × crit multiplier × V + (1 − crit chance) × W, with V from Additional and SA Boost and W adding Type ATK and enemy DEF, so small tables replace most of the work. The tests compare the result with a brute force over every orb setup and every Potential split, including stacks, Ki odds, all-target Supers, Active Skills, lowered DEF, counters, DEF hit sizes and attacks it can't evade.

Under the best build, "one more level" shows what one more level of each skill would add, which helps when weighing orbs you don't have yet.

## Game values

| Value | Used | Source |
|---|---|---|
| Per level | Additional +2% (one check per eligible attack, half Supers), Crit +2%, Evasion +1%, SA Boost +0.05, Type ATK +0.05 | gamerch, checked in review |
| Type DEF | −0.01 per level on the type multiplier, only against a Type it beats | [DokkanStats: damage received](https://dokkanstats.com/en/guides/how-to-compute-damage-received-v68kfr/) (via search summary), matches kamigame's Lv15 example (0.45 → 0.375) |
| Normal hits | neutral 1×, neutral Super vs Extreme 1.15×, a Type it beats 1.25× (same class) or 1.5× (Super vs Extreme) plus Type ATK, a Type that beats it 0.9× or 1.0× | [kamigame type table](https://kamigame.jp/%E3%83%89%E3%83%83%E3%82%AB%E3%83%B3%E3%83%90%E3%83%88%E3%83%AB/page/268783369976870200.html) |
| Crits | ignore enemy DEF, hit as super effective: 1.5 × 1.25 = 1.875, or (1.5 + Type ATK) × 1.25 against a Type it beats | gamerch, kamigame |
| Damage taken | from a Type it beats: 0.9 (same class) or 1.0 (Super vs Extreme), then the 0.5 natural guard; guarding gets the same without Type DEF; from a Type that beats it 1.25 or 1.5; neutral Super vs Extreme 1.15 | DokkanStats, kamigame |
| Ki | blended between the card's 12 Ki and 24 Ki multipliers; 18 Ki Super from 18 Ki; additionals use the 12 Ki Super and multiplier | DokkanStats ATK guide |
| Orbs | bronze stats only (ATK +800), one-skill orbs up to 7, two-skill silver orbs 4 + 4 | Dokkaninfo |
| Attack order | start-of-turn passives, links, Ki, then on-attack passives ("when performing a Super", "with each attack received / performed"), then the SA multiplier, then Type and crit; start-of-turn and on-attack boosts multiply | [Dokkan wiki: Super Attack Multipliers](https://dbz-dokkanbattle.fandom.com/wiki/Super_Attack_Multipliers), [Raise ATK](https://dbz-dokkanbattle.fandom.com/wiki/Raise_ATK) |
| Super ATK raises | added to the SA multiplier, including the current Super's own raise; normal attacks and counters get (1 + raises from earlier Supers); additional Supers raise again; raise sizes +30% / +50% / +100% | [Dokkan wiki: Stack Attack](https://dbz-dokkanbattle.fandom.com/wiki/Stack_Attack) |
| Counters | still happen when it evades; each counter has its own Hidden Potential additional check, as does an Active Skill attack | [Dokkan wiki: Counterattack](https://dbz-dokkanbattle.fandom.com/wiki/Counterattack), [Evasion](https://dbz-dokkanbattle.fandom.com/wiki/Evasion), [Additional Attack](https://dbz-dokkanbattle.fandom.com/wiki/Additional_Attack) |
| Effective against all Types | attacks with Type advantage, so Type ATK applies | [Dokkan wiki: Attack Effective to All](https://dbz-dokkanbattle.fandom.com/wiki/Attack_Effective_to_All), [Hidden Potential System](https://dbz-dokkanbattle.fandom.com/wiki/Hidden_Potential_System) |
| Lowers DEF | 30–40%, greatly 50%, massively 80%; lasts 3 turns and stacks | [Dokkan wiki: Lower DEF](https://dbz-dokkanbattle.fandom.com/wiki/Lower_DEF) |
| Recovery Boost | (0.030 + 0.0015 × level) × DEF in battle × Ki Spheres of its Type | [Dokkan wiki: Hidden Potential System](https://dbz-dokkanbattle.fandom.com/wiki/Hidden_Potential_System) |
| Damage received | enemy ATK × multipliers × (1 − damage reduction) × Type multiplier, minus DEF, then guard; floors at 0 | [DokkanStats: damage received](https://dokkanstats.com/en/guides/how-to-compute-damage-received-v68kfr/) (via search summary) |

**Corrected in this version:** a Super's own ATK raise now counts for that Super (stacks were one Super short). Counters still happen when the unit evades, so Evasion no longer cuts counter damage. Counters no longer grow with Additional and SA Boost. Recovery Boost is worked out from its formula when the enemy's ATK, DEF and Ki Spheres are known.

**Corrected earlier:** damage taken from a Type it beats was 0.95 (unsourced); it's 0.9 or 1.0 plus the natural guard. Hits on a Type it beats were 1.5× in every class; same-class hits are 1.25×.

**Not verified:** the 15-level cap per skill, which skill each Type's star node gives, the slot shares of enemy attacks (40/30/30), and the rotation note ("a unit put 2nd starts its next turn 3rd"). Also: whether counters and Active Skill attacks can crit (counted: yes) and use the Ki multiplier (counted: no); where the Hidden Potential additional falls in the turn (counted: last); that a lowered DEF from its previous attacking turn is still up on its next; that on-attack boosts count for counters only through "per attack received"; positions of chance-based attacks (counted at their average); the enemy's Super share (20%) and size (2.5×) defaults, which are inputs.

## What's left out

These don't change the pick, so they aren't asked for: start-of-turn ATK and DEF boosts, per Ki Sphere or per ally boosts, leader skills and links (they raise every attack alike).

These aren't modelled: HP stat nodes, which skills each board route offers, revival, healing other than Recovery Boost, enemy ATK down, stun and seal (enter fewer attacks received instead), Unit Super Attacks, and effects that switch on mid-fight (use another form with its share of turns). The ATK gained when hit counts every attack received, not only the ones before it attacks in that turn.

## Slot advice

Each answer adds points to the slots it favours: protection before attacking +3 to slot 1, per-Ki-Sphere kits +2 to slot 1, links +2 to slot 2, stacking payoffs +1.5 to slots 2 and 3, counter or evade gains +1 to slot 1, small hits +1 to slot 1, big hits −1 to slot 1. A position named by the kit always wins. The points are shown with the advice so you can weigh them yourself.

## Checks

```sh
node --test
```

The tests check hand-worked values for each formula and compare the search with a brute force. They also run ten example characters (fragile support, tank, counter unit, evade-reward unit, high native crit, stacker, Type advantage, transforming unit, high enemy DEF and a plain nuker) and check that the picks move the right way.

## Saved data

Inputs are stored in the browser under `dokkanBuildFinder.v1`; each saved character carries its own version (now 4). Characters saved by earlier versions of this page are converted when loaded: a version 3 character with ATK stacks keeps a one-turn fight, since it stored stacks as a snapshot. Inputs saved by the first version (`hipo3`) are offered once for import and are never deleted.

The previous React app in this repository is preserved in git history (last commit `34e4d5b`).
