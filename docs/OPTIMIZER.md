# Primary workspace

The product chain is **kit → intended assignment → potential priorities → joint allocation/equipment candidates → recommended build and explanation**. The implemented boundary is reviewed Gohan kit guidance plus the retained limited Goku comparison. It is not a complete allocation optimizer. See [kit policy, examples and evidence](KIT_GUIDANCE.md).

## Product structure

`src/Workbench.tsx` exposes one primary workspace and a compact secondary menu. `PotentialOptimizer` owns exact-state selection, integrated character search/details, kit analysis and, only for a resolved numerical entry, current build/goal/result and a collapsed saved-build library. Maintenance stays secondary and preserves its immutable authored revisions. No separate Tools or source-example app is bundled.

Old `?workbench=character-build` and `tools` links return to the optimizer. Old catalog/bare-state links open integrated browsing; state IDs survive, including unknown IDs. Legacy demo links show its retirement note and no team UI. No code reads or deletes its storage key.

## Keep / consolidate / remove

| Components                                                                                                                      | Disposition                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Catalog contracts, validation, search, identity, stat layers, import/update review                                              | Retained; browsing is integrated                                                                        |
| Numerical registry, allocation/generation/evaluation, bounded cooperative search, baseline/ties/equivalence, explanation traces | Retained unchanged as separate pure layers                                                              |
| Named build library and authored definitions                                                                                    | Retained with original storage contracts; named saves collapse behind a summary                         |
| `BuildOptimizerPage` / `CharacterWorkbench`                                                                                     | Removed duplicate UI; primary workspace consumes their shared engines/library/trace                     |
| `App`, `src/engine`, team domain/components/fixtures, demo-only tests/styles                                                    | Removed from product; history preserves them                                                            |
| `storage/browser.ts`                                                                                                            | Extracted shared safe access helper before deleting legacy storage module                               |
| `character-build/kit.ts`, `assignment.ts`, `policy.ts`                                                                          | New reviewed kit admission, qualitative assignment and priorities, independent of React/storage/network |
| `CharacterAnalysis`                                                                                                             | Direct kit-based result, evidence trace, meaningful priority override, exact-build gap                  |

## Coverage and identities

Two card identities, three exact states: original Global English AGL UR EZA SS3 Goku Lv140/SA15, same card pre-EZA Lv120/SA10 (unknown region), and TEQ UR EZA Gohan Teen Lv140/SA15 (unknown region/numeric EZA step). EZA/SEZA are never merged. No established form relationships, complete required-detail record or real complete board template. One numerical evaluator, one reviewed kit policy, six partial equipment records (no gold). All independent-confirmation dates are null.

Goku retains `global-en:1003211:eza-7:lv140:sa15`, data revision `goku-initial-check-2026-10-18.1`, evaluator `goku-initial-check-v1`, and storage shapes. The descriptive snapshot revision changes independently. Unknown/null EZA step is now admitted by the descriptive schema; an explicit positive step still needs a positive integer. It does not create a step-specific evaluator mapping.

## Numerical engine retained

Allocations come from a documented graph/template or entered totals. Generation combines allocations with compatible slot items and inventory quantities. Evaluation is independent; unknown metrics stay null. Pareto comparisons use a common available metric set in one context and retain exact ties/equivalent inputs. Cooperative enumeration and dominance work yield; limits/cancellation prevent unbounded UI work. Truncation precludes a complete optimum.

Only Goku resolves a numerical evaluator. Card-stat arithmetic is not combat performance. Initial AA/critical/evasion checks retain unresolved source-model conventions and are experimental. No meaningful damage/survival allocation objective is offered. Gohan does not borrow this evaluator. No new attainable allocation set has been admitted.

## Persistence and consolidation

The main workspace reads valid older working settings without overwriting them. Invalid/newer copies remain downloadable and untouched even after edits. Named saves, strict JSON import previews, stale/unknown-ID handling, immutable library identity and cross-tab conflicts are preserved. The source-example autosave protocol is retired; saving now requires an explicit named save. Reset affects working inputs only.

Keys: `dokkan.character-builds.v1`, `dokkan.character-library.v1`, `dokkan.character-definitions.v1`; obsolete `dokkan-team-lab.collection.v1` remains untouched. No migration, destructive clearing or user data commit is needed. Regression tests exercise old source-example requests and exports in the primary workspace.

## Catalog acquisition gate

One external requirement: an approved Dokkan Info text export/sample with schema, source revision and terms permitting caching, public repository/Pages data distribution and an update cadence. None has been supplied. Do not re-audit the same blocked provider, request API credentials, contact anyone or purchase access. Individual source-documented facts and local user imports are separate from a bulk integration. No provider adapter is connected.

See [README reproduction](../README.md), [evidence ledger](character-build/EVIDENCE.md), [catalog contract](CATALOG.md), [maintenance](CHARACTER_DEFINITIONS.md), and [actual validation results](VALIDATION.md).
