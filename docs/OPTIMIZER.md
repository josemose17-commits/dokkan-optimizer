# Hidden Potential recommendation workbench

The primary page now follows character → exact progression/current build → equipment/context/objective → direct result. Maintenance remains secondary; it does not become game-validated merely by being selectable. This is a reusable first batch with explicit data gates, **not a completed full-potential optimizer**.

## Actual coverage and scope

| Measure                                   | Bundled count | Meaning                                                                                              |
| ----------------------------------------- | ------------: | ---------------------------------------------------------------------------------------------------- |
| Unique card forms                         |             1 | Existing admitted SS3 Goku; no new cards imported                                                    |
| Established awakening relationships       |             0 | Unknown form mapping is preserved, not inferred                                                      |
| EZA states                                |             1 | Global English, EZA step 7, Lv.140 / SA15                                                            |
| SEZA states                               |             0 | No substitution for EZA                                                                              |
| Complete required-detail records          |             0 | All 11 catalog detail fields plus region/state identity define completeness; Goku remains incomplete |
| States with a limited evaluator           |             1 | Card-stat/initial-check subset only                                                                  |
| Ambiguous form mappings                   |             1 | The existing form relationship is unknown                                                            |
| Explicit unparsed/excluded source records |             0 | No bulk source was imported; this is not a claim that a source has no exclusions                     |
| Complete board templates                  |             0 | One partial aggregate profile; no reconstructed game graph                                           |
| Source catalog total                      |       Unknown | Comprehensive coverage cannot be reconciled                                                          |

Only the existing filled 55% no-dupe profile is admitted. The product's intended progression scope is broader, but **full potential allocation** currently returns the specific missing alternatives/increments, connections/prerequisites, route/unlock gates and reviewed card-to-board mappings. No automatic route unlocking, inferred percentage equivalence, respec sliders or invented legal totals are offered. No allocation graph was added to real data.

The explicitly selected documented-profile subset is useful now: choose a card-stat objective, compare current equipment against inventory/catalog choices, receive an exact change and baseline delta, and inspect retained ties/tradeoffs. It does not become a full allocation recommendation. An unregistered/local definition stays selectable and returns its missing template/evaluator gate rather than inheriting Goku behavior.

## Reproduce the supported result

1. `npm ci`, then `npm run dev -- --host 127.0.0.1`. Open `/dokkan-optimizer/`.
2. Select **Mystery Super Technique · Super Saiyan 3 Goku · AGL UR · eza step 7 · Lv.140/SA15 · Global English**. Full-potential scope reports the missing graph without evaluating candidates.
3. Select **Selected documented profile only**, keep the filled no-dupe profile/system unlocked and current slots empty. Choose **Best available in catalog** and **Card HP**. If older working settings exist, explicitly restore these inputs rather than deleting saves.
4. **Recommend build**: 16 combinations, current HP 15,327, target HP 15,827, **bronze → AGL HP +500**, +500 HP. Four configurations tie on HP; the displayed tie needs the fewest changes. Silver changes do not improve HP. No damage conclusion follows.
5. Inventory mode with no current/inventory items returns **Your current build is already best**. Enter HP-orb quantity 1 to make it available. Retaining an already attached HP orb requires zero unequipped copies in that same slot.
6. A one-evaluation budget returns **Best found so far — search incomplete**. The current baseline remains considered even when it has not appeared in the candidate prefix. No global optimality is claimed.

Scope, probability acknowledgement and scan budget are session controls. Named saved inputs retain their older schema and exact state/revisions. The primary flow reads but does not autosave over `dokkan.character-builds.v1`; explicit named saves use the preserved library. Source examples still own their existing autosave behavior. Maintenance uses its separate definition key.

## Context and recommendation meaning

Card HP/ATK/DEF are raw card stats + separately recorded profile additions + flat equips. Battle modifiers are excluded. Goku's existing raw HP/ATK/DEF are 12,527 / 11,111 / 5,796, with separately documented +2,800 each for this profile. These facts were not re-verified or promoted in this batch.

The legacy initial-check model remains available only after an explicit acknowledgement in the primary flow: turn 1, first appearance, initial attack Super, no external effects; native profile AA5 and no native critical/evasion chance in this scoped check. Its AA trigger, extra-Super, critical and evasion arithmetic remains in the evidence ledger. The FYI/RNG convention discrepancy remains unresolved. Tests demonstrate the implemented arithmetic, not independent game behavior. No full-turn attack chain, enemy damage, battle DEF, survival, clear probability or expected-damage objective is offered. Raw ATK and critical chance are never relabeled optimal damage.

Each evaluator now declares objective-specific evidence, exclusions and blocking missing mechanics. An absent declaration, unresolved required evidence, unavailable baseline/candidate objective, mismatched template/revision or calculation failure prevents recommendation. Known unrelated detail gaps do not invalidate pre-battle stat arithmetic. All current real records remain source-documented, **not independently confirmed**. Generic silver restrictions/aliases remain unresolved for independent confirmation; there is no verified-only mode and they must be excluded from any future mode with that name.

Result outcomes distinguish recommended, current already best, objective ties, no compatible candidates, precise data/mechanics gates and incomplete search. Deterministic tie preference is current build, then fewer changes, then stable input key; this is a presentation rule, not a resource-cost or strength formula. No universal weighted score is used. Alternative legal inputs are retained when complete exposed evaluations coincide.

Pareto comparisons use the same context and only metrics available across all candidates and baseline. The selected list is explicit; null never supplies a dominance advantage. If cancellation interrupts dominance checks, the frontier is unavailable, not partially certified. Objective ranking can still report best found with incomplete-search language. The declared current baseline always participates.

## Separation and performance

| Layer                        | Files                                              | Responsibility                                                                                                    |
| ---------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Factual catalog              | `src/character-data/`, `src/data/real/catalog.ts`  | Exact cards/states, field completeness/provenance, normalized contract, update/saved-ID checks                    |
| Potential profiles/templates | `src/potential/progression.ts`                     | Explicit state/profile/data/template revision mappings; aggregate vs complete topology distinction                |
| Inputs/compatibility         | `src/character-build/domain.ts`, `legality.ts`     | Progression/current choices, unlocks, type/category/state/slot restrictions, quantities                           |
| Candidate search             | `generation.ts`, `search.ts`                       | Lazy allocations × compatible slot pools, rejection/evaluation budgets, host scheduling/cancellation              |
| Evaluation                   | `evaluation.ts`, evaluator registry                | Context-dependent metrics/traces with objective-specific coverage declarations; no UI/storage/provider dependency |
| Ranking/outcomes             | `comparison.ts`, `src/potential/recommendation.ts` | Baseline, equivalence, objective ties, common-metric frontier, direct changes/deltas and gates                    |
| UI                           | `src/potential/PotentialOptimizer.tsx`             | Primary workflow, catalog coverage, session inputs, existing named-build UI and computed explanations             |
| Maintenance                  | `src/character-definitions/`                       | Preserved secondary custom authoring/import/revisions, separately labeled arithmetic model                        |

The search-size estimate is allocation option products × per-slot options (including empty), before inventory filtering. The real profile has 1 allocation × 4 bronze × 4 silver × 1 gold = **16**. Supported choice-node structure is bounded to eight nodes; this technical bound is not a game maximum. A test-only two-node graph enumerates its four exact allocations independently.

The primary engine yields every 128 candidate scans **and** every 128 pairwise dominance comparisons; the browser supplies task scheduling. The engine is pure and accepts an injected clock/cancellation callback. Rejected combinations consume scan budget. Evaluation budget is 1–20,000; scan budget is 1–1,000,000. These protect the prototype, not a scalability claim. Sorting/group preparation remains bounded synchronous work; dominance is still worst-case quadratic but cooperative. Alternative inputs render lazily in pages of 50. An enlarged real catalog needs profiling and likely worker/scalable-search work before lifting limits. The synchronous `compareBuilds` remains a small reference/regression API.

Cancellation and edits invalidate in-flight results. Total compatible count is unknown when truncated. No mutation of the captured request or previous saves is allowed. The independent current baseline is evaluated separately from the candidate budget.

## Catalog acquisition gate

A focused check on 2026-10-19 inspected two additional public GitHub exports instead of repeating blocked-provider/API-token routes. Repository files/README/license metadata and the small JSON sample were read; no download scripts, scraper or arbitrary data content were executed. No dataset was admitted or redistributed.

| Actual export inspected                                                                                                                                                                        | Observed sample/schema                                                                                                                                                                                                                                                                  | Access, reuse and coverage limits                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [feijoes/DokkanAPI](https://github.com/feijoes/DokkanAPI), `data/test.json` blob `ffd50bbea768f3533c41408fbb560cd0711f8898`, 6,760 bytes                                                       | Three records, IDs 11900/12022/11168. Actual keys include name/title/ID/type/rarity/level, leader/passive/Super text, links/categories, base/max/free-dupe/rainbow stats, transformations. No choice-node graph, equipment restrictions or explicit SEZA-state identity in this sample. | Public repository read; AGPL-3.0 project license. README credits MNprojects' wiki-derived scraper. Code licensing does not settle all upstream descriptive-text/dataset rights or current card/state completeness. The main JSON is listed as 1,818,189 bytes (blob `53f0a9eb2b4c736e5ce82b4dd713a1b5a8d1cbbf`) but was not imported; sample absence is not a conclusion about every field in that file. Source snapshot/date and source reconciliation remain unestablished. |
| [Daniel-Fauland/dokkan-battle](https://github.com/Daniel-Fauland/dokkan-battle), published `dbz_db_characters_2023_08_18.xlsx`, blob `a5491130d5217235cd7bee1c1ddbf9cfd13ef62a`, 150,513 bytes | README advertises CardID/categories/release dates and 55%/100%/EZA profile totals. Workbook contents were not downloaded/interpreted.                                                                                                                                                   | Dated 2023 export, not established as current. No LICENSE file in inspected root; casual code reuse wording does not establish upstream dataset/text redistribution. Aggregate profiles are not raw-stat/state or potential-topology proof.                                                                                                                                                                                                                                   |

**Exact remaining acquisition gate:** neither inspected export establishes both maintainable current exact-state coverage and applicable permission/provenance for the text snapshot distributed in this public repository/Pages bundle. No production acquisition adapter is connected and comprehensive counts cannot be claimed. This is not a blanket legal conclusion against independently recording numerical facts.

**Specific external action needed for bulk integration:** supply a provider-approved text export with its schema, snapshot/revision and terms covering caching plus public repository/Pages snapshot distribution; alternatively authorize outreach to a named provider to obtain that method/permission. No contact was made and no credentials/purchase are requested. Once a real permitted sample exists, validate a representative mapping first, reconcile forms/relationships/EZA/SEZA/completeness counts, review updates against saved IDs, then expand through that same adapter. Unsupported characters remain catalog-visible; unsupported mechanics block only affected recommendations.

## Remaining batches

- Obtain an actual permitted scalable catalog sample/redistribution path, without manually authoring thousands of entries.
- Establish real board-template topology and exact per-state/progression mappings, route/stat-node/unlock configurations and attainable choices. Current profile aggregates cannot prove this.
- Verify native-kit attack-chain and probability/RNG conventions, expiry/stages/rounding separately for any expanded objective. Add one supported capability at a time; no copied calculator implementation.
- Extend real equipment records/restrictions/IDs with field-level evidence, independently confirm where possible, and keep unresolved items out of any verified-only mode.
- Profile larger joint searches before expanding UI/engine limits. Collection-wide allocation, investment/resource optimization and full battle simulation remain deferred.

See [validation results](VALIDATION.md), [existing evidence](character-build/EVIDENCE.md), [catalog contracts](CATALOG.md) and [maintenance documentation](CHARACTER_DEFINITIONS.md). No merge or deployment is part of this change.
