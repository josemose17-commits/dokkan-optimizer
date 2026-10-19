# Task checklist

Status on `claude/tender-maxwell-o43x7j`, 2026-10-19, branched from main `4dffb0c` (PRs #5–#11 merged). This batch reworks the default page into the Dokkan Potential Optimizer and adds the allocation/capability foundation.

## Primary product: Dokkan Potential Optimizer

- [x] One workflow, Character → Current build → Goal → Result, as a desktop workspace (Optimize and the result stay in view) and a single mobile flow. Product identity and navigation: Optimize · Characters · Tools; maintenance, source examples and the legacy demo moved to Tools with their routes and saves intact.
- [x] Capabilities resolved before any search: equipment per slot, full-allocation availability with the exact missing evidence, entered-value support and objective counts by status. No blocked mode is preselected; a single documented progression is a summary, not a selector.
- [x] Allocation module: attainable allocations (one option per unlocked choice node) combined with equipment in the existing search; proven on TEST ONLY graphs with hand-enumerated results.
- [x] User-entered current values (skill levels and stat additions), labeled once “Board requirements not checked.”, evaluated as entered and saved compatibly.
- [x] Kit mechanics declared per state (absent/present/unknown); unknown or unmodeled mechanics block the objectives they could change.
- [x] Model status instead of an acknowledgement step: Supported card stats, Experimental skill chances with their level-ordered ranking basis, damage and survival listed as unavailable. No preselected objective.
- [x] Current equips separate from candidate equipment; spare items in a collapsed editor; unavailable slots/items name their requirement.
- [x] Result leads with the answer: recommended/current best/ties/best found, baseline → recommendation with units, skill levels split into Hidden Potential / equipment / total, equipment, changes and a calculation-backed reason; details expandable.
- [x] Explicit revision-pinned potential-template mappings; aggregate profiles never claim graph coverage.
- [x] Lazy generation separate from evaluation/ranking; budgets on rejected scans and evaluations; cooperative enumeration and dominance; cancellation and stale-result protection.
- [x] Separate actual catalog/form/state/completeness/evaluator/template counts and unknown source total.
- [ ] Real complete board templates/progression configurations so the allocation engine searches real alternatives. Blocked on evidence: one owned card's board with route locks and readable choice dialogs, or a complete documented node table bound to a card/template.
- [ ] A meaningful supported objective beyond card stats (expected damage, survival): needs a verified damage/defense model. Until then, card stats are the only supported objectives and skill chances stay experimental.
- [ ] Character-specific mechanics (native critical/additional/evasion, attack-triggered, build-up, conditional, form changes) implemented one family at a time with evidence and independent expected values.
- [ ] Large-catalog search/render profiling and worker/scalable strategy before lifting current bounds.

## Catalog gate, independently tracked

- [x] Inspect actual small export/schema samples and relevant project license/provenance for two additional public datasets. No import against an imagined schema; no repeated blocked-provider review.
- [x] Document exact findings and external action once in [OPTIMIZER.md](OPTIMIZER.md#catalog-acquisition-gate).
- [x] Individually record one state from a permitted public page (robots.txt checked, one page, pinned retrieval date and page hash, field-level provenance): the pre-EZA base state of card 1003211. Single source, region unknown, no evaluator ([evidence](character-build/EVIDENCE.md)).
- [ ] Cross-checked individual records. On 2026-10-19 Fandom and DokkanStats answered automated retrieval with a Cloudflare challenge, leaving dokkan.fyi as the only reachable source. A second reachable source or dated in-game captures are needed before a record is called corroborated; the Super EZA state also needs raw stats and a step.
- [ ] Approved current text export/snapshot distribution path, representative import, reconciliation and reviewed updates preserving saved identities.

Current real coverage: **1 form / 0 established awakening relationships / 2 exact states (1 EZA, 1 base, 0 SEZA) / 0 complete-required detail records / 1 limited evaluator / 0 complete board templates**. Two incomplete records and one ambiguous form mapping are preserved; the total source catalog is unknown. No test fixture is counted as real coverage.

## Preserved infrastructure

- [x] Provider-independent normalized contract, session catalog inspection, search/filter/sort/paging and update compatibility reports.
- [x] Secondary definition forms, recorded/structured effects, explicit flat snapshot arithmetic, immutable revisions, imports/previews and storage conflict protection.
- [x] Exact-state evaluator registry and computed explanations; no fallback to another state/model.
- [x] Working/named-build library keys/revisions, safe import/export, future-schema/stale saves and cross-tab protection.
- [x] Synthetic team demo and exact warning, isolated ratings, engine and tests.
- [x] Node 24, lockfile, `/dokkan-optimizer/` base and browser-gated Pages workflow unchanged.

## Remaining quality and delivery work

- [ ] New capability families need independent expected values and separate game-evidence review. Arithmetic tests never confirm actual game behavior.
- [ ] Screen-reader, real Safari/iOS and physical-device checks; not yet performed. One local Firefox/WebKit run of the browser suite ([results](VALIDATION.md)) is not a CI project; Playwright's Linux WebKit crashes on pushState → reload → navigation independently of the app.
- [ ] Shareable validated build URL (exclude inventory by default), richer revision diffs and undo.
- [ ] Repository owner: require **Test and build (Node 24)** on main; Pages source must be **GitHub Actions**. Existing workflow gates publication, not merging. No new setting is needed for this branch.
- [ ] Collection-wide equipment allocation, respec/resource economics, investment priorities and full battle simulation are deferred.

See [implemented scope and reproduction](OPTIMIZER.md), [actual checks](VALIDATION.md) and the [evidence ledger](character-build/EVIDENCE.md).
