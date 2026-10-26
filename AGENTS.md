# Project rules

- The product is the single file `index.html`. There is no build step and no dependencies. External scripts come only from approved CDNs with pinned versions, and there are none today.
- Keep the calculation code in `<script id="engine">` pure (no DOM, storage or network), so `tests/engine.test.mjs` can load it. UI code goes in the second script.
- Game values in `GAME`, `hitMult`, `critMult` and `takenMult` come from the sources in the README. Do not add a game value without a checkable source; otherwise make it an input and label it unverified.
- The score is the team margin `(1 + share × damage gain) / (1 − cut in team HP loss) − 1`. Keep the search exact: the margin must only rise with the damage block for a fixed defence split. Any shortcut (product tables, dropped dominated splits, skipped orb setups) must be exact, and the brute-force tests must pass. Skipping an orb setup is allowed only when another setup beats it on every skill that matters and on ATK. Evasion is the exception when a received hit is worth more than a dodge; then it must match exactly.
- Every scoring change needs an independent hand-worked test value. The ten example characters in the tests check directions, not exact builds.
- Every enabled control must change the result. Hide or disable inputs that don't apply (UR vs LR, auto hit size, the orb list).
- Storage: `dokkanBuildFinder.v1` (states carry their own `v`; upgrade old states in `upgrade`). Never delete or overwrite the old `hipo3` key, an unreadable store, or a store from a newer version without an explicit user action.
- Before finishing, run `node --test` and a browser check: no console errors, results render, no horizontal scroll at 390px, and save, load and reload work. Report the actual results.
- Work on a feature branch. Merging and deployment need the user's go-ahead.
