# Task checklist

Status on branch `claude/tender-maxwell-o43x7j`, 2026-10-19. A checked item is implemented and covered by tests on this branch. Nothing here is merged or deployed until a reviewed PR is merged.

## What the app can honestly do today

- **Catalog:** 1 bundled card form with 2 exact states: the admitted Global English EZA step 7 state (Lv.140/SA15) and an individually recorded pre-EZA base state (Lv.120/SA10; single source, region unknown, no evaluator). Users can inspect their own normalized catalog JSON for one browser session. It is never stored, merged or offered optimization.
- **Evaluator:** One exact state, a fixed 55% no-dupe profile and a six-orb catalog. It runs a 16-target bronze/silver comparison of card stats and initial-check probabilities. There is no damage, no node respec and no full-turn model.
- **Saved builds:** Named builds are kept locally, with versioned JSON export and import.

## Audit backlog

### Broken behavior

- [x] Invalid inventory, limit and unlock inputs were reported as "could not be saved", as if storage had failed. They now get field-level errors, and the last valid settings stay stored.
- [x] Clearing the candidate limit replaced it with `1`. Typing then produced unintended values.
- [x] The missing favicon produced the only 404 on page load.

### Data integrity

- [x] Saved working settings are parsed structurally, with exact keys and no prototype keys, before legality checks.
- [x] A stored library that is unreadable or from a newer version is never overwritten without explicit replacement. A copy can be downloaded first.
- [x] Builds from another catalog revision are retained and marked stale, never auto-loaded.
- [x] Evaluator registry keyed by exact state ID: the catalog names the evaluator, the entry must be bound to that state with matching data, and there is no fallback. Saved builds load only into their own state's evaluator. A TEST ONLY second character proves isolation; it is not shipped.

- [x] PR #5 review follow-up: catalog validation rejects unknown keys at every level (deep nesting under an unknown key previously crashed validation); saved-build duplicates are compared independent of key order; the import preview shows the exact merge plan; evaluator-version mismatches are stale; autosave, save and export pause while a field is invalid; a second tab cannot overwrite saved builds; unreadable working settings can be downloaded first.

### Product functionality

- [x] Catalog: optimization-support filter, deterministic name sort, paged results, and session-only local file inspection with an update report.
- [x] Named saved builds recording the exact state, catalog revision and evaluator version. JSON export/import includes a preview, duplicate handling and ID-conflict handling.
- [x] Candidate-space upper bound shown before searching.
- [ ] Shareable build URL (versioned, validated, inventory excluded by default).
- [x] Result explanations generated from the calculation trace: configuration changes, stat/skill sources, probability factors, pp vs relative change, rank/tie and frontier dominance, evidence status, test coverage and model versions.
- [ ] Multi-character equipment allocation with shared inventory. This waits until a second character can be evaluated.

### UX and accessibility

- [x] Errors are associated with their inputs (`aria-invalid`, `aria-describedby`), and Compare moves focus to the first invalid input.
- [x] Native modal dialogs confirm load, delete, reset and replacement. Escape cancels them.
- [x] A pinned identity bar keeps the exact card state visible while editing and reading results.
- [x] On narrow screens, results become labelled cards, keeping table roles. Percentage points, relative change and the zero-baseline rule are labelled.
- [ ] Screen-reader pass (NVDA/VoiceOver) and a WebKit/Firefox browser project. Neither has been performed yet.

### Performance

- [x] The search index is computed once per catalog snapshot. Results render 50 at a time.
- [x] The candidate space is 16 targets and evaluates synchronously in the page. A Web Worker is not justified at this size; revisit when node graphs or multi-character allocation grow the space.

### Testing and CI

- [x] Checked-in Playwright suite (`npm run test:e2e`) on desktop 1366×900 and mobile 390×844 against the production build under `/dokkan-optimizer/`.
- [x] One validation job (format, unit, types, build, browser tests on the built `dist/`) gates the Pages artifact. The deploy job publishes only if its revision is still the head of `main` ([deployment](DEPLOYMENT.md)).
- [ ] Owner action: require the **Test and build (Node 24)** check on `main` so failing PRs cannot be merged. The workflow alone gates publication, not merging.

## Blocked outside this repository

| Blocker                                                                                                                                                                                                                                                      | What is needed                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bulk or comprehensive catalog acquisition. Dokkan Info acquisition is paused; no approved export or integration exists ([assessment](character-build/DATA_ACCESS.md)).                                                                                       | The user's authorization to contact the provider, or an approved export/dataset with recorded reuse terms.                                          |
| Cross-checked individual records. On 2026-10-19 Fandom and DokkanStats answered automated retrieval with a Cloudflare challenge, leaving dokkan.fyi as the single reachable source. Individual single-source records are still possible, one page per state. | A second reachable source, or dated in-game captures, before any record can be called corroborated. The Super EZA state needs raw stats and a step. |
| Full Hidden Potential node graph and prerequisites for the admitted card.                                                                                                                                                                                    | Exact graph evidence; aggregate totals and community builds are not sufficient.                                                                     |
| Independent confirmation of card, orb and probability facts.                                                                                                                                                                                                 | Dated in-game captures or genuinely independent observations.                                                                                       |
| Damage stages, rounding, passive expiry and battle stats.                                                                                                                                                                                                    | Verified formulas for an explicit context.                                                                                                          |
| Gold slot, duplicate routes, other orb IDs and restrictions.                                                                                                                                                                                                 | Evidence per item and per route profile.                                                                                                            |
