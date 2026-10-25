# Dokkan build finder

A single-page tool that picks Hidden Potential levels and skill orbs for one Dokkan Battle character. Open `index.html` in a browser. It has no build step or dependencies, and it works offline apart from the web font.

It tries every orb setup in the bronze, silver and gold slots and every way to place your Potential levels. Then it ranks the builds by expected damage per turn plus the team HP that Evasion and Type DEF save.

## What it models

- **Damage:** card Ki multiplier, blended between the 12 Ki and 24 Ki multipliers, with the 18 Ki Super from 18 Ki. Extra Supers and Hidden Potential additionals use the 12 Ki Super and 12 Ki multiplier. Super Attack Boost and stacked ATK add to the Super multiplier. Flat ATK from orbs is sized against the card ATK.
- **Per level:** Additional +2% (a separate check per eligible attack, half of them Supers), Crit +2%, Evasion +1%, Super Attack Boost +0.05, Type ATK +0.05.
- **Crits:** (1.5 + Type ATK) × 1.25 against a Type it beats, otherwise 1.875. Crits ignore enemy DEF; the enemy DEF box is optional.
- **Evasion:** valued by the team HP it saves (hits taken in the slot × how big they are). On counter or on-hit units, a dodge also loses that hit's value.
- **Orbs:** bronze orbs are stats only (ATK +800 by default). One-skill orbs default to 7, two-skill orbs to 4 + 4. ATK on orbs you list always counts.
- **Slot advice:** named position, protection before attacking, per-Ki-Sphere kits (slot 1), link reliance (slot 2), stacking payoffs, and the start-of-turn rotation note.

**Not verified** (from the Fandom wiki, editable under "Game values used"): Type DEF per level (0.01), damage taken from a Type it beats (0.95), the star-node skill for each type, and the 15-level cap per skill. Recovery Boost has no verified per-level value, so you set its worth.

## Checks

```sh
node --test
```

The tests load the calculation script (`<script id="engine">`) from `index.html` and check hand-worked values. They also compare the search against a brute force over every orb setup and Potential split.

## Saved data

Inputs are stored in the browser under `dokkanBuildFinder.v1`. Inputs saved by the previous version (`hipo3`) are offered once for import and are never deleted.

The previous React app in this repository is preserved in git history (last commit `34e4d5b`).
