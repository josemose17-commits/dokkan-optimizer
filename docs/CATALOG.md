# Provider-independent catalog

The catalog is preserved at `?workbench=catalog`; the default product is now the [character-definition editor](CHARACTER_DEFINITIONS.md). The catalog milestone supplies working search/details and normalized JSON tooling. **Dokkan Info acquisition is paused pending an approved method.** No acquisition adapter, provider requests, bulk data, artwork, source calculator implementation or new source review is included. Provider preference and schema validity are not permission grants. Outreach requires explicit user authorization.

## Bundled coverage

**1 card form; 2 exact states: 1 EZA state and 1 base state; 0 SEZA states.** Ordinary starting/awakened/transformed classification remains unknown rather than guessed. The exact existing saved-build ID is preserved: `global-en:1003211:eza-7:lv140:sa15`.

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
- `coverage`: source-card count, scope and explicitly excluded IDs/reasons. A supplied source count must reconcile with admitted cards plus exclusions. An unknown total remains null.

`validateCatalog(unknown)` checks schema, enums, dates, stat numbers, provenance, safe URLs, duplicate/dangling identities, alias collisions, awakening cycles and reconciliation. Every object has a closed key set: an unknown key anywhere (snapshot, source, card, alias, state, awakening, fact, provenance, confirmation, profile, optimization, coverage) is an error rather than unvalidated content carried along, which also bounds nesting. Strings are limited to 100,000 characters, lists to 100,000 entries and link/category lists to 1,000. In the browser, a file that cannot be validated at all is rejected with a message instead of leaving the panel waiting. A future adapter can preserve unsupported game effects as descriptive text with unavailable optimization.

`AcquisitionAdapter.normalize(unknown)` is a separate interface. `importCatalog(adapter, sample)` validates its output and catches normalization failure without exposing arbitrary errors. No provider implementation is connected. A passing schema check establishes neither factual accuracy, source rights, independent confirmation nor game mechanics.

Test-only fictional records in `catalog.fixtures.ts` are clearly labeled **TEST ONLY**, imported only by tests and rejected by normal validation. They are not an expanded public catalog.

## Local commands

Use Node **24+**, after `npm ci`. Choose a new output path outside the repository; export refuses to overwrite an existing file:

```sh
npm run catalog:export -- ../admitted-catalog.json
npm run catalog:validate -- ../admitted-catalog.json
```

Export serializes the same one-card snapshot bundled in the app; it acquires nothing. Validation reads local normalized JSON only, with a 20 MiB file-size limit. It prints path-specific errors or actual counts and never replaces the bundled catalog.

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

## Reproduce the UI

1. Open **Characters** (`/dokkan-optimizer/?workbench=catalog`). Search `Goku` or `1003211`; AGL/UR/EZA matches one card/state. SEZA yields no admitted result. Clear filters to restore it.
2. Select the state. Its exact ID stays in the URL through reload/back/forward. An unknown `state` reports unavailable without substituting Goku.
3. Expand field evidence to see completeness, references, limitations and uncaptured retrieval/verification dates.
4. Select the admitted 55% stat illustration. Raw, potential, explicit no-equip totals and unavailable battle stats remain separate.
5. Set **Optimization support** to _Unavailable_ (no match) or _Limited evaluator available_ (Goku). **Optimize this character** opens the optimizer on that exact state.
6. Export the admitted record with the CLI, then inspect it via **Inspect a local normalized catalog file**. It is schema-valid, keeps every bundled ID and alias, and can be browsed for the session. A file with `origin: "test-fixtures"` is rejected.
7. Open **Tools → Source build examples** (it lists the one registered state), then return to **Characters**. Saved identity resolves without changing the payload or evaluator scope. The legacy demo retains its exact synthetic warning.

No new verified-only orb mode is added, and unresolved silver items are not promoted by this catalog. Legal node respec, damage objectives, probability refinement, purchases, merge and deployment remain outside this milestone.
