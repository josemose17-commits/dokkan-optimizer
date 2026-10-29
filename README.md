# Dokkan build finder

A single-file character-kit advisor with an optional advanced fight calculator. Open `index.html` in a browser; there is no build step or application dependency.

## Main flow: character → dupes → compatible orbs

The default view asks for an exact character/awakening, duplicates used to open routes, and optionally compatible orbs the user owns. It returns skill priorities, kit-based reasons, conditional alternatives, an orb plan and a copyable review. No enemy, hit count, team damage share, expected Ki or multiplier is required. The advanced engine does not even run until its section is opened, and its inputs never affect the main recommendation.

Three source-reviewed snapshots are included, checked October 29, 2026:

| Exact card state | Source |
| --- | --- |
| LR STR SSJ4 Goku (DAIMA), Maximum-Power Battle, standard | [1032551](https://dokkanstats.com/en/cards/1032551/) |
| LR TEQ SSJ3 Vegeta (DAIMA), Earth-Shattering Climax, standard | [1032581](https://dokkanstats.com/en/cards/1032581/) |
| LR TEQ Broly (Wrathful), Relentlessly Surging Power, standard | [1031921](https://dokkanstats.com/en/cards/1031921/) |

Dokkan Info was attempted but inaccessible during this work (402 / fetch failures), so these snapshots use DokkanStats. These are source-documented facts, not independent game verification or a complete current catalog. The exact state and snapshot date are bound to each profile; unknown IDs or different awakenings do not borrow another kit. No full source kit text or bulk dataset is copied. The game contains different Ki multipliers (these sources show different 12-Ki values); the main advisor does not require them or calculate damage from them.

Priorities are an explicit inference from kit interactions, not a numerical optimum. The first profile recognizes crit-triggered EX access and its conditional crit saturation; the second recognizes additional-Super EX and attack-count rewards; the third favors stacking/buildup and avoids spending on crit that caps natively. Source summaries separate passive, Super/EX, active and other kit effects. Conditional alternatives and omitted numerical interactions are shown with the result.

Unlisted characters use short kit questions with unknown defaults. Advice remains unavailable until the identity, awakening and traits are filled, and stays labeled provisional afterward. Pasted text and names are not silently parsed. Form-dependent changes and dodge/received-hit tradeoffs remain explicit.

Orb matching is ordinal: most levels of the first useful priority, then the next priority, then ATK. It only considers the supplied compatible inventory; it does not infer category/exclusive-orb restrictions or compare exact combat utility. Guaranteed-native-crit profiles exclude crit-only picks. Gold is excluded below two opened routes; silver assumes SA level 10. Empty inventory means no invented orb choices. Stat parsing currently supports ATK, not DEF/HP. Type ATK/DEF and Recovery do not have a general-purpose recommendation here.

Dupe counts provide route/orb context, not fabricated legal level totals. Exact per-route allocation and a proven global optimum still require board mappings and a broader mechanics evaluation. This release is a character-first priority advisor, not completion of those missing systems.

## Optional advanced calculator

The previous manual calculator is preserved under a collapsed section. Its team-margin objective and exact search are unchanged. It has independent inputs and recommendations; selecting a main-view character does not populate or verify its example numbers.

## Kit entry and supported scope

The kit editor keeps the full leader, Super, passive, active/standby/transformation and other kit text, plus its source and exact awakening state. Reference text is saved and included in the copyable review; it is not parsed into mechanics. The advanced text fields do not automatically import a character or populate its numerical inputs.

Choose a battle situation (turn, slot, spheres, HP and active conditions) and enter the supported numbers for that situation. The routing guide explains which inputs apply and which effects need an approximation or remain unsupported. Kit review defaults to incomplete; missing effects and assumptions appear next to the result. “All relevant effects entered” is the user's review, not independent verification. Starting Super/Ki multipliers are examples. New states start with no additional attacks; old saved attack values are preserved.

An additional attack with a chance of becoming a Super is entered as an attack count/launch chance and a separate conversion chance. It always counts as one attack for Hidden Potential checks, regardless of whether it becomes a Super. All attacks in that group share a conversion chance; mixed conversion groups need a recorded approximation. This introduces no new game constants. Super-only native crit is now applied to Super damage separately from normals (including Hidden Potential additional attacks); its displayed chance is weighted by expected attack counts. Search factorization is disabled for that case and the exact fallback is checked against brute force.

Guard and damage reduction remain scenario-wide. Forms are weighted steady states, not a timeline. Passive stat buckets, temporary Super buffs, DEF buildup, active/finish damage, revival, domains, nullification and enemy dodge cancellation are not simulated. The hit/dodge damage-gain controls are explicitly estimates; copying passive ATK percentages into them is not an exact calculation.

## Advanced inputs

Everything comes from the card, its DokkanStats page, or the fight:

1. **The card:** rarity, class and Type, damage reduction and guard from its passive.
2. **The kit, per form:** the 12 and 18 Ki Super multipliers and the Ki multipliers in %, "raises ATK by X% for the battle" stacks, guaranteed and chance-based additional Supers and attacks, crit and evasion chances, and counters or ATK gained when it's hit or evades.
3. **The fight:** the enemy's class and Type (the matchup is worked out from them), its slot, how many attacks the enemy makes, and how much of the team's damage it deals.
4. **Orbs and Hidden Potential:** the orbs you own, or orb levels to try, and your board limits.
5. **Which slot?:** questions about the kit for the slot advice.

## How advanced builds are scored

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

Inputs are stored in the browser under `dokkanBuildFinder.v1`. State version 4 adds the independent guide; v1–v3 states keep their advanced inputs and start with no selected guide profile. Future-version current or saved states prevent writes to the store. Characters saved by earlier versions of this page are converted when loaded. Inputs saved by the first version (`hipo3`) are offered once for import and are never deleted.

The previous React app in this repository is preserved in git history (last commit `34e4d5b`).

## Validation for character-first flow

Run `node --test`. The guide tests check exact-state binding, incomplete manual traits, conditional policies, ordinal inventory matching, gold-route gating, migration, and independence from enemy and multiplier settings. Existing advanced-engine arithmetic and brute-force checks remain in place. Browser validation must also cover all three profiles, custom traits, save/load/reload, old and future storage, the advanced calculator, and 390px layout.

On this revision: 34/34 Node tests pass and both inline scripts parse. A Chromium browser run passed all three profile selections, search, provisional manual traits, compatible inventory, dupe gating, save/load/reload, v3 and legacy preservation, future-state write protection, advanced rendering/independence, and no horizontal page scroll at 390px in main/custom/advanced views. No console or page errors were observed. Browser tooling was isolated outside the repository; no app dependency was added. The policy tests verify implementation behavior, not independent proof of game-optimal priorities.
