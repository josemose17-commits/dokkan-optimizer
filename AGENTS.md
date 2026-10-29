# Project rules

- The product is the single file `index.html`. There is no build step and no dependencies. External resources come only from approved CDNs with pinned versions (today only Google Fonts).
- Keep the calculation code in `<script id="engine">` pure (no DOM, storage or network), so `tests/engine.test.mjs` can load it. Page code goes in the second script.
- Game values must come from a checkable source, listed in the page's "How it decides" section. Otherwise make it an input and say it's an estimate.
- Storage keys: `dokkanBuildFinder.v4.current` and `dokkanBuildFinder.v3.profiles`. Never delete or overwrite saved characters without an explicit user action.
- Before finishing, run `node --test` and a browser check: no console errors, results render, no horizontal scroll at 390px, and save, load and reload work. Report the actual results.
- Work on a feature branch. Merging and deployment need the user's go-ahead.
