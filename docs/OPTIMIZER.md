# Dokkan Potential Optimizer

The default page is one workflow: **Character → Current build → Goal → Result**. It searches the attainable Hidden Potential allocations and the equipment it can verify for one exact character state, then states the recommended build, the changes, the improvement and a short calculation-backed reason. Main navigation is **Optimize · Characters · Tools**; maintenance, source examples and the legacy demo are Tools.

**Full allocation optimization is not available for any real character yet.** The allocation engine is real and connected to the search, but no complete, evidence-backed choice-node list exists for a real card, so the one optimizable state has a single documented allocation. Equipment search, user-entered current values and supported/experimental objectives work today.

## Actual coverage and scope

| Measure                                   | Bundled count | Meaning                                                                                             |
| ----------------------------------------- | ------------: | --------------------------------------------------------------------------------------------------- |
| Unique card forms                         |             1 | Existing admitted SS3 Goku; no new cards imported                                                   |
| Established awakening relationships       |             0 | Unknown form mapping is preserved, not inferred                                                     |
| Exact states                              |             2 | The EZA state below and the same card's individually recorded base state                            |
| Base (pre-EZA) states                     |             1 | Lv.120 / SA10, region unknown, single source; no evaluator                                          |
| EZA states                                |             1 | Global English, EZA step 7, Lv.140 / SA15                                                           |
| SEZA states                               |             0 | No substitution for EZA                                                                             |
| Complete required-detail records          |             0 | All 11 catalog detail fields plus region/state identity define completeness; both states incomplete |
| States with a limited evaluator           |             1 | Card-stat/initial-check subset only                                                                 |
| Ambiguous form mappings                   |             1 | The existing form relationship is unknown                                                           |
| Explicit unparsed/excluded source records |             0 | No bulk source was imported; this is not a claim that a source has no exclusions                    |
| Complete board templates                  |             0 | One partial aggregate profile; no reconstructed game graph                                          |
| Source catalog total                      |       Unknown | Comprehensive coverage cannot be reconciled                                                         |

What each part of the search covers for the one optimizable state:

- **Allocation:** the documented profile (55%, base board filled, no duplicate routes) is exactly **one** attainable allocation. The engine enumerates one option per unlocked choice node of a template; it is proven on TEST ONLY graphs with hand-enumerated results and is idle for real characters until a real template is admitted. The page shows **Full allocation support not available for this character yet.** before any search, with the missing evidence and the supported alternative.
- **Entered values:** users may replace the profile with their own current skill levels and stat additions (_Board requirements not checked._). They are evaluated as entered and searched with every equipment combination; they are never called attainable or full allocation. Technical bounds (0–40 levels, 0–50,000 stats) keep arithmetic finite and are not game limits.
- **Equipment:** 1 allocation × 4 bronze options × 4 silver options × 1 gold option (empty; no gold item recorded) = **16** combinations.
- **Objectives:** card ATK/DEF/HP are **Supported**; initial extra Super, critical and evasion chances are **Experimental**; expected damage and damage taken/survival are listed as not available and cannot be selected. No objective is preselected.

An unregistered or local state stays selectable and is explained as **Not supported yet** with its own reason; no other state's evaluator is used.

## Reproduce the supported result

1. `npm ci`, then `npm run dev -- --host 127.0.0.1`. Open `/dokkan-optimizer/` and choose **Super Saiyan 3 Goku · AGL UR · EZA step 7 · Lv.140 / SA15 · Global English**.
2. **Best available in catalog** (the default for a new session), **Card HP**, **Optimize**: 16 combinations, current HP 15,327, recommended 15,827 with **Bronze: Empty → AGL HP +500 · bronze Lv.5** (+500). Four configurations tie on HP; the one shown needs the fewest changes (**Multiple builds tie.**).
3. Equip that item now and optimize again: **Your current build is already best for Card HP.**
4. **Use my equipment** with no spare items: only current equipment can be used. Enter a spare copy to make an item available. An item already equipped can stay in its slot without a spare copy.
5. **Critical chance** with a silver Critical Hit item: 0.0% → 4.0% (+4.0 percentage points) and the formula _2 (Critical Hit levels) × 2.0% (chance per level) = 4.0%_.
6. **My current values** with Critical Hit 3: 6.0% → 10.0%.
7. **Maximum combinations checked** = 1 under Advanced: **Best found.** with the incomplete-search note. The current baseline is always evaluated.

The optimizer reads but never writes the older working settings (`dokkan.character-builds.v1`); named saves use the preserved library (`dokkan.character-library.v1`). Entered values are an optional field of the saved request, so earlier saves keep their exact shape. The source-example tool refuses saves with entered values instead of loading them partially. Maintenance uses its separate definition key.

## Model status, kit mechanics and recommendation meaning

Card HP/ATK/DEF are raw card stats + Hidden Potential additions + flat equipment stats. Battle modifiers are excluded. Goku's raw HP/ATK/DEF are 12,527 / 11,111 / 5,796, with separately documented +2,800 each for this profile.

Each evaluator declares, per objective, a **model status** (supported or experimental), a one-sentence summary, its ranking basis and the kit mechanics that change it. The initial-check skill chances are experimental: turn 1, first appearance, initial attack Super, no external effects. Each depends on a single skill's total level (Additional Attack, Critical Hit or Evasion), so **any convention in which the chance rises with level ranks builds identically**; only the displayed percentages depend on the unresolved source model (the FYI/RNG convention discrepancy remains). A unit test checks that the ranking equals the level ranking. This does not verify the percentages, and no full-turn chain, damage, battle DEF or survival result follows.

Each state declares its kit mechanics (native additional attacks, native critical, native evasion, attack-triggered, build-up, conditional and form-change effects) as absent, present or unknown, with evidence. A mechanic that is unknown, or present but not modeled, blocks every objective it could change, with that reason shown before any search. Goku's declarations come from its reviewed EZA kit claim: no native additional attacks, critical or evasion, so the skill-chance objectives stay available; build-up and form changes are unknown and block nothing that is offered.

Result outcomes distinguish recommended, current build already best, objective ties (stating whether the current build is among them), no compatible candidates, precise data/mechanics gates and incomplete search (**Best found.**). Deterministic tie preference is current build, then fewer changes, then stable input key; this is a presentation rule, not a resource-cost or strength formula. No universal weighted score is used. Alternative inputs are retained when complete exposed evaluations coincide.

Pareto comparisons use the same context and only metrics available across all candidates and baseline. Null never supplies a dominance advantage. If cancellation interrupts dominance checks, the frontier is unavailable. The declared current baseline always participates.

## Separation and performance

| Layer                        | Files                                                                        | Responsibility                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Factual catalog              | `src/character-data/`, `src/data/real/catalog.ts`                            | Exact cards/states, field completeness/provenance, normalized contract, update/saved-ID checks                |
| Potential profiles/templates | `src/potential/progression.ts`                                               | Explicit state/profile/data/template revision mappings; aggregate vs complete topology distinction            |
| Allocations                  | `src/character-build/allocation.ts`                                          | Attainable allocations per progression, entered values and their bounds, potential contributions by source    |
| Inputs/compatibility         | `src/character-build/domain.ts`, `legality.ts`                               | Progression/current choices, unlocks, type/category/state/slot restrictions, quantities                       |
| Candidate search             | `generation.ts`, `search.ts`                                                 | Allocations × compatible slot pools, rejection/evaluation budgets, host scheduling/cancellation               |
| Evaluation                   | `evaluation.ts`, evaluator registry                                          | Metrics/traces; objective models, gaps and modeled mechanics declared per implementation                      |
| Capabilities                 | `src/potential/capabilities.ts`                                              | What a state can evaluate before search: allocation modes, equipment per slot, objective status and kit gates |
| Ranking/outcomes             | `comparison.ts`, `src/potential/recommendation.ts`                           | Baseline, equivalence, objective ties, common-metric frontier, direct changes/deltas and gates                |
| Result text                  | `src/character-build/explanation.ts`, `src/potential/result.ts`              | Source breakdown (potential / chosen nodes / equipment / total), changes and short reasons from the trace     |
| UI                           | `src/potential/` (`PotentialOptimizer`, `CurrentBuild`, `GoalSettings`, ...) | The workflow, support summary, saved builds and the expandable explanation                                    |
| Maintenance                  | `src/character-definitions/`                                                 | Preserved secondary custom authoring/import/revisions, separately labeled arithmetic model                    |

The search-size estimate is allocation count × per-slot options (including empty), before inventory filtering. Supported choice-node structure is bounded to eight nodes; this technical bound is not a game maximum.

The engine yields every 128 candidate scans **and** every 128 pairwise dominance comparisons; the browser supplies task scheduling. Rejected combinations consume scan budget. Evaluation budget is 1–20,000; scan budget is 1–1,000,000. These protect the prototype, not a scalability claim. A Web Worker is not justified at 16 combinations; revisit when a real template multiplies the allocation count. Cancellation and edits invalidate in-flight results. Total compatible count is unknown when truncated.

## Catalog acquisition gate

A focused check on 2026-10-19 inspected two additional public GitHub exports instead of repeating blocked-provider/API-token routes. Repository files/README/license metadata and the small JSON sample were read; no download scripts, scraper or arbitrary data content were executed. No dataset was admitted or redistributed.

| Actual export inspected                                                                                                                                                                        | Observed sample/schema                                                                                                                                                                                                                                                                  | Access, reuse and coverage limits                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [feijoes/DokkanAPI](https://github.com/feijoes/DokkanAPI), `data/test.json` blob `ffd50bbea768f3533c41408fbb560cd0711f8898`, 6,760 bytes                                                       | Three records, IDs 11900/12022/11168. Actual keys include name/title/ID/type/rarity/level, leader/passive/Super text, links/categories, base/max/free-dupe/rainbow stats, transformations. No choice-node graph, equipment restrictions or explicit SEZA-state identity in this sample. | Public repository read; AGPL-3.0 project license. README credits MNprojects' wiki-derived scraper. Code licensing does not settle all upstream descriptive-text/dataset rights or current card/state completeness. The main JSON is listed as 1,818,189 bytes (blob `53f0a9eb2b4c736e5ce82b4dd713a1b5a8d1cbbf`) but was not imported; sample absence is not a conclusion about every field in that file. Source snapshot/date and source reconciliation remain unestablished. |
| [Daniel-Fauland/dokkan-battle](https://github.com/Daniel-Fauland/dokkan-battle), published `dbz_db_characters_2023_08_18.xlsx`, blob `a5491130d5217235cd7bee1c1ddbf9cfd13ef62a`, 150,513 bytes | README advertises CardID/categories/release dates and 55%/100%/EZA profile totals. Workbook contents were not downloaded/interpreted.                                                                                                                                                   | Dated 2023 export, not established as current. No LICENSE file in inspected root; casual code reuse wording does not establish upstream dataset/text redistribution. Aggregate profiles are not raw-stat/state or potential-topology proof.                                                                                                                                                                                                                                   |

**Exact remaining acquisition gate:** neither inspected export establishes both maintainable current exact-state coverage and applicable permission/provenance for the text snapshot distributed in this public repository/Pages bundle. No production acquisition adapter is connected and comprehensive counts cannot be claimed. This is not a blanket legal conclusion against independently recording numerical facts.

**Specific external action needed for bulk integration:** supply a provider-approved text export with its schema, snapshot/revision and terms covering caching plus public repository/Pages snapshot distribution; alternatively authorize outreach to a named provider to obtain that method/permission. No contact was made and no credentials/purchase are requested. Once a real permitted sample exists, validate a representative mapping first, reconcile forms/relationships/EZA/SEZA/completeness counts, review updates against saved IDs, then expand through that same adapter. Unsupported characters remain catalog-visible; unsupported mechanics block only affected recommendations.

## Allocation milestone status

The focused board/template check did not establish a complete real allocation set. See the [specific inspected evidence and stop point](character-build/EVIDENCE.md#focused-allocation-gate-review--2026-10-19). That gate was not re-audited for this workflow rework: no character, combat metric or assumed board was added. The allocation engine and entered values are foundations; the HP/equipment comparisons are not completion of the allocation milestone. **Concrete user action that would close it:** screenshots of one owned card's whole Hidden Potential board with route locks and its readable choice dialogs, or a complete documented node table bound to that card/template.

## Remaining batches

- Obtain an actual permitted scalable catalog sample/redistribution path, without manually authoring thousands of entries.
- Establish real board-template topology and exact per-state/progression mappings, route/stat-node/unlock configurations and attainable choices. Current profile aggregates cannot prove this.
- Verify native-kit attack-chain and probability/RNG conventions, expiry/stages/rounding separately for any expanded objective. Add one supported capability at a time; no copied calculator implementation.
- Extend real equipment records/restrictions/IDs with field-level evidence, independently confirm where possible, and keep unresolved items out of any verified-only mode.
- Profile larger joint searches before expanding UI/engine limits. Collection-wide allocation, investment/resource optimization and full battle simulation remain deferred.

See [validation results](VALIDATION.md), [existing evidence](character-build/EVIDENCE.md), [catalog contracts](CATALOG.md) and [maintenance documentation](CHARACTER_DEFINITIONS.md).
