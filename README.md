# Dokkan build finder

A single-page tool that picks Hidden Potential levels and skill orbs for one Dokkan Battle character. Open `index.html` in a browser. It has no build step or dependencies, and it works offline apart from the web font.

It tries every orb setup in the bronze, silver and gold slots and every way to place your Potential levels. It ranks the builds by how much they widen the team's margin in a fight.

## Kit entry and supported scope

The kit editor keeps the full leader, Super, passive, active/standby/transformation and other kit text, plus its source and exact awakening state. Reference text is saved and included in the copyable review; it is not parsed into mechanics. There is no bundled character database or automatic character import.

Choose a battle situation (turn, slot, spheres, HP and active conditions) and enter the supported numbers for that situation. The routing guide explains which inputs apply and which effects need an approximation or remain unsupported. Kit review defaults to incomplete; missing effects and assumptions appear next to the result. “All relevant effects entered” is the user's review, not independent verification. Starting Super/Ki multipliers are examples. New states start with no additional attacks; old saved attack values are preserved.

An additional attack with a chance of becoming a Super is entered as an attack count/launch chance and a separate conversion chance. It always counts as one attack for Hidden Potential checks, regardless of whether it becomes a Super. All attacks in that group share a conversion chance; mixed conversion groups need a recorded approximation. This introduces no new game constants. Super-only native crit is now applied to Super damage separately from normals (including Hidden Potential additional attacks); its displayed chance is weighted by expected attack counts. Search factorization is disabled for that case and the exact fallback is checked against brute force.

Guard and damage reduction remain scenario-wide. Forms are weighted steady states, not a timeline. Passive stat buckets, temporary Super buffs, DEF buildup, active/finish damage, revival, domains, nullification and enemy dodge cancellation are not simulated. The hit/dodge damage-gain controls are explicitly estimates; copying passive ATK percentages into them is not an exact calculation.

## What you enter

Everything comes from the card, its DokkanStats page, or the fight:

1. **The card:** rarity, class and Type, damage reduction and guard from its passive.
2. **The kit, per form:** the 12 and 18 Ki Super multipliers and the Ki multipliers in %, "raises ATK by X% for the battle" stacks, guaranteed and chance-based additional Supers and attacks, crit and evasion chances, and counters or ATK gained when it's hit or evades.
3. **The fight:** the enemy's class and Type (the matchup is worked out from them), its slot, how many attacks the enemy makes, and how much of the team's damage it deals.
4. **Orbs and Hidden Potential:** the orbs you own, or orb levels to try, and your board limits.
5. **Which slot?:** questions about the kit for the slot advice.

## How builds are scored

A fight is treated as a race between the team's damage and its HP:

**team margin = (1 + damage share × damage gain) ÷ (1 − cut in team HP loss) − 1**

- **Damage gain:** this unit's expected damage per turn against no Hidden Potential skills and no orbs, averaged over its forms by share of turns. It counts by the unit's share of the team's damage on its turns: little (15%), an even share (33%), a lot (45%) or most of it (60%).
- **Cut in team HP loss:** the team shares one HP bar, so a dodge counts by the share of the team's incoming damage this unit takes. That share is the enemy attacks it receives in its slot (about 40% in slot 1, 30% in slots 2 and 3 unless you enter a count) times how big its hits are next to a teammate's (from its damage reduction, guard and Type matchup, or picked). Type DEF and Recovery also cut the loss.
- 1% more team damage is worth the same as 1% less team HP lost per turn. So Evasion wins on fragile units that deal little damage, and loses on tanks and main damage dealers.
- Counters are worth ATK × the counter multiplier × the Type multiplier; "ATK +X%" when hit or evading adds X% to its own attacks. Both grow with its damage. A dodge avoids the hit, swapping what a received hit is worth for what a dodge is worth.

The search is exact. Damage skills (Additional, Crit, SA Boost, Type ATK) and defence skills (Evasion, Type DEF, Recovery) form two blocks. For every defence split, the margin only rises with the damage block, so the best damage split for the remaining levels is the right partner. The tests compare the result with a brute force over every orb setup and every Potential split.

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

**Corrected in this version:** damage taken from a Type it beats was 0.95 (unsourced); it's 0.9 or 1.0 plus the natural guard. Hits on a Type it beats were 1.5× in every class; same-class hits are 1.25×.

**Not verified:** the 15-level cap per skill, which skill each Type's star node gives, the slot shares of enemy attacks (40/30/30), and the rotation note ("a unit put 2nd starts its next turn 3rd"). Recovery Boost's per-level healing isn't known, so you estimate its effect.

## Slot advice

Each answer adds points to the slots it favours: protection before attacking +3 to slot 1, per-Ki-Sphere kits +2 to slot 1, links +2 to slot 2, stacking payoffs +1.5 to slots 2 and 3, counter or evade gains +1 to slot 1, small hits +1 to slot 1, big hits −1 to slot 1. A position named by the kit always wins. The points are shown with the advice so you can weigh them yourself.

## Checks

```sh
node --test
```

The tests check hand-worked values for each formula and compare the search with a brute force. They also run ten example characters (fragile support, tank, counter unit, evade-reward unit, high native crit, stacker, Type advantage, transforming unit, high enemy DEF and a plain nuker) and check that the picks move the right way.

## Saved data

Inputs are stored in the browser under `dokkanBuildFinder.v1`. Characters saved by earlier versions of this page are converted when loaded. Inputs saved by the first version (`hipo3`) are offered once for import and are never deleted.

The previous React app in this repository is preserved in git history (last commit `34e4d5b`).
