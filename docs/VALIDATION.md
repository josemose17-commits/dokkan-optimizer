# Prototype validation

## Structured-source audit — 2026-10-19 UTC

Research-only update on `codex/structured-data-source-audit`, based on merged main `01480ea`. No application code, fixtures, card/orb records, dependency, workflow or graph changes. No source JSON/code was vendored. See the [focused source audit](character-build/STRUCTURED_SOURCES.md) for inspected records, authentication results and unresolved gates.

- Node.js **24.19.0**.
- `npm test`: **114/114 passed**, four files; all existing engine and storage tests. No new tests were added for this documentation-only change.
- `npm run typecheck`: **passed**.
- `npm run build`: **passed**; prefixed assets generated successfully.
- Production-prefix Chromium checks: **20/20 passed**, using the existing task-workspace harness against the new `dist/` bundle. Both workbenches, exact synthetic warning, baseline/equip comparison, persistence, truncation, supported objectives, mobile overflow and prefixed assets were checked. No uncaught page errors or external data requests.

The browser checks are regression checks of the existing documented model, not graph, orb-restriction or combat verification. No independent game confirmation, authenticated GachaData dataset inspection, adapter or allocation optimization was added. Nothing was merged or deployed.

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
