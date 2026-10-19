# Prototype validation

## PR #5 review follow-up — 2026-10-19

PR #5's first GitHub Actions run (head `710c664`) passed both jobs: **Test and build (Node 24)** and **Playwright (Chromium, production build, Node 24)**; the deploy job was skipped as expected for a pull request. There were no review comments. This follow-up comes from an implementation review, not from CI failures.

Defects found and fixed, each with a regression test:

- `validateCatalog` accepted unknown keys outside `fields`, and a deeply nested value under an unknown key made it throw `RangeError: Maximum call stack size exceeded` (reproduced with 200,000 levels), which would have left the browser panel stuck. Every object now has a closed key set; the browser also catches any validation failure.
- Saved-build duplicate detection compared JSON text, so identical builds whose inventory keys were in a different order were treated as an ID conflict and imported twice. Comparison is now independent of key order, and the identity rule is documented.
- The import preview said "N will be added" without checking duplicates, conflicts or the 100-build limit. It now shows the same plan the merge applies, per build.
- With an invalid limit draft, editing another control autosaved the previous, hidden limit, and **Export JSON** exported it. Autosave, save and export of working settings now pause while a field is invalid.
- A second tab could overwrite saved builds written by another tab. Writes now check that the stored list is unchanged since it was loaded.
- Unknown item IDs could appear as "Empty" or "Unknown item"; they now show the ID. Builds saved for another evaluator version are stale. Session catalog files show "declared" support, never as support offered here. Confirmation dialogs return focus to their opener, or to the section heading when the opener was removed.

Results on Node 24.22.0:

- `npm test`: **240/240 passed**.
- `npm run typecheck`, `npm run build`, `npm run format:check`, `git diff --check`: **passed**.
- `npm run test:e2e`: **55 passed, 1 skipped** (mobile-only check on desktop), 28 tests × 2 projects. New browser coverage: keyboard-only dialog use and focus return, accurate re-import preview, unknown-item import, export with an invalid field, paused autosave, two-tab conflict, unreadable-settings download, deep-nesting rejection, declared session support, and table roles plus visible labels on mobile cards.

## Saved builds, catalog search and browser suite — 2026-10-19

Validated locally on Node **24.22.0** (installed with nvm; the container's default Node 22 was not used). No provider acquisition, new real records or evidence changes were involved. The bundled catalog is still **1 card form / 1 exact EZA state**.

- `npm ci`: passed; `found 0 vulnerabilities`. The lockfile change only adds `@playwright/test` 1.56.1 and its two packages. Existing versions are unchanged.
- `npm test`: **224/224 passed** in seven files. That is the previous **173**, plus **33** saved-build library tests (parsing, storage, export/import, merge), **9** catalog search/sort/index tests, **5** delta-formatting tests and **4** candidate-space tests. Expected values are hand-written; none are produced by the function under test.
- `npm run typecheck`: **passed** (now also covers `e2e/` and `playwright.config.ts`).
- `npm run build`: **passed**. Assets keep the `/dokkan-optimizer/assets/` prefix.
- `npm run format:check` and `git diff --check`: **passed**.
- Catalog CLI: export of the admitted record, validation (1 card / 1 state) and overwrite refusal behave as before.
- `npm run test:e2e`: **47 passed, 1 skipped**, run twice with the same result. That is 24 tests × 2 projects (desktop 1366×900, mobile 390×844), headless Chromium 141.0.7390.37 (Playwright build 1194), against the production build under `/dokkan-optimizer/`. The skip is the narrow-layout check, which only runs on the mobile project. Every test also fails on page errors, console errors, HTTP ≥ 400, external requests or paths outside the prefix.

Browser coverage:

- **Navigation and prefix:** navigation and `aria-current`, page titles, prefixed JS/CSS, and no horizontal page overflow on all three pages.
- **Legacy demo:** exact synthetic warning, 21 eligible teams, and the warning absent from genuine character pages.
- **Catalog search and details:** search, filters, sort, empty state and reset. Exact-state URLs survive reload and history, with no substitution for unknown states. Stat layers and missing fields are shown.
- **Local catalog file:** a session-only file is validated (invalid JSON, schema failure and fixture origin are rejected). It is then browsed and returned from, with no storage or URL writes.
- **Workbench values:** the documented 16-target baseline, 4 first-place ties, 9 frontier rows and the search-space estimate. Deltas are checked in pp, relative and zero-baseline forms.
- **Workbench contexts:** inventory restriction and retention, 16→12 grouping with evasion disabled, and truncation disclosure.
- **Workbench inputs:** field-associated errors block comparison and saving. Settings persist across reload and navigation, and the legacy key is untouched. Keyboard submission works and the pinned identity bar appears.
- **Saved builds:** save, reset (Escape cancels), load, delete, and export → import into a fresh browser profile with working-settings replacement and duplicate skipping. Untrusted files are rejected, and an unreadable stored library is kept until explicitly replaced.
- **Storage failures:** corrupt working settings are preserved until an edit. With blocked storage, calculations stay usable and saving is disabled.

Not verified: GitHub Actions runs of the new workflow (it has not run yet), WebKit/Firefox, physical devices, screen readers, a full accessibility audit, in-game behavior, merge or deployment. The fork that implemented catalog paging also checked 50 → 100 → 130 "Show more" steps with a 130-card file generated in a scratch directory. That check is not part of the checked-in suite, because a large valid file would need fictional records.

## Provider-independent catalog — 2026-10-19

Validated on Node **24.19.0**. No provider acquisition/research or new real records were involved. The bundled catalog contains the existing **1 card form / 1 exact EZA state**, with **6/11 complete detail fields, 2 partial and 3 missing**; there are no independently confirmed fields.

- `npm test`: **173/173 passed**, five files: all **114 existing** tests plus **59 catalog contract/search/identity/provenance/update/compatibility tests**. Synthetic catalog fixtures are explicitly test-only. These passes do not verify actual game mechanics or source permissions.
- `npm run typecheck`: **passed**.
- `npm run build`: **passed**, including type checking; assets retain `/dokkan-optimizer/assets/`.
- `npm run format:check`: **passed**.
- Local CLI checks: **6/6 passed** — admitted-record export; actual one-card/one-state count; unknown provider total; overwrite refusal; compatible update report; sanitized malformed-JSON failure.
- Production Chromium browser checks: **16/16 passed** at `/dokkan-optimizer/`, using desktop **1440 × 1050** and mobile **390 × 844**. Screenshots were visually inspected.

Browser checks cover prefix assets and exclusion of new catalog fixtures; catalog landing/navigation; name/ID/type/rarity/awakening filters; unknown categories; exact state selection/reload/back/forward; raw/potential/equip/unavailable-battle stat layers; field references and uncaptured dates; unknown-state handling; byte-for-byte saved Goku preservation; the preserved limited comparison; legacy warning and 21 eligible teams; mobile overflow; unknown/corrupt/blocked storage; and absence of uncaught errors, provider requests or root-relative assets.

The initial browser attempt hit an installed Chromium font-archive ownership/extraction error before running UI checks; its already-unpacked executable ran successfully afterward. The first UI run exposed select accessible-name ambiguity, fixed with explicit labels. A duplicate-name heading selector in the harness was scoped by heading level. The complete final run passed all 16 checks against the final production bundle. The browser harness/screenshots are task-workspace verification, not a new project dependency or CI browser suite.

No provider-specific export schema, full source reconciliation, bulk-ingestion performance, physical-device/cross-browser behavior, full accessibility conformance, new probability/combat mechanics, merge or deployment was verified. See [catalog scope and commands](CATALOG.md).

## Primary character workbench — 2026-10-19 task validation

Research snapshot dated 2026-10-18; validation completed during the task spanning the UTC date change. Node.js **24.19.0**, headless Chromium **153.0.8010.0**.

- `npm test`: **114/114 passed**, four files. This includes all **47 unchanged legacy tests** and **67 new character-engine/persistence tests**.
- `npm run typecheck`: **passed**.
- `npm run build`: **passed**; Vite production assets retain `/dokkan-optimizer/assets/`.
- `npm run format:check`: **passed**.
- `git diff --check`: **passed**.

The independent examples cover the explicit 16-item-combination oracle, abstract node-choice and quantity examples, restrictions/prerequisites, conditional evasion, mathematical probability/expectation examples, missing metrics, same-context Pareto tradeoffs/ties, equivalent allocations/equips, baseline dominance under truncation, search disclosure, and storage failures. Hypothetical branch damages test arithmetic only. Successful tests do not establish independent confirmation of game behavior.

### Production browser checks at `/dokkan-optimizer/`

**20/20 passed** against `dist/` served by a local static server that accepts the repository prefix. Desktop **1440 × 1050** and mobile **390 × 844** screenshots were visually inspected, including the primary-page introduction and comparison table. The browser harness is a task-workspace check, not a checked-in Playwright dependency or CI job.

1. Generated JS/CSS URLs retain the prefix and exist.
2. Character workbench is the default product and document title.
3. Exact EZA state, source confidence and fixed 55% boundary are visible.
4. Default 16 legal builds, baseline values, four first-place ties and nine frontier evaluations match hand expectations.
5. Only supported objectives appear; damage/battle DEF remain unavailable.
6. Current equips update the baseline and exact absolute/relative/percentage-point deltas.
7. Inventory quantities and retained current items restrict targets correctly.
8. Character baseline, inventory and mode survive reload.
9. Evasion-disabled context groups 16 targets into 12 evaluations, retaining all 16 equip alternatives.
10. The declared frontier filter preserves six evasion-disabled alternatives and includes baseline dominance.
11. A two-candidate limit reports truncation/unknown total while retaining the actual baseline.
12. Unmet potential-system eligibility produces an error and no rankings.
13. Field evidence distinguishes documentation, mathematical testing and absent independent confirmation.
14. Mobile primary page has no page-level overflow; the comparison table scrolls internally.
15. Legacy navigation retains the exact visible synthetic warning.
16. Legacy search still yields 21 eligible of 56 candidates and seven distinct rotation participants including the friend.
17. Legacy ownership and character settings persist separately through navigation/reloads; mobile legacy page does not overflow.
18. Unknown saved schema warns and is preserved until an edit.
19. Blocked localStorage warns while calculations remain usable.
20. No uncaught page errors, external requests or root-relative asset requests occur.

An initial storage-failure check hit a serverless Chromium multiple-context lifecycle failure in the harness. It was changed to a same-page storage override and the complete 20-check run passed twice, including the final production bundle. This was not a passing game-mechanics verification test.

The original app, engine, fixture data, legacy storage, dependencies/lockfile, Vite base and Pages workflow were preserved. No merge or deployment was performed. No cross-browser/physical-device/full accessibility audit or in-game verification was performed. Full node respec, full-turn chains, battle stats and damage remain unresolved as described in [the evidence ledger](character-build/EVIDENCE.md).

## Historical synthetic team prototype

Validated on **2026-10-18**, using Node.js 24.19.0.

## Automated checks

- `npm test`: **47/47 passed**, across engine/reference examples and local persistence tests.
- `npm run typecheck`: **passed**, strict TypeScript with no emit.
- `npm run build`: **passed**, production bundle generated by Vite.
- `npm run format:check`: **passed**.
- `git diff --check`: **passed** before publishing.

The independent engine example explicitly lists all six teams formed by a fixed leader and five of six other owned units. Expected totals are calculated from manually summed ratings and documented weights. A separate rotation oracle chooses four of seven participants and enumerates the three ways to pair them, matching all 105 layouts. Tests also cover friend identity/coverage/effects, duplicate instances, conditional activation, unsupported entry rules, replacement deltas, and truncated-search disclosure.

## Production-browser smoke checks

**14/14 passed** in headless Chromium 153, against the production bundle served locally. Desktop (1440 × 1000) and mobile (390 × 844) screenshots were visually inspected. No page-level horizontal overflow was found at those sizes.

1. Exact synthetic notice is visible; initial collection has nine owned fixtures.
2. Default search evaluates 56 combinations: 21 eligible and 35 rejected.
3. Two disjoint pairs and three floaters use seven distinct participant slots, including the friend.
4. Coverage table displays seven participants and 14 separate covered checks.
5. Ownership edits persist across reload.
6. A limit-one search visibly reports truncation even when the first candidate is rejected.
7. Owning all 12 and running a complete search evaluates 462 combinations: 56 eligible and 406 rejected, including unsupported-entry exclusions.
8. A friend leader works without being owned.
9. A friend matching the owned leader keeps its independent seventh slot.
10. Exercise selection updates the explicit context; condition outcomes appear in explanations.
11. Clearing the collection persists and produces a visible eligibility error.
12. Desktop and mobile layouts do not overflow the page horizontally.
13. Blocked local storage produces a visible session-only warning.
14. No uncaught page errors or external data requests occurred in the production smoke run.

The browser smoke harness was a one-off task-workspace check, not a checked-in Playwright suite. These checks do not establish cross-browser compatibility, physical-device behavior, full accessibility conformance, real game accuracy, or large-collection scalability. No real dataset or combat calculation was tested.
