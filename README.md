# Dokkan Hidden Potential Optimizer

The primary workbench is **character → exact progression/current build → equipment/context/objective → direct recommendation**. The character editor is secondary at `?workbench=definitions` (**Character maintenance**). Catalog browsing, source examples, named saved builds and the synthetic team demo remain available.

**This is an initial, gated implementation, not a complete potential optimizer.** Full allocation requests currently return the exact missing node/template evidence. The existing Goku profile can separately produce a direct **selected-profile** recommendation for a card-stat objective, or an explicitly acknowledged initial-check probability model. It does not search unestablished route/node configurations, infer attainable totals, calculate damage or estimate survival. See [scope, architecture, acquisition findings and reproduction](docs/OPTIMIZER.md).

Bundled coverage: **1 unique card form, 0 established awakening relationships, 1 EZA state, 0 SEZA states, 0 records with all required detail fields, 1 limited evaluator state and 0 complete board templates**. The source catalog total is unknown. That state is **[Mystery Super Technique] Super Saiyan 3 Goku — Super AGL, Global English, fully EZA step 7, Lv.140 / SA15, without Super EZA**. Catalog and maintenance inclusion do not imply optimization support; no other state inherits this evaluator.

No new dataset was imported. A bounded check of two additional public exports did not establish a current comprehensive exact-state catalog with a confirmed public snapshot distribution path. The [inspected samples and precise acquisition gate](docs/OPTIMIZER.md#catalog-acquisition-gate) are documented once. Dokkan Info remains preferred but its bulk acquisition is paused. No provider contact, token, purchase, undocumented endpoint, artwork, calculator code or copied bulk database is involved.

**Source-documented model; no independent in-game verification recorded.** Probability conventions remain unresolved. Passing schema/math tests is not game confirmation; all current independent-verification dates remain null. Required unknown objective mechanics block recommendations. [Evidence ledger](docs/character-build/EVIDENCE.md).

The preserved team demo at **`?workbench=legacy-team`** retains **“Synthetic demonstration — not real Dokkan recommendations.”** Its data/scores remain isolated. [Legacy documentation](docs/LEGACY_TEAM_DEMO.md).

## Setup and checks

Use **Node.js 24+** and npm:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/dokkan-optimizer/`.

```sh
npm test
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1
npm run test:e2e   # builds, serves dist/ and runs the Playwright suite (CI runs it before any deployment)
```

Production preview: `http://127.0.0.1:4173/dokkan-optimizer/`. The browser suite needs Chromium for `@playwright/test` 1.56.1 (`npx playwright install chromium` once; containers with a preinstalled build can set `PLAYWRIGHT_BROWSERS_PATH`). It runs desktop (1366×900) and mobile (390×844) projects and fails on page errors, failed requests or requests outside `/dokkan-optimizer/`. The project uses React, TypeScript, Vite and Vitest. No backend, telemetry, game-account connection, runtime scraper or external asset requests are needed.

## Reproduce a direct recommendation

1. Open `/dokkan-optimizer/` and select the exact Goku EZA state. With no older working settings, the defaults are inventory mode, empty current slots and **Card HP**. Existing saved settings are read without overwriting them.
2. Leave **Full potential allocation** selected and click **Recommend build** to see the precise graph gate. No full-allocation result is substituted.
3. For the supported subset, explicitly select **Selected documented profile only**. Confirm the filled 55% no-dupe profile, zero duplicate routes, unlocked system, Lv.140 / SA15 and empty current equips. Gold is locked. This profile's fixed AA5 is not a reconstructed board.
4. Select **Best available in catalog** and **Card HP**, then **Recommend build**. The 16 supported combinations complete: recommended HP **15,827**, current **15,327**, change **bronze → AGL HP +500**, delta **+500**. Four configurations tie on HP; the displayed alternative makes the fewest changes. Expand alternatives and the computed trace.
5. Switch to **Best build using my available equipment**. With no inventory/current equips, the empty current build is already best. Enter quantity **1** for the HP orb to get the +500 recommendation. Current items may be retained in place with zero unequipped copies; they are not extra transferable inventory.
6. Initial-check probability objectives require an explicit model acknowledgement in Advanced settings. These are conditional model comparisons, never verified optimal-damage recommendations. Set an evaluation budget of **1** to see **Best found so far — search incomplete**; the current baseline remains considered.

The scopes, evidence status, catalog limits and excluded combat metrics remain visible. Changes may cost resources; affordability/respec costs are not modeled. Named saved-build backups are available below the result; the recommendation scope, acknowledgement and scan budget are session controls and are not added to the older saved-build schema.

The preserved **Source build examples** (`?workbench=character-build&state=global-en%3A1003211%3Aeza-7%3Alv140%3Asa15`) retain their detailed comparator and original settings behavior. The catalog's **Optimize this character** link opens the new primary flow. Maintenance supports custom authored comparisons, explicitly without a board-compatibility claim ([instructions](docs/CHARACTER_DEFINITIONS.md)).

## Evaluator registry

The optimizer is not hardcoded to Goku. A registry entry (`src/data/real/character-build/registry.ts`) binds **one exact catalog state** to:

- its **evaluation data**: exact-state card facts, the progression profile, compatible equipment and evidence, with a data revision;
- its **supported contexts** (for example, whether "evasion disabled" may be selected);
- its **available objectives**;
- an **evaluator implementation** (`initialCheckEvaluator`, independent of any character);
- its own **working-settings key**. Goku keeps `dokkan.character-builds.v1`; any other entry would use `dokkan.character-builds.v1:<entry id>`.

The catalog state names its evaluator (`optimization.evaluatorId`). `resolveEvaluator` accepts the pair only if the entry is bound to that exact state and card, and the catalog and evaluator agree on name, title, type, rarity, level, Super Attack level and region. Every refusal shows its exact reason in the catalog and at `?workbench=character-build&state=…`:

- unknown state;
- no support declared;
- no implementation registered;
- the evaluator is bound to another state;
- the catalog and evaluator data disagree;
- the registry itself is inconsistent.

Nothing falls back to another evaluator. Saved builds load only into the evaluator bound to their own state, revision and evaluator ID.

The production registry has **one entry**. A second, clearly labeled **TEST ONLY** character (with a gold slot, a choice node and its own items) and a test-only stats-only evaluator live in `src/character-build/registry.fixtures.ts`. Unit tests and server-rendered component tests use them to prove isolation. The browser suite checks that they are absent from the production bundle.

## Result explanations

Selecting **Explain #n** on any result opens a panel generated from that result's own calculation trace. The panel re-evaluates the exact configuration shown, so equivalent alternatives are explained from their own sources. The compact summary shows:

- the proposed vs current equips and choices;
- the objective value vs the current build in **percentage points** and **relative change**, with relative change stated as undefined against a zero baseline;
- whether the result ranks above, below or ties the baseline, and its rank and tie count;
- whether it is on the Pareto frontier, or which result (or the baseline) dominates it and on which metrics.

Expandable sections show:

- stat additions by source;
- skill levels by source;
- each probability as a product of its factors, for example `7 (AA levels) × 2.0% = 14.0%` and then `14.0% × 50.0% = 7.0%`;
- every evidence claim used, labeled **source-documented**, **independently corroborated** or **unresolved**;
- the mathematical test coverage statement;
- the data revision, evaluator entry and implementation version, and context;
- unavailable metrics and unsupported effects.

Each result row also has a one-line computed summary (for example "above the baseline · dominated by #1").

## Saved builds and backups

The primary optimizer reuses this named-build library and reads the existing working settings without autosaving over them. The autosave/reset behaviors below belong to the preserved source-example workbench. Both retain exact state/revision checks.

- **Save build** stores the current workbench settings under a name. Each record keeps the exact card state, level/SA, catalog revision (`goku-initial-check-2026-10-18.1`), evaluator version (`goku-initial-check-v1`), progression, equips, inventory quantities, context, objective and limit. It saves inputs, not results; loading and comparing re-evaluates them.
- **Load**, **Delete** and **Reset working settings** each ask for confirmation in a modal dialog; Escape cancels.
- A build saved against another catalog revision or evaluator version is kept and marked **stale**. It cannot be loaded and no substitute is made. Same-revision settings that fail legality are marked **invalid**, and unknown item IDs are shown as `Unknown item (<id>)`, never as an empty slot.
- **Export JSON** downloads the saved builds and valid working settings, including inventory quantities, as `dokkan-optimizer.character-builds` version 1. **Import JSON** treats the file as untrusted: 1 MiB limit, strict structure, and a preview before anything changes. The preview lists, per build, exactly what the import will do; the import applies that same plan. Replacing the working settings is a separate opt-in.
- **Identity rule:** a saved build is identified by its `id`. An imported build is skipped as an exact duplicate only when a saved build has the same `id` and identical content (object key order ignored). The same `id` with different content is kept under a new ID. A different `id` is always a separate build, even with identical settings. Existing builds are never replaced.
- While any field shows an error, autosave pauses and **Save build** and the working-settings part of **Export JSON** are refused, so a stored or exported value never differs from what the form shows.
- If another tab changed the saved builds, a write is refused and the latest list is loaded instead of overwriting that change. Unreadable working settings can be downloaded (**Download stored settings copy**) before an edit replaces them.
- If stored builds are unreadable or from a newer version, they are left untouched and saving is disabled. You can **Download stored copy** or explicitly **Replace with empty library**.

## Metrics and comparisons

- **Card HP/ATK/DEF:** card base + the fixed +2800 potential bonus + flat equips. They exclude leader, passive, link, support, Ki and Super Attack combat multipliers. Card ATK is not damage; card DEF is not survivability.
- **Initial AA check:** trigger `0.02 × total AA`; trigger followed by a Super `0.02 × total AA × 0.5`. This is the initial eligible attack's check, not the full-turn probability of another Super or a modeled attack chain.
- **Critical/evasion:** `0.02 × critical level` per eligible attack and `0.01 × evasion level` per eligible incoming attack, with no native/external chance effects. An evasion-disabled context explicitly assumes 0. No named boss is inferred.
- **Damage and battle DEF:** unavailable/null with explanations, never zero or replaced by a fixture rating. The objective selector offers supported metrics only.
- Ranking sorts the selected metric and preserves ties. The frontier uses the same context and the common available selected metrics: no worse on all, better on at least one. Unknown metrics are omitted explicitly, never filled with zeros. There are no universal weights.
- Equivalent exposed evaluations are grouped with **all** legal allocation/equip alternatives retained. Equivalence is limited to the modeled metrics and does not mean equal costs. Inventory quantities and current attached items are checked before evaluation.
- Before comparing, the workbench shows the generator's search-space upper bound: per-slot options including empty × allocations. That is 16 for the released profile, and inventory checks can only reduce it. The limit warning appears when the bound exceeds the candidate limit.
- Deltas: probabilities show percentage points (pp) and relative change; stats show absolute and percentage change. A zero baseline reports relative change as `n/a` instead of dividing by zero.
- Search generation is independent of evaluation. The primary flow schedules bounded scan/evaluation and pairwise-frontier work cooperatively, with progress/cancellation. Counts, limits and truncation are reported. If truncated, total legal count is unknown and ranks/frontier apply only to evaluated targets. No global optimum is claimed.

## Evidence, data path and remaining gates

Read [field evidence](docs/character-build/EVIDENCE.md), [current access/reuse assessment](docs/character-build/DATA_ACCESS.md), and [the original source review](docs/DATA_SOURCES.md). Access restrictions, copied expressive content, compiled-dataset rights and independently recorded individual numbers are assessed separately. Missing bulk permission is not automatically a ban on recording facts. No blanket legal or data-reuse permission is claimed.

`src/data/real/character-build/goku.ts` contains one manually normalized card profile and six numeric orb records with stable internal IDs. Source game item IDs are unknown and remain null. Source confidence and retrieval limitations, including indexed silver item labels, are visible. No artwork, long card descriptions, compiled third-party dataset, source calculator code or internal endpoint response is bundled.

Remaining gates: exact Goku node options/prerequisites; independent card/orb/probability confirmation; direct current confirmation of generic silver restrictions/IDs; attack-chain behavior; outgoing damage stages and rounding; passive expiry and battle stats. Broader or paid dataset integration requires a separately established access/reuse path. Updates are manual, versioned and reviewed; there is no live updater.

The current task checklist and blockers are in [docs/ROADMAP.md](docs/ROADMAP.md).

Deferred: complex kits, stacking/transformations, collection-wide equipment allocation, investment priorities, resource-cost optimization, full battle simulation, clear probabilities and survival estimates.

## Code and persistence

| Path                                                          | Responsibility                                                                          |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/potential/`                                              | Primary recommendation UI, exact template mappings, gates, direct outcomes and coverage |
| `src/character-build/search.ts`                               | Cooperative bounded enumeration and dominance checks, progress/cancellation             |
| `src/character-data/`                                         | Normalized contract, validation, search, identity, stat layers and update assessment    |
| `src/characters/CatalogBrowser.tsx`                           | Secondary catalog search/details, completeness, evidence and saved-build identity       |
| `src/data/real/catalog.ts`                                    | Migration of the existing admitted Goku record; no provider acquisition                 |
| `scripts/catalog.mjs`                                         | Local normalized JSON export/validation and compatibility report                        |
| `src/character-build/domain.ts`                               | Separate real-card/evidence/build/context/metric contracts                              |
| `src/character-build/legality.ts`, `generation.ts`            | Fail-closed restrictions, node prerequisites, inventory and lazy legal generation       |
| `src/character-build/evaluation.ts`, `comparison.ts`          | Card stats, supported probabilities, baselines, equivalence, ranks and Pareto frontier  |
| `src/character-build/engine.test.ts`                          | Independent arithmetic, enumeration, eligibility and comparison oracles                 |
| `src/character-build/storage.ts`, `storage.test.ts`           | Validated versioned character state; catalog-revision checks and visible failures       |
| `src/character-build/CharacterWorkbench.tsx`                  | Generic per-entry workbench: inputs, results, row summaries, evidence                   |
| `src/character-build/registry.ts`                             | Pure evaluator resolution by exact state ID; registry consistency; no fallback          |
| `src/data/real/character-build/registry.ts`                   | Production registry (one Goku entry); fixtures live only in tests                       |
| `src/character-build/explanation.ts`, `ResultExplanation.tsx` | Explanations computed from the calculation trace and comparison result                  |
| `src/character-build/BuildOptimizerPage.tsx`                  | State picker, exact refusal reasons, per-state workbench and cross-state loads          |
| `src/character-build/library.ts`, `SavedBuilds.tsx`           | Saved-build records, strict parsing, export/import, merge rules and their UI            |
| `src/character-build/format.ts`                               | Metric and delta presentation (pp, relative change, zero baseline)                      |
| `src/characters/LocalCatalogImport.tsx`                       | Session-only inspection of a user-supplied normalized catalog file                      |
| `e2e/`, `playwright.config.ts`                                | Checked-in browser suite against the production build                                   |
| `src/Workbench.tsx`                                           | Catalog, comparison and legacy navigation without server routing                        |
| `src/data/real/`                                              | Source-documented real facts, separate from fictional fixtures                          |
| `src/App.tsx`, `src/engine/`, `src/data/fixtures/`            | Preserved legacy team prototype and tests                                               |
| `AGENTS.md`                                                   | Rules for future tasks and evidence admission                                           |

Character settings use `dokkan.character-builds.v1` for the Goku entry (contract unchanged); any future entry gets `dokkan.character-builds.v1:<entry id>`. Named saved builds use the separate `dokkan.character-library.v1`. The legacy collection retains `dokkan-team-lab.collection.v1`. Both are local to the browser origin. Invalid/newer schemas, changed catalog revisions, blocked storage and quota errors are surfaced. Reading an invalid character save does not overwrite it until an edit. No saved user state is committed or sent anywhere.

Tests using abstract graphs and invented branch-damage values are **mathematical tests, not combat verification or fictional product data**. Existing legacy tests remain unchanged. See [validation](docs/VALIDATION.md) for actual run results.

## GitHub Pages

Vite retains `base: '/dokkan-optimizer/'`. Navigation uses prefix-preserving query parameters for workbenches and exact catalog states, so no SPA fallback/404 rewrite is required. Check the catalog and both workbenches, assets, saved settings and mobile layouts at the production prefix.

The single [workflow](.github/workflows/pages.yml) validates every PR and every `main` push in one job: lockfile install, format check, unit tests, type check and production build, then the Playwright suite against that same `dist/`. Only that tested `dist/` can be uploaded, and the deploy job needs the validation job. Before publishing, the deploy job checks that its revision is still the head of `main`, so an older artifact is never published over a newer commit. Deployment is limited to pushes to `main` and manual runs of `main`, through the `github-pages` environment. Only the deploy job gets `pages: write` / `id-token: write`. See [deployment](docs/DEPLOYMENT.md) for the ordering rules. Feature PRs do not merge or deploy.

**Manual repository settings:** [Settings → Pages](https://github.com/josemose17-commits/dokkan-optimizer/settings/pages) → **Build and deployment → Source → GitHub Actions**. The workflow gates _publication_; blocking a failing PR from being _merged_ needs a branch rule (owner action): require the **Test and build (Node 24)** check on `main`. If repository policies restrict Actions or the deployment environment, allow the checked-in official actions and deployment from `main`. No new secret or setting is introduced by the character feature.

After an authorized merge, main's workflow may publish to `https://josemose17-commits.github.io/dokkan-optimizer/`. Check the actual deployment job/environment before claiming the site is live. A passing PR build does not establish deployment.
