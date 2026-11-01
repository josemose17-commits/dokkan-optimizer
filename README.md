# Dokkan Build Finder

A single-page tool for one Dokkan Battle character. Fill in what the card says and it picks the slot the character was made for, plus the best Hidden Potential board choices and skill orbs. Open `index.html` in a browser. It has no build step or dependencies, and it works offline apart from the web fonts.

## What you enter

1. **Character:** name, Type (sets the free star skill on the board) and rarity.
2. **Kit effects:** one row per effect on the passive, Super, Ultra Super or Active Skill: guard, damage reduction, evasion, DEF and ATK boosts, crit, additional attacks, counters, ally boosts, stuns and seals. Each row says when it turns on, how long it lasts, which position it needs and how big it is. Up to 3 forms.
3. **Attacks on the card:** the Super Attack multipliers and their ATK raises and the Ki it usually reaches. Built-in additional attacks, crit, evasion, counters and "effective against all Types" are added up from the section 2 rows ticked "Counts for the build", so each effect is entered once (crit rows take their % and "Supers only", additional attack rows how many and their Super chance, counter rows their strength and counters per turn). Untick "Take these from the effect rows" to type them in section 3 instead; characters saved before this keep their own numbers that way.
4. **Hidden Potential board:** how much Potential is unlocked, or your own board nodes.
5. **Skill orbs:** standard orbs at the levels you set, or only the orbs you list.

Optional: your own priorities, your current build to compare, and a backup box to move characters between devices.

**New character** (top bar) starts a clean character: no name, no effect rows, one form, starting numbers, empty Quick fill boxes. It keeps the player's own settings (orbs you own, orb slots and levels, priorities). **Clear all** resets every input, those included. Neither touches saved characters, and both ask for a second click to confirm. Section 2's own button is now **Clear rows**.

**Quick fill from the card** (top of section 2) does most of this for you: paste the Super Attack, Ultra Super Attack, Passive Skill and Active Skill text from DokkanStats or the game and press Fill in. It adds an effect row for each line (with when it turns on, how long it lasts, position, HP and ally conditions and amounts) and fills in the Super multipliers (from their damage word) and ATK raises in section 3. Every row counts for the slot advice. For the build's damage maths, effects for a position (such as "as the 2nd or 3rd attacker") count when the build's slot is that position, and effects that need allies of a category on the team count; effects that depend on the fight (a certain enemy, an HP threshold, a later turn, an ally attacking in the same turn) count once you tick "Counts for the build" on their row. It lists what it filled, what it left out (Ki, healing, start-of-turn ATK) and what to check, such as a "rare" chance or counters per turn. Add anything unusual as a row by hand afterwards. With transformations or exchanges, set the number of forms first, then pick the form under "Fill into" and paste that form's kit; each form gets its own rows and section 3 numbers. A new fill of a form replaces only the rows its last fill made, so rows you added by hand stay. Forms are scored separately and blended by time spent in each.

Wording follows the Dokkan wiki: chances great 70%, high 50%, medium 30%; counters enormous 200%, tremendous 300%, ferocious 400%; Super Attack damage words by SA level (UR 10, LR 20, +5 when Extreme Z-Awakened).

## What it shows

- **Made for:** the slot its kit suits, with the reasons and a table of which defences are on before and after it attacks in each slot.
- **Best build:** final skill levels, board choices and the orb for each slot, with damage, crit, Supers per turn and evasion.
- **Other strong builds** and **Next level worth chasing** (what one or five more levels of each skill would add).

The page's "How it decides" section explains the rules and lists its sources (Dokkan Wiki: Hidden Potential System, Skill Orbs, Additional Attack; DokkanStats: How to Compute ATK, Damage Received).

## Checks

```sh
node --test
```

`tests/engine.test.mjs` loads the calculation code from `<script id="engine">` and checks that it reads boards and orbs, that more Crit and Additional raise damage, that the search returns a build, that Quick fill reads real kits, and that section 3 adds up the rows correctly.

## Saved data

Characters are stored in the browser under `dokkanBuildFinder.v4.current` and `dokkanBuildFinder.v3.profiles`.

Earlier versions of this tool are in the git history.
