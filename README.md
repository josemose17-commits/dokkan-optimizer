# Dokkan Team Lab

> **Synthetic demonstration — not real Dokkan recommendations.**
>
> Every bundled unit, category, link, effect, and rating is fictional. No real card stats or combat formulas are included. Rankings are transparent heuristics, not simulated win probabilities, damage, or survivability.

A browser-based TypeScript / React / Vite prototype with a UI-independent small-collection reference optimizer. There is no backend, account login, live database connection, or telemetry.

## Run locally

Use **Node.js 24+** and npm. From the repository directory:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`. If your sandbox does not allow network-interface discovery, use `npm run dev -- --host 127.0.0.1`.

```sh
npm test                 # engine/reference examples and local persistence tests
npm run test:watch       # watch mode
npm run typecheck       # strict TypeScript, no emit
npm run build           # type checking + production bundle in dist/
npm run preview         # serve the production bundle locally
```

## First run

1. The demo box starts with nine owned fixtures. Toggle ownership, search names/categories, own all, reset, or clear. Edits persist in this browser's local storage, using a validated versioned envelope. Storage failures and invalid saved data produce a visible warning. No collection data leaves the browser.
2. Choose an **owned leader** and a **friend leader**. The friend does not need to be owned. A friend matching an owned card still occupies a separate seventh slot.
3. Choose a synthetic exercise and set its context turn / HP. These are explicit condition inputs, not predictions of battle state. Set a candidate limit and generate teams.
4. Compare up to five ranked candidates. Inspect each leader's coverage independently, target rotations, reasons, unmet conditions, unsupported mechanics, weaknesses, eligible single swaps, and rejected-candidate diagnostics.

The two exercise presets intentionally change the weighting of arbitrary fixture ratings. For a simple coverage failure, keep Harbor Marshal as friend: Cinder Sprinter has Ember but neither Tide nor Vanguard. Its teams are rejected regardless of its pressure rating. Owning Unknown Sentinel demonstrates an unsupported entry rule that must fail closed.

## Eligibility before scoring

- A candidate contains exactly six **distinct owned instance IDs**, including the chosen leader, plus one independent friend participant. The current editor represents one instance per fixture card; it does not manage real card copies, levels, potential, or equipment.
- Every participant, **including the owned leader and friend**, must satisfy both leader rules independently. Failed or unsupported coverage rejects the candidate before rotation search/scoring. There is no partial-coverage mode in this prototype.
- Explicit unit eligibility rules and unsupported eligibility declarations are hard gates. Unknown rule kinds and unsupported branches in nested rules fail closed. For an `any` rule, an unsupported branch remains unsupported even if another branch is true; this is a conservative reference-model policy.
- Conditions support category membership, nested all/any, team-category counts, fixed-partner category, turn threshold, HP threshold, and an explicit unsupported rule. Team counts include self and friend. Fixed-partner effects are not assumed for floaters. Partner-dependent eligibility is unsupported before rotation evaluation and fails closed even in a nested rule.
- Unsupported scoring mechanics are reported and receive no assumed effect bonus. Unsupported link records receive no link credit. Warnings name the missing mechanics. Known base fixture ratings remain hand-authored inputs; they do not fill in the missing mechanics.

## Reference search and rotations

`generateCandidates` has no scoring dependency. It fixes the owned leader and enumerates combinations of five other owned instances in stable ID order. `evaluateCandidate` checks eligibility and evaluates each candidate independently. This separation is the seam for a future scalable search strategy.

For seven slots, the reference evaluator examines all **105** unordered layouts of two disjoint pairs plus three floaters: choose four fixed participants in 35 ways, then pair them in three ways. The friend participates in this enumeration just like any other slot. The layout with the highest combined synthetic score is selected; deterministic enumeration breaks layout ties. Target rotations are **not guaranteed opening rotations**. Opening order, rotation setup turns, and actual floater scheduling are not simulated.

The search accepts at most 30 owned instances, evaluates at most 2,000 combinations (UI default: 300), and returns at most 10 teams (UI: five). Limits apply to combinations **before** eligibility filtering. A small limit can therefore examine only rejected candidates. Results disclose possible/evaluated/eligible/rejected counts, the limit, and truncation. Top-N output does not itself truncate candidate evaluation.

If truncated, results are the **best among evaluated candidates only**; global optimality is not established. A complete search is exhaustive only under this synthetic model, fixed leader/friend/context, and catalog—not an optimal real Dokkan team. Total-score ties use sorted owned instance IDs. The engine runs synchronously after the UI paints its busy state; it is not suitable for a large real collection without a worker and a scalable search method.

## Transparent scoring

All four component scores are normalized to 0–100. Total is their weighted sum; values are rounded only for display.

| Component               | Weight | Exact demonstration assumption                                                                                                                                                                                                                                                             |
| ----------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Leader coverage         |    20% | Covered checks / 14 × 100. Every eligible candidate has 100, so these 20 points are constant. Coverage can never be outweighed by another component.                                                                                                                                       |
| Synthetic link affinity |    15% | Mean shared synthetic link weight of the two main pairs / total supported catalog link weight × 100. Shared IDs count once per pair; identical fixture-card pairs receive zero affinity by demo convention. Floaters receive no fixed-pair credit. Weights are not real link effects.      |
| Condition fulfillment   |    25% | Satisfied declared effects / all declared effects × 100; no effects yields 100. Unmet and unsupported effects receive zero credit. This measures declared-condition fulfillment, not raw power. It can favor units with fewer conditions.                                                  |
| Synthetic scenario fit  |    40% | For each slot, start with hand-authored pressure/sustain/utility ratings, add only satisfied supported fixture bonuses, then clamp each axis to 0–100. Take the scenario-weighted mean across axes, then the mean across seven participants. This is not a damage or survival calculation. |

Both presets use the same four component weights. Opening pressure uses axis weights **0.60 / 0.20 / 0.20**, turn 1, HP 100%; stability uses **0.15 / 0.55 / 0.30**, turn 5, HP 45%. Context controls can override turn/HP. Effects operate on one snapshot, without temporal transitions, stacking histories, probability, or enemies. Link affinity is only one component and must not be treated as total team strength.

The weights live in `src/engine/scoring.ts`. One-unit replacements are the top three already evaluated eligible teams that differ by one owned instance; leader and friend remain fixed. Each alternative has its own layout evaluation. Deltas show both total and component changes. A lower-scoring replacement offers an eligible alternative, not a claimed upgrade. Unexplored swaps are not inferred to be invalid.

## Data integrity and the real-data blocker

Read [the dated source assessment](docs/DATA_SOURCES.md) for access methods, published terms, prospective update strategies, and unresolved blockers. No import-ready real-data source was verified. Publicly visible data is not automatically reusable. Fandom text is a possible licensed source, but current access permission, attribution/share-alike handling, structured normalization, and mechanics verification still need work.

- `src/data/fixtures/` contains only clearly marked synthetic fixtures.
- `src/data/verified/` is intentionally empty except for admission requirements.
- Records have stable IDs, provenance, reuse information, review date, nullable verification date, awakening state where applicable, and supported/unsupported mechanic declarations.
- Synthetic verification dates are null. The current reference optimizer rejects `verified` records rather than pretending fixture scoring is a verified evaluator.
- No runtime scraping, third-party assets, undocumented API calls, or database import is implemented.

Unmodeled real mechanics include damage, defense/survivability, Ki, same-name restrictions and linking, exact leader boosts, opening randomness, transformations, domains, items, enemy actions, and real category/effect semantics. The demo convention for identical-card link affinity is not asserted to be a game rule.

## Structure

| Path                                        | Responsibility                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/domain/types.ts`                       | Records, rule language, provenance, requests, results                        |
| `src/engine/`                               | Pure generation, rules, eligibility, layouts, scoring, ranking, replacements |
| `src/engine/reference.test.ts`              | Independently enumerated candidates, arithmetic, and layout examples         |
| `src/data/fixtures/` / `src/data/verified/` | Isolated synthetic fixtures / future verified data                           |
| `src/storage/`                              | Validated versioned local persistence and failure handling                   |
| `src/components/`, `src/App.tsx`            | Collection editor, configuration, results and explanations                   |
| `docs/DATA_SOURCES.md`                      | Source research and real-data admission gate                                 |
| `AGENTS.md`                                 | Rules for future coding tasks                                                |

## Remaining work

Establish authorized data access and attribution, verify mechanics independently, add a real evaluation model, model supported encounter/turn behavior, expand collection state, and add a worker plus a scalable search method. Continue to disclose unsupported mechanics and search scope. This prototype does not establish real-world team quality.
