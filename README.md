# Dokkan Potential Optimizer

**Character kit → intended slot and role → potential emphasis → equip priorities → explanation.** One primary workspace, with factual browsing, saved builds and maintenance kept secondary.

The searchable catalog now includes a **historical UR/LR factual import**, alongside reviewed kit guidance, explicit versioned event mechanics and the preserved limited Goku comparison. It is not a complete current roster or full potential-allocation optimizer.

- **Catalog:** 792 source identities (679 UR, 113 LR) from MNprojects/DokkanAPI’s published January 2023 JSON, plus 3 separately reviewed identities. Combined: **795 catalog identities / 1,110 recorded states**. Source aliases are not guessed into the reviewed IDs; matching names may appear separately.
- **Hidden Potential details:** source-reported base/max/free-dupe/rainbow stat columns are visible with field references. The export does not establish every duplicate percentage, intermediate profile, choice node or route. These remain unknown, not interpolated. No new character receives numerical optimization support from inclusion in the catalog.
- **Evidence and reuse:** factual projection only, under the published repository AGPL-3.0 notice; credit MNprojects/Michael Nash and upstream Wiki contributors. No artwork or copied skill descriptions. See the [dataset notice and license](src/data/real/mnprojects/NOTICE.md), [provenance/reconciliation manifest](src/data/real/mnprojects/manifest.json), and [catalog/update guide](docs/CATALOG.md).

Existing supported features remain:

- **TEQ UR EZA Gohan (Teen), “Power Beyond the Extremes”, untransformed, Lv140 / SA15.** Intended slot 1, main rotation, defensive buildup; Additional-led priorities from guard before attacking and lasting Super DEF effects. This is a documented design judgment, not a numerical damage/survival optimum. An opening-protection override explains the different tradeoff. Region and numeric EZA step are unestablished, not guessed.
- **Cannot recommend exact levels or items yet:** no complete attainable allocation set is bound to this state/progression, compatible items are not admitted, and attack-chain/guard-trigger interactions remain unresolved. No baseline improvement is claimed for Gohan. There are **0 complete real board templates** and **0 new exact allocation winners**.
- **Existing Goku comparison retained:** AGL UR EZA Super Saiyan 3 Goku, Global English, step 7, Lv140 / SA15. One fixed 55% no-duplicate profile (AA5), or entered current totals whose board requirements are not checked, combined with 3 bronze and 3 unresolved silver records. Card stat objectives and experimental initial-check probabilities remain separate from damage/survival. This is a limited progression-profile/equipment comparison.
- **Versioned event mechanics:** native/dependent attacks, native critical/evasion, all-type-effectiveness properties, 12/18-Ki and initial/additional Super filters, timed/permanent ATK/DEF effect factors, branch-local conditions, buildup, expiration and terminal branches. These are declared model implementations, not verified damage/survival mechanics. [Exact coverage and limits](docs/CHARACTER_MECHANICS.md).
- **AGL LR EZA Ultra Instinct Goku, Lv150 / SA25:** exact-state kit guidance plus native-only entry-evasion and Super-count previews (one initial Super plus a 77% native opportunity gives 1.77 expected Supers). Unknown additional-Super variant, repeated critical overlap, later evasion and revival semantics remain gated; no board/equipment recommendation is admitted.
- **Optimization coverage:** 1 exact state with its original evaluator plus an opt-in event evaluator, 2 reviewed kit-guidance states, 0 complete real allocation templates. Historical imports have partial details and no evaluator. No verified-only equipment mode exists; unresolved silver items remain labeled. Test fixtures do not ship as characters.

The synthetic team demo and duplicate source-example screen have been retired. Old URLs return intentionally to the workspace. Old browser storage is **not deleted or migrated**. Git history preserves the demo.

See the [reviewed policy and evidence boundary](docs/KIT_GUIDANCE.md), [workspace architecture](docs/OPTIMIZER.md), and [field-level evidence](docs/character-build/EVIDENCE.md). Source documentation, agreement between websites, and passing mathematical/policy tests are distinct; **no independent in-game confirmation is recorded**.

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

## Reproduce kit guidance

1. Open `/dokkan-optimizer/` and choose **Gohan (Teen) · … · Kit guidance**.
2. Read **Designed for**: slot 1, main rotation, defender; supporting effects are expandable.
3. Read **Preferred potential emphasis** and **Equip effect priorities**. No arbitrary AA/Critical/Evasion totals or item recommendations are supplied.
4. Open **Advanced priority override**, choose protection before the first Super, and inspect why Additional cannot improve the earlier window. Disable evasion to see the explicit context constraint.
5. Open **Missing exact-build evidence** or **Kit facts, sources and support limits** for the field-level boundary.

Default scope: untransformed early buildup, before attacking on battle turn 3 / second appearance, with a qualifying Super; no incoming damage or attack counter is assumed. The entry-turn reduction is recorded but not applied to that context. No transformation, attack-chain, battle DEF, damage, survival, cost or affordability calculation is offered.

## Explicit event contexts

Choose the documented SS3 Goku state, then **Goal → Evaluation model → Explicit event sequence v1**. Select a supplied one/two-appearance sequence and a count objective before Optimize. The same baseline, eligibility, inventory, ties, cancellation and incomplete-search handling apply. Open **Event timing and branches** for activation, completed counters, effect factors and model assumptions. Old initial-check settings remain the default.

Choose the exact Ultra Instinct Goku EZA state and open **Character event mechanics** for the bounded native-only contexts. Their potential/equipment inputs are explicitly excluded; they are not build recommendations. Gohan’s event record shows which selected effects have implementations and why numerical objectives remain blocked. No paused provider or separate prototype is used.

## Retained Goku comparisons and saves

Choose the Goku quick pick. Its heading says **Limited progression-profile / equipment comparison**. Choose an objective before **Optimize**. From empty equipment, Critical chance under catalog mode has four ties at 4% in the experimental model (baseline 0%). Card HP has four ties at 15,827 (baseline 15,327), not a defensive-build recommendation. One documented allocation × 16 equipment combinations is not full potential optimization.

**Saved builds · save, load or export** opens the compact library. Existing working settings are read, never autosaved over; named saves are explicit. Older source-example exports load in this same workspace, including optional entered totals. Unknown/stale revisions remain identifiable and cannot be silently substituted. Imports are bounded, validated and previewed; conflicting writes from another tab are refused. Unreadable copies remain downloadable. Resetting working inputs does not delete saves.

Storage contracts remain `dokkan.character-builds.v1` (Goku working copy), `dokkan.character-library.v1` (named builds), and `dokkan.character-definitions.v1` (maintenance). Obsolete `dokkan-team-lab.collection.v1` is ignored and retained. No personal data is committed or sent to a service.

**Search characters and inspect details** integrates the existing search, exact-state details, stat layers, completeness, references and session-only normalized import. **Menu** holds maintenance/import and sources. Descriptive records do not acquire executable support by being imported. Raw stats, potential additions, flat equips and unknown battle stats remain separate.

## Browse the UR/LR catalog

1. Open **Search characters and inspect details** (`/dokkan-optimizer/?workbench=catalog`). Search by name/ID, type, rarity, category or awakening state. Results are paginated in groups of 50.
2. Search `Broly Cheelai`, filter **LR / PHY / Joined Forces**, and select the base state. Inspect raw stats, separate historical stat columns, unknown potential percentages, field references and unavailable optimization support.
3. Search `mnprojects:card:11168` and select **EZA**. Unknown level/SA/raw-stat scope stays unavailable; no SEZA state is invented. Reviewed Goku/Gohan quick picks retain their original IDs and behavior.

The import reconciles **796 rows**: **793 accepted**, **3 excluded** (two conflicting-ID rows and one Zeni material). One duplicate identity shares two reported tables. **125 embedded forms** lack complete mappings and are reported without counting them as additional characters. Imported states: **792 base + 314 EZA = 1,106**, with no SEZA. Combined states: **793 base + 317 EZA = 1,110**. These are catalog entries, not a count of unique current-game cards, fully completed records or all awakening forms.

The source’s EZA descriptions establish a revision exists, not its exact level/step or stat scope. Source-reported total columns never become raw stats, potential additions or battle stats by inference. Copied effects with missing icons/footnotes are omitted. Source documentation is not independent in-game confirmation. The production bundle includes a license download and visible attribution; it makes no API call.

## Data and remaining gates

The pinned MNprojects JSON supplies the historical catalog through a separate build-time adapter. No live service, subscription or account is required. Updates require a reviewed new pin, reconciliation and saved-ID compatibility checks; see [catalog commands](docs/CATALOG.md).

A fresh Dokkan Info bulk acquisition remains paused. The precise external requirement is a **provider-approved text export with schema/revision and terms for build-time caching, public GitHub/Pages distribution and updates**. No approved sample has been supplied. No provider was contacted, no credentials/purchase requested and no Dokkan Info bulk extraction, artwork or calculator implementation copied.

Individual Gohan facts are manually paraphrased from public readable references; no dataset license or bulk permission is implied. Direct host HTML/robots requests returned 403, so no raw-page hash is claimed or access control bypassed. All independent-confirmation fields are null. See [access notes](docs/character-build/DATA_ACCESS.md).

Future work: establish one complete attainable set/card mapping and progression prerequisites, admit compatible equipment with resolved restrictions, and verify any attack/check/event rules needed for numerical objectives. A current comprehensive roster still requires a fresh permitted export; it is independent of allocation-engine work. Collection-wide equip allocation, resource optimization and full battle simulation remain deferred.

## GitHub Pages

Vite retains `base: '/dokkan-optimizer/'`. Navigation uses prefix-preserving query parameters for workbenches and exact catalog states, so no SPA fallback/404 rewrite is required. Check the catalog and both workbenches, assets, saved settings and mobile layouts at the production prefix.

The single [workflow](.github/workflows/pages.yml) validates every PR and every `main` push in one job: lockfile install, format check, unit tests, type check and production build, then the Playwright suite against that same `dist/`. Only that tested `dist/` can be uploaded, and the deploy job needs the validation job. Before publishing, the deploy job checks that its revision is still the head of `main`, so an older artifact is never published over a newer commit. Deployment is limited to pushes to `main` and manual runs of `main`, through the `github-pages` environment. Only the deploy job gets `pages: write` / `id-token: write`. See [deployment](docs/DEPLOYMENT.md) for the ordering rules. Feature PRs do not merge or deploy.

**Manual repository settings:** [Settings → Pages](https://github.com/josemose17-commits/dokkan-optimizer/settings/pages) → **Build and deployment → Source → GitHub Actions**. The workflow gates _publication_; blocking a failing PR from being _merged_ needs a branch rule (owner action): require the **Test and build (Node 24)** check on `main`. If repository policies restrict Actions or the deployment environment, allow the checked-in official actions and deployment from `main`. No new secret or setting is introduced by the character feature.

After an authorized merge, main's workflow may publish to `https://josemose17-commits.github.io/dokkan-optimizer/`. Check the actual deployment job/environment before claiming the site is live. A passing PR build does not establish deployment.
