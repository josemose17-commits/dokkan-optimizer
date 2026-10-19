# Dokkan Character Builds

The primary page is a **limited real-data character workbench** for **[Mystery Super Technique] Super Saiyan 3 Goku — Super AGL, Global English, fully EZA step 7, Lv.140 / SA15, without Super EZA**. It compares a small skill-orb catalog against a current build, using card stats and initial Hidden Potential probabilities. It has no damage objective or universal score.

**Source-documented model; no independent in-game verification recorded.** Source documentation, independent confirmation of game behavior, and passing mathematical tests are separate. All current field-level independent-verification dates are null. See the [evidence ledger](docs/character-build/EVIDENCE.md).

The full legal choice-node graph could not be verified. The released progression is therefore fixed to **55%, all no-duplicate base-board nodes filled, zero duplicate routes**. This has native AA5 and no selectable AA/critical/evasion nodes. Full Hidden Potential respec is deferred; arbitrary level triples are never offered. This useful subset compares equipment, not optimal damage builds.

The preserved team prototype is at **`/dokkan-optimizer/?workbench=legacy-team`**, labeled **“Synthetic demonstration — not real Dokkan recommendations.”** Its units, effects and scores remain fictional and isolated. See [legacy documentation](docs/LEGACY_TEAM_DEMO.md).

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
```

Production preview: `http://127.0.0.1:4173/dokkan-optimizer/`. The project uses React, TypeScript, Vite and Vitest. No backend, telemetry, game-account connection, runtime scraper or external asset requests are needed.

## Reproduce the first-unit comparison

1. Open the primary URL. Confirm that your intended comparison is the exact **EZA, not SEZA**, Lv.140/SA15 **55% no-dupe** profile. Other states are not supported. The Hidden Potential system must already be unlocked and the base board filled; this app does not assess unlock affordability.
2. Leave both current slots **Empty** for the reference baseline, or select your actual matching equips. Gold is locked. An item absent from this catalog cannot be approximated by another item.
3. Select **Ownership ignored within this catalog**. This is hypothetical access to the six listed items, not a claim that you own them or that every game equip is considered. For inventory mode, enter **unequipped** quantities; current attached items remain available to retain.
4. Use **Evasion allowed**, **Initial extra Super** as the objective, all six frontier metrics, and a candidate limit of at least **16**. Click **Compare legal builds**. Turn 1, first appearance, initial Super available and no external effects are fixed.
5. Expect **16 legal targets / 16 distinct evaluations**. The unequipped baseline is HP **15,327**, ATK **13,911**, DEF **8,596**; initial AA trigger **10%**, initial-check extra Super **5%**, critical/evasion **0%**.
6. Silver AA+2 produces an initial AA trigger **14%**, initial-check extra Super **7%**. Silver critical+2 gives **4%** critical chance; silver evasion+2 gives **2%** per eligible incoming attack. Bronze ATK/DEF/HP +500 changes only its corresponding card stat. For example, ATK becomes **14,411**. These are source-model outputs, not independently measured combat results.
7. Four targets tie for first place on the initial extra-Super objective. Nine evaluations form the frontier when all six metrics are selected. Open row details for every equivalent legal equip option and its current-to-target changes. Deltas use the current baseline; probability deltas are percentage points.
8. Change to **Evasion disabled** and compare again: 16 targets collapse to **12 distinct evaluations**, retaining all 16 alternatives. Empty silver and evasion silver can be equivalent for the exposed metrics in this context. No current choice or alternative is discarded.

With inventory mode and zero unequipped/current items, only the empty target is available. Counts never imply ownership. Legal target changes may consume resources or destroy/replace equipment; replacement economics and respec affordability are deferred. No action changes the game.

## Metrics and comparisons

- **Card HP/ATK/DEF:** card base + the fixed +2800 potential bonus + flat equips. They exclude leader, passive, link, support, Ki and Super Attack combat multipliers. Card ATK is not damage; card DEF is not survivability.
- **Initial AA check:** trigger `0.02 × total AA`; trigger followed by a Super `0.02 × total AA × 0.5`. This is the initial eligible attack's check, not the full-turn probability of another Super or a modeled attack chain.
- **Critical/evasion:** `0.02 × critical level` per eligible attack and `0.01 × evasion level` per eligible incoming attack, with no native/external chance effects. An evasion-disabled context explicitly assumes 0. No named boss is inferred.
- **Damage and battle DEF:** unavailable/null with explanations, never zero or replaced by a fixture rating. The objective selector offers supported metrics only.
- Ranking sorts the selected metric and preserves ties. The frontier uses the same context and the common available selected metrics: no worse on all, better on at least one. Unknown metrics are omitted explicitly, never filled with zeros. There are no universal weights.
- Equivalent exposed evaluations are grouped with **all** legal allocation/equip alternatives retained. Equivalence is limited to the modeled metrics and does not mean equal costs. Inventory quantities and current attached items are checked before evaluation.
- Search generation is independent of evaluation. Counts, limits and truncation are reported. If truncated, total legal count is unknown and ranks/frontier apply only to evaluated targets. No global optimum is claimed.

## Evidence, data path and remaining gates

Read [field evidence](docs/character-build/EVIDENCE.md), [current access/reuse assessment](docs/character-build/DATA_ACCESS.md), and [the original source review](docs/DATA_SOURCES.md). Access restrictions, copied expressive content, compiled-dataset rights and independently recorded individual numbers are assessed separately. Missing bulk permission is not automatically a ban on recording facts. No blanket legal or data-reuse permission is claimed.

`src/data/real/character-build/goku.ts` contains one manually normalized card profile and six numeric orb records with stable internal IDs. Source game item IDs are unknown and remain null. Source confidence and retrieval limitations, including indexed silver item labels, are visible. No artwork, long card descriptions, compiled third-party dataset, source calculator code or internal endpoint response is bundled.

Remaining gates: exact Goku node options/prerequisites; independent card/orb/probability confirmation; direct current confirmation of generic silver restrictions/IDs; attack-chain behavior; outgoing damage stages and rounding; passive expiry and battle stats. Broader or paid dataset integration requires a separately established access/reuse path. Updates are manual, versioned and reviewed; there is no live updater.

Deferred: complex kits, stacking/transformations, collection-wide equipment allocation, investment priorities, resource-cost optimization, full battle simulation, clear probabilities and survival estimates.

## Code and persistence

| Path                                                 | Responsibility                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/character-build/domain.ts`                      | Separate real-card/evidence/build/context/metric contracts                             |
| `src/character-build/legality.ts`, `generation.ts`   | Fail-closed restrictions, node prerequisites, inventory and lazy legal generation      |
| `src/character-build/evaluation.ts`, `comparison.ts` | Card stats, supported probabilities, baselines, equivalence, ranks and Pareto frontier |
| `src/character-build/engine.test.ts`                 | Independent arithmetic, enumeration, eligibility and comparison oracles                |
| `src/character-build/storage.ts`, `storage.test.ts`  | Validated versioned character state; catalog-revision checks and visible failures      |
| `src/character-build/CharacterWorkbench.tsx`         | Primary inputs/results/evidence UI                                                     |
| `src/Workbench.tsx`                                  | Primary/legacy navigation without server routing                                       |
| `src/data/real/`                                     | Source-documented real facts, separate from fictional fixtures                         |
| `src/App.tsx`, `src/engine/`, `src/data/fixtures/`   | Preserved legacy team prototype and tests                                              |
| `AGENTS.md`                                          | Rules for future tasks and evidence admission                                          |

Character settings use `dokkan.character-builds.v1`. The legacy collection retains `dokkan-team-lab.collection.v1`. Both are local to the browser origin. Invalid/newer schemas, changed catalog revisions, blocked storage and quota errors are surfaced. Reading an invalid character save does not overwrite it until an edit. No saved user state is committed or sent anywhere.

Tests using abstract graphs and invented branch-damage values are **mathematical tests, not combat verification or fictional product data**. Existing legacy tests remain unchanged. See [validation](docs/VALIDATION.md) for actual run results.

## GitHub Pages

Vite retains `base: '/dokkan-optimizer/'`. Navigation uses the same prefix and a query parameter for the legacy page, so no SPA fallback/404 rewrite is required. Check both workbenches, asset requests, settings reload and mobile table scrolling at the production prefix.

The existing [workflow](.github/workflows/pages.yml) uses Node 24, `npm ci`, `npm test` and `npm run build` (including type checking). PRs to main validate only. Deployment is guarded to pushes to `main` or manual runs of `main`, with the `github-pages` environment and deployment-only `pages: write` / `id-token: write` permissions. This feature PR does not merge or deploy.

**Manual repository setting:** [Settings → Pages](https://github.com/josemose17-commits/dokkan-optimizer/settings/pages) → **Build and deployment → Source → GitHub Actions**. If repository policies restrict Actions or the deployment environment, allow the checked-in official actions and deployment from `main`. No new secret or setting is introduced by the character feature.

After an authorized merge, main's workflow may publish to `https://josemose17-commits.github.io/dokkan-optimizer/`. Check the actual deployment job/environment before claiming the site is live. A passing PR build does not establish deployment.
