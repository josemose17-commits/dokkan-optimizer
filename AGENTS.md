# Project rules

- The product is the single file `index.html`. There is no build step and no dependencies. External scripts come only from approved CDNs with pinned versions, and there are none today.
- Keep the calculation code in `<script id="engine">` pure (no DOM, storage or network), so `tests/engine.test.mjs` can load it. UI code goes in the second script.
- Values checked against datamined sources (DokkanStats ATK formula, gamerch per-level and crit/type multipliers, Dokkaninfo orb lists) are fixed in `GAME`. Values from the Fandom wiki stay editable and labelled unverified. Do not add new game values without a checkable source; prefer an editable input.
- Every scoring change needs an independent hand-worked test value. The search must stay exact: keep the brute-force comparison tests passing. Skipping an orb setup is allowed only when another setup beats it on every skill that matters and on ATK. Evasion is the exception: on counter units it can lower the score, so it must match exactly.
- Every enabled control must change the result. Hide or disable inputs that don't apply (UR vs LR, the Type box, auto hit size, the orb list).
- Storage: `dokkanBuildFinder.v1`. Never delete or overwrite the old `hipo3` key, an unreadable store, or a store from a newer version without an explicit user action.
- Before finishing, run `node --test` and a browser check: no console errors, results render, no horizontal scroll at 390px, and save, load and reload work. Report the actual results.
- Work on a feature branch. Merging and deployment need the user's go-ahead.
