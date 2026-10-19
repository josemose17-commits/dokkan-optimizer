# Dokkan Potential Optimizer

Choose a Dokkan character, describe the build it has now and pick a goal. The optimizer searches the Hidden Potential allocations and equipment it can verify for that exact character state, then shows what to change, by how much, and why. The default page follows one workflow: **Character → Current build → Goal → Result**. Main navigation is **Optimize · Characters · Tools**; character maintenance, the source build examples and the legacy synthetic team demo live under Tools.

**What it can do today, bluntly:**

- **One optimizable state:** [Mystery Super Technique] Super Saiyan 3 Goku — Super AGL, Global English, fully EZA step 7, Lv.140 / SA15, without Super EZA. The catalog also holds the same card's pre-EZA base state (Lv.120 / SA10, single source, region unknown); it has no evaluator and is explained as **Not supported yet**, never given another state's evaluator.
- **Allocation:** the documented profile for this state is one fixed allocation (55%, base board filled, no duplicate routes, Additional Attack 5). **Full allocation support is not available for any character yet**: no complete, evidence-backed choice-node list exists for a real card. The page says so before any search, with the exact missing evidence. Users can instead enter **their own current values** (skill levels and stat additions), labeled once _Board requirements not checked_; these are compared as entered, not proven attainable.
- **Equipment:** 3 bronze and 3 silver items are recorded; no gold item. Candidates come from **Use my equipment** (spare copies) or **Best available in catalog** (ownership ignored, needs listed).
- **Objectives:** card ATK/DEF/HP are **Supported** (documented stat additions, not damage or survival). Initial extra Super, critical and evasion chances are **Experimental** source-model comparisons: their order depends only on total skill levels, so any convention where the chance rises with level gives the same winner, but the percentages use a model whose conventions are unresolved. **Expected damage and damage taken/survival are not available** and cannot be selected.
- **Allocation engine:** the search combines every attainable allocation (one option per unlocked choice node of a documented template) with every eligible equipment combination. This is proven on TEST ONLY choice graphs with hand-enumerated expected results; it is idle for real characters until a real template is admitted.

Bundled coverage: **1 unique card form, 0 established awakening relationships, 2 exact states (1 EZA, 1 base, 0 SEZA), 0 records with all required detail fields, 1 limited evaluator state and 0 complete board templates**. The source catalog total is unknown. See [scope, architecture, acquisition findings and reproduction](docs/OPTIMIZER.md).

No new dataset was imported. Dokkan Info remains preferred but its bulk acquisition is paused; the [precise acquisition gate](docs/OPTIMIZER.md#catalog-acquisition-gate) is documented once. No provider contact, token, purchase, undocumented endpoint, artwork, calculator code or copied bulk database is involved.

**Source-documented model; no independent in-game verification recorded.** Passing schema/math tests is not game confirmation; all current independent-verification dates remain null. Kit mechanics that are unknown, or present but not modeled, block the objectives they could change. [Evidence ledger](docs/character-build/EVIDENCE.md).

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

## Reproduce the optimizer workflow

1. Open `/dokkan-optimizer/`. Choose **Super Saiyan 3 Goku · AGL UR · EZA step 7 · Lv.140 / SA15 · Global English** (quick pick or selector).
2. Before any search, the support summary shows 3 bronze · 3 silver · gold none recorded, **Full allocation support not available for this character yet.** (expand for the missing evidence), entered values available, and 3 supported · 3 experimental objectives.
3. **Current build:** the documented profile is a summary (no selector). Set **Silver** to _Evasion +2 · silver_. Current totals show skill levels split into Hidden Potential, equipment and total.
4. **Goal:** choose **Use my equipment**, open **Edit spare items** and enter **1** spare _Critical Hit +2 · silver_. Choose **Critical chance** (Experimental). No objective is preselected.
5. **Optimize.** Result: **Recommended build.** Critical chance **0.0% → 4.0% (+4.0 percentage points)**; change **Silver: Evasion +2 · silver → Critical Hit +2 · silver**; Why: _Critical Hit: 0 from Hidden Potential + 2 from equipment = 2 levels_ and _Critical chance = 2 (Critical Hit levels) × 2.0% (chance per level) = 4.0%_. Ties, tradeoffs, formula trace, assumptions and search completeness are expandable.
6. **Best available in catalog** with **Card HP** from an empty build: **Multiple builds tie.** 15,327 → 15,827 (+500) with bronze AGL HP +500; four configurations tie and the one shown needs the fewest changes. With that item already equipped: **Your current build is already best for Card HP.**
7. **My current values:** enter Critical Hit **3** and optimize Critical chance: **6.0% → 10.0%** with the silver Critical Hit item. Out-of-range values are reported on their field and block the search.
8. Advanced: set **Maximum combinations checked** to 1 to see **Best found.** with the incomplete-search note.
9. Save the settings under a name, reload and **Load** them: the exact state and inputs return. Builds with entered values open only in the optimizer; the source example names why it cannot show them.

Changes may cost resources; affordability and respec costs are not modeled. The **Source build examples** tool (`?workbench=character-build&state=global-en%3A1003211%3Aeza-7%3Alv140%3Asa15`) keeps its detailed comparator and original settings behavior. The catalog's **Optimize this character** link opens the optimizer on the same state. Maintenance supports custom authored comparisons, explicitly without a board-compatibility claim ([instructions](docs/CHARACTER_DEFINITIONS.md)).

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

| Path                                                          | Responsibility                                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/potential/`                                              | The optimizer workflow UI, capabilities, template mappings, gates, outcomes, coverage  |
| `src/character-build/allocation.ts`                           | Attainable allocations, user-entered values and potential contributions by source      |
| `src/character-build/search.ts`                               | Cooperative bounded enumeration and dominance checks, progress/cancellation            |
| `src/character-data/`                                         | Normalized contract, validation, search, identity, stat layers and update assessment   |
| `src/characters/CatalogBrowser.tsx`                           | Secondary catalog search/details, completeness, evidence and saved-build identity      |
| `src/data/real/catalog.ts`                                    | Migration of the existing admitted Goku record; no provider acquisition                |
| `scripts/catalog.mjs`                                         | Local normalized JSON export/validation and compatibility report                       |
| `src/character-build/domain.ts`                               | Separate real-card/evidence/build/context/metric contracts                             |
| `src/character-build/legality.ts`, `generation.ts`            | Fail-closed restrictions, node prerequisites, inventory and lazy legal generation      |
| `src/character-build/evaluation.ts`, `comparison.ts`          | Card stats, supported probabilities, baselines, equivalence, ranks and Pareto frontier |
| `src/character-build/engine.test.ts`                          | Independent arithmetic, enumeration, eligibility and comparison oracles                |
| `src/character-build/storage.ts`, `storage.test.ts`           | Validated versioned character state; catalog-revision checks and visible failures      |
| `src/character-build/CharacterWorkbench.tsx`                  | Generic per-entry workbench: inputs, results, row summaries, evidence                  |
| `src/character-build/registry.ts`                             | Pure evaluator resolution by exact state ID; registry consistency; no fallback         |
| `src/data/real/character-build/registry.ts`                   | Production registry (one Goku entry); fixtures live only in tests                      |
| `src/character-build/explanation.ts`, `ResultExplanation.tsx` | Explanations computed from the calculation trace and comparison result                 |
| `src/character-build/BuildOptimizerPage.tsx`                  | State picker, exact refusal reasons, per-state workbench and cross-state loads         |
| `src/character-build/library.ts`, `SavedBuilds.tsx`           | Saved-build records, strict parsing, export/import, merge rules and their UI           |
| `src/character-build/format.ts`                               | Metric and delta presentation (pp, relative change, zero baseline)                     |
| `src/characters/LocalCatalogImport.tsx`                       | Session-only inspection of a user-supplied normalized catalog file                     |
| `e2e/`, `playwright.config.ts`                                | Checked-in browser suite against the production build                                  |
| `src/Workbench.tsx`, `src/ToolsPage.tsx`                      | Optimize · Characters · Tools navigation without server routing                        |
| `src/data/real/`                                              | Source-documented real facts, separate from fictional fixtures                         |
| `src/App.tsx`, `src/engine/`, `src/data/fixtures/`            | Preserved legacy team prototype and tests                                              |
| `AGENTS.md`                                                   | Rules for future tasks and evidence admission                                          |

Character settings use `dokkan.character-builds.v1` for the Goku entry (contract unchanged); any future entry gets `dokkan.character-builds.v1:<entry id>`. Named saved builds use the separate `dokkan.character-library.v1`. The legacy collection retains `dokkan-team-lab.collection.v1`. Both are local to the browser origin. Invalid/newer schemas, changed catalog revisions, blocked storage and quota errors are surfaced. Reading an invalid character save does not overwrite it until an edit. No saved user state is committed or sent anywhere.

Tests using abstract graphs and invented branch-damage values are **mathematical tests, not combat verification or fictional product data**. Existing legacy tests remain unchanged. See [validation](docs/VALIDATION.md) for actual run results.

## GitHub Pages

Vite retains `base: '/dokkan-optimizer/'`. Navigation uses prefix-preserving query parameters for workbenches and exact catalog states, so no SPA fallback/404 rewrite is required. Check the catalog and both workbenches, assets, saved settings and mobile layouts at the production prefix.

The single [workflow](.github/workflows/pages.yml) validates every PR and every `main` push in one job: lockfile install, format check, unit tests, type check and production build, then the Playwright suite against that same `dist/`. Only that tested `dist/` can be uploaded, and the deploy job needs the validation job. Before publishing, the deploy job checks that its revision is still the head of `main`, so an older artifact is never published over a newer commit. Deployment is limited to pushes to `main` and manual runs of `main`, through the `github-pages` environment. Only the deploy job gets `pages: write` / `id-token: write`. See [deployment](docs/DEPLOYMENT.md) for the ordering rules. Feature PRs do not merge or deploy.

**Manual repository settings:** [Settings → Pages](https://github.com/josemose17-commits/dokkan-optimizer/settings/pages) → **Build and deployment → Source → GitHub Actions**. The workflow gates _publication_; blocking a failing PR from being _merged_ needs a branch rule (owner action): require the **Test and build (Node 24)** check on `main`. If repository policies restrict Actions or the deployment environment, allow the checked-in official actions and deployment from `main`. No new secret or setting is introduced by the character feature.

After an authorized merge, main's workflow may publish to `https://josemose17-commits.github.io/dokkan-optimizer/`. Check the actual deployment job/environment before claiming the site is live. A passing PR build does not establish deployment.
