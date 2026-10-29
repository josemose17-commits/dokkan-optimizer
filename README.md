# Dokkan Build Finder

A single-page tool for one Dokkan Battle character. Fill in what the card says and it picks the slot the character was made for, plus the best Hidden Potential board choices and skill orbs. Open `index.html` in a browser. It has no build step or dependencies, and it works offline apart from the web fonts.

## What you enter

1. **Character:** name, Type (sets the free star skill on the board) and rarity.
2. **Kit effects:** one row per effect on the passive, Super, Ultra Super or Active Skill: guard, damage reduction, evasion, DEF and ATK boosts, crit, additional attacks, counters, ally boosts, stuns and seals. Each row says when it turns on, how long it lasts, which position it needs and how big it is. Up to 3 forms.
3. **Attacks on the card:** the Super Attack multipliers and their ATK raises, the Ki it usually reaches, built-in additional attacks, crit and evasion chances, counters, and "effective against all Types".
4. **Hidden Potential board:** how much Potential is unlocked, or your own board nodes.
5. **Skill orbs:** standard orbs at the levels you set, or only the orbs you list.

Optional: your own priorities, your current build to compare, and a backup box to move characters between devices.

## What it shows

- **Made for:** the slot its kit suits, with the reasons and a table of which defences are on before and after it attacks in each slot.
- **Best build:** final skill levels, board choices and the orb for each slot, with damage, crit, Supers per turn and evasion.
- **Other strong builds** and **Next level worth chasing** (what one or five more levels of each skill would add).

The page's "How it decides" section explains the rules and lists its sources (Dokkan Wiki: Hidden Potential System, Skill Orbs, Additional Attack; DokkanStats: How to Compute ATK, Damage Received).

## Checks

```sh
node --test
```

`tests/engine.test.mjs` loads the calculation code from `<script id="engine">` and checks that it reads boards and orbs, that more Crit and Additional raise damage, and that the search returns a build.

## Saved data

Characters are stored in the browser under `dokkanBuildFinder.v4.current` and `dokkanBuildFinder.v3.profiles`.

Earlier versions of this tool are in the git history.
