# Prototype validation

## Re-landed base state and Firefox/WebKit run — 2026-10-19

PR #8 was merged into `claude/evaluator-registry` after PR #7 had already been merged, so its record never reached PR #6. This branch merges that reviewed commit (`f6403cf`) unchanged onto PR #6's head `2527f60` and adapts the code and tests from PRs #9/#10 that counted one state. Coverage is now **1 form / 2 exact states (1 EZA, 1 base, 0 SEZA) / 1 limited evaluator**. The production registry is unchanged.

Checks on Node **24.22.0**, with no dependency or lockfile changes:

- `npm test`: **407/407 passed**, 12 files: the 403 tests on `2527f60`, 3 re-landed record tests and 1 new test for copying the base state into maintenance.
- `npm run typecheck`, `npm run build`, `npm run format:check`, `git diff --check`: passed.
- Checked-in Playwright suite in Chromium (desktop and mobile): **113 passed, 1 skipped**. The skip is the mobile-only layout check on desktop. New: the primary page lists the base state and refuses it with the record's own reason, and its coverage panel counts both states.
- Firefox and WebKit: one local run of the same suite through a temporary configuration outside the repository. It used Playwright 1.56.1 with Firefox build 1495 and WebKit build 2215, plus Linux host libraries from `playwright install-deps`. Firefox desktop: **56 passed, 1 skipped**. WebKit desktop: **55 passed, 1 skipped, 1 failed**. WebKit with iPhone 13 emulation (390×844): **56 passed, 1 failed**.
  - Found and fixed: in WebKit the primary page was 7px wider than a 390px viewport, because a long selected option (**Supported progression**) painted past the select's edge; Chromium and Firefox clip it. `contain: paint` on the page's selects clips it inside the control, and the focus outline stays visible. The overflow was already present on `2527f60`.
  - Not an app defect, not changed: WebKit's renderer crashes on `history.pushState`, then reload, then navigation. The same sequence crashes on a plain static HTML page with no app code. The catalog history test therefore fails in WebKit here, while it passes in Chromium and Firefox. No test was skipped or weakened for it.
- Not performed: Safari or iOS on real devices (this WebKit is Playwright's Linux build), screen readers and in-game verification.

## PR #10 scope correction, CI and allocation gate — 2026-10-19

The current capability is explicitly labeled **limited progression-profile/equipment comparison** in navigation, document metadata, landing copy, catalog actions and README. Probability result headings explicitly say **Source-model comparison**. No allocation control, new character, real node graph, combat formula or damage/defensive objective was added. The first actual allocation-recommendation acceptance criterion remains unmet.

- Original #10 head `27be290`: GitHub [run 39281420818](https://github.com/josemose17-commits/dokkan-optimizer/actions/runs/39281420818) completed **success**, including install, format, unit, build/type and production browser steps. It initially queued, then ran; no failing step was observed. Deployment/upload were skipped for the PR. This pass is not a claim about a later follow-up head.
- Dependency #6 head `9cc0cce`: [run 39275777168](https://github.com/josemose17-commits/dokkan-optimizer/actions/runs/39275777168) completed **success**. Reviews and review threads on #6/#10 were empty at inspection. #6 was retargeted to main because #5 is already merged; no branch code changed. [Correct stack/merge-method handling](DEPLOYMENT.md#current-stack-pr-6--pr-10-2026-10-19).
- Follow-up local checks, Node **24.19.0**: **403/403 unit tests**, strict type check, production build, formatting and whitespace checks **passed**. No dependencies/lockfile/workflow/storage-format changes.
- Final production Playwright run at `/dokkan-optimizer/`: **109 passed, 1 expected skip**, 110 runs, no failures/flakes; desktop/mobile projects. Tests now check the precise product labels and explicit model-probability heading, alongside all saved-data/equipment/editor/catalog/legacy regressions. Same outside-repository Chromium 153 / Playwright 1.56.1 setup as below.
- Research-only source screenshots stayed outside the repository. No provider dataset, artwork, downloaded script, credential or user save was included.

The focused board investigation inspected actual public images showing two +3 two-option dialog examples, an actual board/route image, a first-hand route-count guide and the documented board/selection/condition schema. None supplies a complete chosen-card-bound attainable set. [Exact missing evidence and stop point](character-build/EVIDENCE.md#focused-allocation-gate-review--2026-10-19). **Zero new real allocation alternatives compared; no new winning allocation or combat baseline improvement.** The preserved profile has one fixed allocation and up to 16 equipment combinations. No hypothetical arithmetic test is relabeled game verification. No additional application features or separate research-only PR were created for the blocked milestone. No merge or deployment was performed.

## Primary Hidden Potential recommendations — 2026-10-19

Audit: main remained `316492d` (PR #5); PR #6 remained open at `9cc0cce`, containing merged PR #9's character editor and PR #7's exact-state registry/explanations. This feature branch is stacked on that head. PR #8's separate pre-EZA work was inspected and left untouched. All **363** pre-change unit tests were preserved.

Actual final checks on Node **24.19.0**, without dependency/lockfile changes:

- `npm test`: **403/403 passed**, 12 files (**363 retained + 40 new**).
- `npm run typecheck`: passed.
- `npm run build`: passed, including type checking; production assets retain `/dokkan-optimizer/assets/`.
- `npm run format:check` and `git diff --check`: passed.
- Checked-in Playwright suite against the final production bundle under `/dokkan-optimizer/`: **109 passed, 1 skipped**, 110 total runs, no unexpected or flaky tests. The skip is the existing mobile-only layout check on desktop. New primary-flow coverage is **9 scenarios × desktop/mobile**.
- Desktop **1366×900** and mobile **390×844** landing/result screenshots were visually inspected. Both populated result pages had zero horizontal overflow.

The local runner's bundled Chromium was unavailable. An outside-repository config used the existing installed **Chromium 153.0.8010.0 / Playwright 1.56.1**, two workers, without disabling web security. Initial launches encountered incomplete binary/graphics extraction; re-extracting those installed dependency assets resolved the environment failure. The final suite ran normally. The new cross-workbench saved-build check's initial exact-label locator was corrected to a semantic combobox/value assertion; the final check confirms the actual loaded ID and unchanged library bytes. Normal reproducible command remains `npx playwright install chromium`, then `npm run test:e2e`.

New independent checks cover exact 16-target HP/baseline outcomes; a TEST ONLY two-node/four-allocation exact set and fixed native levels; progression/prerequisite/route/SA boundaries; state/profile/template/data revision mappings and ambiguous/unresolved evidence; aggregate totals never claiming a graph; scan/evaluation budgets including rejected combinations; request snapshots; cancellation and cooperative yielding in enumeration **and dominance**; unavailable/throwing objective calculations failing closed; direct outcomes/ties/fewest-change presentation; a stronger or tied baseline outside a truncated prefix; baseline trace/tie accuracy; probability acknowledgement and unknown kit-effect gates; and honest separated catalog coverage. These are mathematical/schema tests, not independent confirmation of actual game mechanics.

Browser checks verify primary/maintenance navigation, the full-allocation gate without candidate evaluation, scoped catalog HP **15,327 → 15,827 (+500)** with four objective ties, inventory quantities and retained current equips, incomplete-search disclosure with a stronger baseline, probability-model acknowledgement, invalid numeric input, untouched older settings, exact-state refusals, coverage uncertainty, cross-workbench named-save compatibility, keyboard submission, reload and mobile layout. All existing editor/catalog/source-example/legacy checks remain; no external requests, console/page errors or prefix escapes are accepted by the suite.

No real data or complete board graph was added. Coverage remains **1 form / 0 established awakening relationships / 1 EZA / 0 SEZA / 0 complete required-detail records / 1 limited evaluator / 0 complete board templates**; the total source catalog is unknown. Two additional public export samples/metadata were inspected and documented, with **zero records imported**. Full allocation, comprehensive acquisition, probability/RNG game confirmation, combat damage/stages/expiry and survival remain gated. No provider contact, credential, purchase, artwork, copied calculator implementation, merge or deployment occurred. No WebKit/Firefox, physical-device, screen-reader or in-game verification was performed. [Implementation and reproduction](OPTIMIZER.md).

## Reusable character editor and custom snapshot comparison — 2026-10-19

Audit before edits:

- Current main was `316492d` (merged PR #5): **240/240 unit tests**, type check/build and formatting passed; its production browser suite passed **55 with 1 skipped**.
- PR #6 was open at `453d601`; it contains the merged PR #7 exact-state registry and result explanations. This implementation is stacked on that branch rather than duplicating them. Its pre-change unit suite passed **281/281**. PR #8's pre-EZA record was merged into the separate `claude/evaluator-registry` branch after #7; that work was inspected and left untouched. No new factual records are admitted here.

Final checks on Node **24.19.0**:

- `npm ci`: passed. No dependency or lockfile changes in this batch.
- `npm test`: **363/363 passed**, 11 files (**281 retained + 82 new**).
- `npm run typecheck`, `npm run build`, `npm run format:check`, `git diff --check`: passed.
- Checked-in Playwright suite against the final production `dist/` at `/dokkan-optimizer/`: **91 passed, 1 skipped**, no unexpected/flaky tests, 92 total runs. The skip is the existing mobile-only layout test on desktop. New authoring coverage is 11 scenarios on desktop and mobile, including the independent 200 + 0 + 5 + 20 = 225 / alternative 255 oracle.
- Desktop 1366×900 and mobile 390×844 screenshots visually inspected. Populated comparison pages have zero horizontal overflow.

Local browser environment: Chromium **153.0.8010.0** with Playwright **1.56.1**. The runner's bundled Chromium was unavailable, so a temporary **outside-repository** config selected the installed binary (two workers, no disabled web security). Normal reproducible CI/user command remains `npx playwright install chromium`, then `npm run test:e2e`. The initial baseline launch failures were test-environment failures; the baseline and final suites subsequently passed.

New unit checks independently cover state/card identities and immutable revisions, user-vs-bundled data, nested three-valued conditions and boundaries, explicit timings/unsupported durations, absent values/overflow, unknown effects, exact equipment restriction messages, custom totals without a board claim, traces/deltas/frontiers/ties/truncation, schema/size/count/depth/prototype/accessor protection, safe import plans/relationship mapping, storage conflict protection and preserved Goku bytes/results. These prove schema and arithmetic behavior, **not actual Dokkan mechanics**.

Browser coverage includes create/edit/save/revision history, separate base/EZA authored state IDs sharing one card ID, custom configurations/equips and activation traces, invalid numeric inputs, unknown mechanics, conflict previews and ID copying, safe HTML-like text, export/import into a fresh profile, canceled navigation, detached catalog copying, future/unreadable/blocked storage and preservation of old saved keys. All prior catalog/source-example/team-demo tests remain.

No provider calls, acquisition, new real data, artwork, formula evidence promotion, merge or deployment. The authored model has no damage/probability/battle-stat implementation, and the source 55% example remains a regression path. See [exact functionality and exclusions](CHARACTER_DEFINITIONS.md).

## Evaluator registry and result explanations — 2026-10-19

Node 24.22.0, headless Chromium 141 (Playwright 1.56.1). No new real data, evidence or mechanics; the production registry has one entry (the admitted Goku state).

- `npm test`: **281/281 passed** in 10 files. New since the PR #5 follow-up:
  - 20 registry and isolation tests: resolution by catalog evaluator ID; every refusal code; no fallback; per-entry storage keys; saved-build state binding.
  - 11 trace and explanation tests: sources, factor products, pp vs relative change, zero baseline, rank ties, dominance by a result or by the baseline, equivalent configurations, unavailable metrics, evidence status, lower-is-better direction.
  - 7 server-rendered component tests: the TEST ONLY characters render with their own identity, slots, choice node, contexts and objectives, with no Goku text; the page refuses instead of falling back.
  - 3 delta-format tests.
  - All earlier tests were moved to registry entries; their expected values are unchanged.
- `npm run typecheck`, `npm run build`, `npm run format:check`: **passed**.
- `npm run test:e2e`: **69 passed, 1 skipped** (35 tests × desktop/mobile; the skip is the mobile-only layout check on desktop). New browser coverage:
  - the state picker;
  - refusal of unknown/SEZA states with no Goku fallback;
  - explanation text checked against hand-computed values;
  - dominance explanation and focus;
  - zero-baseline wording;
  - equivalent-configuration explanation;
  - absence of TEST ONLY fixtures from the production JavaScript.

Not covered in a browser: loading a saved build into another state's workbench. The production registry has only one state, and fixtures are never shipped. The pure resolution (`entryForState`, `buildStatus`) is unit-tested; the UI hand-off is not.

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
