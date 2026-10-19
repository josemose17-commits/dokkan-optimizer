# UR/LR catalog and provider-independent contract

The catalog is integrated into the [primary character workspace](OPTIMIZER.md). A provider-specific build-time adapter now reads the pinned **published MNprojects/DokkanAPI JSON factual projection**. There are no runtime provider requests. Dokkan Info remains a separate paused acquisition track; no token, purchase, scraping, artwork or calculator implementation is involved.

## Bundled coverage

**794 catalog identities / 1,109 recorded states.** This combines the unchanged 2 reviewed identities / 3 states with **792 historical source identities / 1,106 states**. Names are never used to merge provider identities into reviewed IDs; counts are not distinct current-game characters. The source snapshot is January 2023, not a complete current roster.

| Reconciliation item        | Count / handling                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Published source rows      | 796: 683 UR, 113 LR                                                                                  |
| Accepted source rows       | 793                                                                                                  |
| Imported source identities | 792: 679 UR, 113 LR                                                                                  |
| Imported states            | 792 base, 314 EZA, 0 SEZA                                                                            |
| Combined states            | 793 base, 316 EZA, 0 SEZA                                                                            |
| Conflicting identity       | ID 12521, rows 344 / 605: both excluded                                                              |
| Non-character material     | ID 11148, row 788: explicitly excluded                                                               |
| Repeated same identity     | ID 11066, rows 199 / 519: one identity; conflicting categories unavailable, both stat tables labeled |
| Unmapped embedded forms    | 125; counted separately, not guessed into extra cards                                                |

EZA presence is derived only from explicit EZA-description fields; exact step/region/level remains unknown. Mixed stat scopes are not assigned to an awakening. Missing type/SA alone never discards a character. Copied skill prose, unresolved footnotes and artwork are omitted. Historical source records have no optimization support. Gohan's existing state retains reviewed kit guidance; Goku's limited evaluator retains exact IDs and revision.

The [dataset NOTICE](../src/data/real/mnprojects/NOTICE.md), [AGPL license](../src/data/real/mnprojects/LICENSE-AGPL-3.0.txt) and [manifest](../src/data/real/mnprojects/manifest.json) record access, redistribution basis, attribution, changes and actual reconciliation. The factual projection retains the root published repository license; this does not grant rights to artwork or all upstream expressive content, relicense the app, or independently verify mechanics.

The exact existing saved-build ID is preserved: `global-en:1003211:eza-7:lv140:sa15`.

The base state, `unknown-region:1003211:base:lv120:sa10`, is an individually recorded, single-source record from `src/data/real/catalog-states/1003211-base.ts`. Of its 11 detail fields, 8 are complete, 1 is partial and 2 are missing; it has no evaluator. See the [evidence ledger](character-build/EVIDENCE.md).

The EZA state's values and evidence come only from the existing `src/data/real/character-build/goku.ts` record. Of 11 detail fields, 6 are complete, 2 are partial summaries and 3 are missing. Name/title evidence is separate. Missing leader details, links and categories are null with reasons. Legacy `categories: []` meant "not imported", not an established empty set.

All available fields are source-documented; **0 fields have independent confirmation**. Existing review dates are retained. Previously uncaptured retrieval dates, source revisions, game build and independent confirmations remain null. The new snapshot creation date records local normalization only.

Raw Lv140 stats are 12527/11111/5796. The admitted 55% profile separately adds 2800 to each. The UI's no-equipment illustration explicitly adds zero flat equips and produces 15327/13911/8596. Battle stats remain null. The illustration is not a current-build claim or choice-node topology.

## Contract and validation

`src/character-data/domain.ts` defines normalized JSON independently of any provider format:

- `cards`: stable internal ID, name/title facts, source aliases and ordinary card-form relationships. Same names never merge identities.
- `states`: exact card reference, awakening kind/step, region, game version, level/SA assumptions and descriptive fields. EZA/SEZA states are not additional card forms. Every card needs an explicit state, including unknown mappings.
- `Fact<T>`: value, complete/partial/missing coverage, field provenance and limitation. Missing requires null and a reason. A documented zero or empty list differs from missing data.
- `sources`: reference URL/access, license and permission reference. Unknown rights stay unknown. An `approved-export` entry requires a recorded grant reference; validation cannot authenticate that grant.
- `optimization`: unavailable/limited plus a reason and optional evaluator ID. Source effect text is never executed. The **Optimize this character** link appears only when the evaluator registry resolves the state's own evaluator ID to an entry bound to that exact state; otherwise the details show the exact reason (no implementation, binding mismatch, data mismatch). Session files are never resolved.
- `reportedStats` (optional on a state): separately labeled source-total observations with nullable level, potential percentage and route count. These do not enter `potentialProfiles`, raw-stat arithmetic or evaluation. All optional keys and totals are validated.
- `coverage`: source-card count, scope and explicitly excluded IDs/reasons. A supplied source count must reconcile with admitted cards plus exclusions. An unknown total remains null.

`validateCatalog(unknown)` checks schema, enums, dates, stat numbers, provenance, safe URLs, duplicate/dangling identities, alias collisions, awakening cycles and reconciliation. Every object has a closed key set: an unknown key anywhere (snapshot, source, card, alias, state, awakening, fact, provenance, confirmation, profile, optimization, coverage) is an error rather than unvalidated content carried along, which also bounds nesting. Strings are limited to 100,000 characters, lists to 100,000 entries and link/category lists to 1,000. In the browser, a file that cannot be validated at all is rejected with a message instead of leaving the panel waiting. A future adapter can preserve unsupported game effects as descriptive text with unavailable optimization.

`AcquisitionAdapter.normalize(unknown)` is a separate interface. `importCatalog(adapter, sample)` validates its output and catches normalization failure without exposing arbitrary errors. The MNprojects adapter is separate from this contract and consumes a pinned factual projection only. A passing schema check establishes neither factual accuracy, source rights, independent confirmation nor game mechanics.

Test-only fictional records in `catalog.fixtures.ts` are clearly labeled **TEST ONLY**, imported only by tests and rejected by normal validation. They are not an expanded public catalog.

## Local commands

Use Node **24+**, after `npm ci`. Choose a new output path outside the repository; export refuses to overwrite an existing file:

```sh
npm run catalog:export -- ../admitted-catalog.json
npm run catalog:validate -- ../admitted-catalog.json
```

Export serializes the same complete bundled reference snapshot (794 identities / 1,109 states); it acquires nothing. Validation reads local normalized JSON only, with a 20 MiB file-size limit. It prints path-specific errors or actual counts and never replaces the bundled catalog.

Compare two locally prepared snapshots:

```sh
npm run catalog:validate -- ../next-catalog.json ../admitted-catalog.json
```

The update report lists added/removed cards/states, changed state fields and compatibility issues. Exit codes: **0** valid/compatible; **1** validation/file/command error; **2** structurally valid but identity-incompatible update. Permission and source review remain separate from these checks.

## Identity, updates and persistence

Search is accent/case insensitive for names/titles/IDs. Filters (type, rarity, awakening, category, region, optimization support) must match the **same state**. Missing categories do not match specific known categories; explicit unknown-category filtering is available. Missing optimization support does not hide descriptive cards. Each card's normalized search text is indexed once per snapshot object (a `WeakMap`), so each search is one pass over states and one over the precomputed card index. Sort is either catalog order or a deterministic name order: normalized name, then title, then card ID. Unknown names and titles sort after known ones rather than as empty strings. The UI renders 50 matching cards at a time.

## Inspect a local file in the browser

**Inspect a local normalized catalog file** in the catalog page accepts a JSON file of up to 20 MiB. It checks the size before reading and runs the same `validateCatalog` as the CLI, without the test-fixture allowance. Parse errors are not echoed. Up to 20 truncated validation messages are shown as plain text. A valid file shows its counts and the `assessCatalogUpdate` report against the bundled revision. You can then **browse it for this session** behind a banner that says it is not admitted or reviewed and that its evidence statuses are as declared. Session files are never written to storage or the URL. Their states get no optimization link or saved-build navigation, whatever support they declare. **Return to bundled catalog** restores the admitted record.

`resolveState` accepts only canonical IDs or declared aliases. `resolveBuildState` also checks level and SA. No name match, inferred ID conversion or latest-state substitution is used. Catalog revisions are separate from state identities.

`assessCatalogUpdate` flags removed state targets and reassigned awakening, region, level, SA or aliases as incompatible. It does not apply updates or rewrite saves. An eventual provider integration must retain referenced snapshots or show their absence; this milestone does not supply provider archives or an automatic updater.

The existing `dokkan.character-builds.v1` payload and evaluator catalog revision stay unchanged. Catalog browsing reads identity without writing it; full request validation stays in the existing workbench. Corrupt, unavailable or unknown mappings remain untouched. The legacy collection key stays independent.

## Published-file reproduction and updates

The actual source was inspected before normalizing a representative LR, an EZA-bearing LR, historical Goku and conflicting/missing records. The same tested adapter then normalized all 796 rows. `src/data/real/mnprojects/facts.json` contains only allowlisted factual columns; normalized identities/state facts are generated by `mnprojects-adapter.ts` and validated before bundling. No downloaded scripts or text are executed.

Source: [`data/DokkanCharacterData.json` at c28a0248](https://github.com/MNprojects/DokkanAPI/blob/c28a0248e36d97ebb678345d97be746f5f98d656/data/DokkanCharacterData.json), Git blob `e42a9904720b956e7406d79cee74d497a7578a58` (1,819,153 UTF-8 bytes). Repository commit date: 2023-01-22; game version/region unknown. Retrieved/reviewed: 2026-10-19.

To independently reproduce the factual projection from a local copy of that published file, retaining its exact bytes (the original has no final newline):

```sh
node scripts/mnprojects.mjs ../DokkanCharacterData.json ../new-mnprojects-facts.json
```

The command makes no network request, verifies the exact Git blob hash, enforces a 20 MiB limit and refuses overwrite. It does not admit a new revision. Compare its parsed output with the bundled facts. To update: review a new published source/license; change the commit/blob pin deliberately; project and validate a small sample; reconcile all rows/conflicts/embedded forms; update the manifest and notices; test the full normalized export against the previous export for removed/reassigned IDs and save compatibility. Do not silently substitute ID mappings or source fields. There is no automated freshness claim.

## Reproduce the UI

1. Open **Search characters and inspect details** (`/dokkan-optimizer/?workbench=catalog`). Search `Broly Cheelai`; filter **LR / PHY / Joined Forces**. Select its base state and inspect the source free-dupe/rainbow table. Percentages and duplicate routes remain unknown; no arbitrary intermediate profiles are offered.
2. Search `mnprojects:card:11168`, filter **EZA**, and select the state. Level/SA/raw-stat scope remain explicitly unavailable; the base state's reported tables are not relabeled EZA. SEZA has no source records.
3. Clear filters: first 50 of 794 identities render; **Show 50 more** expands pagination. Open coverage for counts, exclusions, evidence definitions and source license; the visible license download works under the Pages prefix.
4. Select reviewed Goku `1003211`, EZA, then inspect the 55% illustration. Raw/potential/equip/unavailable battle layers remain separate. Only its bound numerical evaluator enables comparison. Historical source matches receive no borrowed evaluator.
5. Export/validate the bundled catalog with the CLI and inspect the file in the session-only browser importer. No saves or bundled data are overwritten. Existing exact state URLs and named/working builds retain their original revision and values.

No verified-only orb mode is added; unresolved silver items are not promoted. A complete real node graph, all duplicate percentages, damage objectives, probability refinement, purchases, merge and deployment remain outside this catalog import.
