# Character definitions: first working slice

The default workbench is a local character-definition editor. It is independent of catalog acquisition and accepts any **user-authored** character. It does not add real characters to the bundled catalog. Existing catalog browsing, exact-state registry, result explanations, Goku saved builds and the synthetic team demo are preserved.

## Reproduce a comparison without writing JSON

1. Open `/dokkan-optimizer/`, click **New character**, and enter a name. For an **arithmetic example, not game data**, enter raw HP 100, ATK 200, DEF 300.
2. Click **Set no potential additions or skill levels (0)** in the current build. These are explicit custom assertions; blanks otherwise mean unknown.
3. **Add ability**, then **Add effect**. The flat-stat template targets self/ATK. Enter amount 20. Select **Numeric threshold** for its condition; the editable example requires HP ≥50%.
4. In **Explicit context**, enter current HP 60%. The condition is derived from this manually supplied snapshot, not simulated.
5. **Add equipment**, name it, set all bonuses to 0, then enter flat ATK +5. Set the current build's bronze availability to **Available (user asserted)** and select that item. Add any known restrictions: type, category, exact authored state, minimum route count or SA level. Unknown/unsupported requirements fail closed.
6. Duplicate the configuration, name it, and enter potential ATK +30. **Compare supported metrics** shows current pre-effect ATK 205 / modeled snapshot ATK 225 and alternative ATK 235 / 255. Modeled ATK delta is +30 (+13.33% relative to 225). This is addition, not outgoing damage.
7. Expand the trace and activation checks. Clear the HP context: the conditional ATK result becomes **Unavailable**, while the pre-effect subtotal stays available. Change HP to 49: the condition is unmet, so that effect is inactive.
8. **Save as new revision** persists a snapshot. Reload and open it from Your definitions. Export the saved library or draft; imports show additions, duplicates, conflicts and explicit new-ID mappings before writing anything.

The default library is empty. Test arithmetic characters are only in test files. **Start from an admitted catalog state** copies the original factual values/wording into a detached user record. It infers no structured effects, equipment, probability model or Hidden Potential graph. The original source references do not validate subsequent edits.

## Definitions, states and configurations

- A definition has a stable exact-state ID, card/form ID and immutable saved revisions. Separate EZA/SEZA definitions can share a card ID. **Duplicate as another state (same card)** supplies a new state ID; **Duplicate character** supplies new state and card IDs. Known awakening identities cannot be revised into a different awakening kind/step under one ID. Unknown identities may be clarified, with earlier revisions retained.
- Identity includes name/title, type, rarity, level/SA assumptions, awakening/step, region/version, form relationships and source notes. Links/categories distinguish unknown (`null`) from an explicitly entered empty list.
- Each revision keeps separate character data, multiple named custom configurations, equipment records and one explicit context. Changing a definition never edits an older revision's configurations.
- Abilities cover leader, passive, Super/Unit Super, active, standby, finish, transformation/exchange, domain, revival and Other. Preserve original wording alongside interpretation.
- Effects separately record recipient, family, amount/unit, condition, timing, duration/count, stacking, cap, reset, dependency IDs and source interpretation. UI templates cover stat changes, Ki, extra attacks/Supers, critical/evasion, guard/reduction, support/healing, statuses/debuffs, counters/nullification, guaranteed outcomes, foreseeing attacks, revival/form/orb changes, restrictions and Other. This is extensible coverage, not an exhaustive game model.
- Source labels are **user-entered** or **source-documented** (reference required). They are user assertions, not independent confirmation. Catalog-derived notes retain the original locator and revision binding.

There is no routine JSON editing requirement. The advanced JSON view is read-only. Imports/exports are versioned interchange/backup tools.

## Exactly what is calculated

`src/character-definitions/evaluation.ts` is pure and has no React, storage, network, catalog or Goku imports. It consumes the validated definition/configuration/context. The existing source-profile registry remains a separate, preserved evaluator path; neither path falls back to another character.

`manual-flat-snapshot-v1` defines this **authored arithmetic assumption**, not a source-verified Dokkan formula:

```text
pre-effect stat subtotal = raw + custom potential addition + compatible flat equip additions
modeled stat at snapshot = pre-effect subtotal + active supported flat self effects (once each)
```

All inputs/additions must be known and sums must stay nonnegative safe integers. Negative flat effects can be entered; a negative resulting stat or unsafe sum is unavailable, never silently clamped. A trace lists the exact contributions used. Other equipment mechanics are saveable as recorded wording; equipped builds with such records cannot claim a complete modeled snapshot.

The implemented effect is structured `flat-stat`, recipient self, a known stat/integer amount, flat units, snapshot duration, stacking once, no cap/reset/dependencies, and either snapshot timing or the explicitly selected matching phase. Other timing/history is unavailable. `snapshot` means “inspect this authored effect now,” not a game trigger claim.

Conditions use three-valued met/unmet/unknown logic with nested AND/OR. Supported manual comparisons include HP%, battle turn, appearance, slot/attack position, attack/received/Super/evasion counts, enemy count, Ki, collected orbs, exact form/state labels and matching ally counts. Team vs rotation and self-included vs other-ally counts are distinct inputs; they are not inferred from each other. Enemy characteristics, orb colors and other detailed conditions can be recorded as Other; they are not evaluated. No event history, turn progression, duration expiry or state changes are simulated.

Four separate statuses are displayed: **recorded**, **structured**, **calculation implemented**, **supported in this context**. Structured probability/percentage/guard/etc. records do not enable calculations. An unsupported or unknown active stat effect makes the affected modeled stat unavailable; an unstructured ability or Other effect conservatively affects all modeled stats. Pre-effect subtotals explicitly exclude abilities and do not claim overall performance. Known unmet activation conditions are traced as inactive.

Entered skill levels plus compatible equipment bonuses are totaled. **No authored-definition AA/Crit/evasion conversion, damage, battle-modifier formula, battle DEF, survival or clear-rate calculation exists.** The preserved source-profile comparison retains its source-model assumptions and existing tests; none become game validation for this editor.

## Comparison and scope

The user chooses subtotal metrics, not a universal strength score. Each row shows current-build absolute and relative differences; relative change from zero is unavailable. The existing probability formatter in source examples continues to distinguish percentage points from relative change. There are no probability metrics in this authored model.

Frontiers use one exact definition snapshot, one shared context and only selected metrics available for **every** compared configuration and baseline. Missing metrics are listed and cannot confer dominance. The current baseline remains in the pool even when comparison is truncated. Equivalent complete exposed evaluations retain their named configurations; distinct rows tied on selected metrics are preserved. Trace contributions follow the first listed configuration in an equivalence group; all input alternatives/differences remain visible.

There is **no allocation or equip generator** in this batch. It compares up to 30 explicitly entered configurations; limit controls disclose omitted configurations. This bound keeps the first slice small; it does not assert an exhaustive search or globally optimal result. Full board-validated allocation, collection-wide allocation and investment/resource-cost optimization remain deferred.

## Storage and safety

`dokkan.character-definitions.v1` is separate from `dokkan.character-builds.v1`, `dokkan.character-library.v1` and the legacy collection. No automatic migration or writes to those older formats occur. Copying a catalog state is explicit and detached. File exports include definition revisions, configurations, equipment, context and linked local definitions, so relationship references remain valid.

- Closed runtime schemas validate unknown input, IDs/references, effect shapes, numbers, enums, source references, dependency cycles, duplicate keys/IDs, form relations and version.
- Technical limits: 1 MiB combined library/file, 100 stored definition revisions, 30 configurations/revision, 60 equipment records, 60 abilities, 120 effects, 64 condition nodes/effect, depth 6. Other per-list/string bounds are in `validation.ts`. These protect the local editor; they are not game limits.
- Numeric stat additions/skill levels use nonnegative safe integers, without invented game-specific maxima. Counts/levels are whole numbers. HP% and recorded probabilities use 0–100; percentages may be fractional. Slots 1–3 and route counts 0–4 refer to existing slot/route identifiers; they do not validate node choices.
- Imports never execute scripts/templates or render HTML. Prototype/accessor/function values, unknown schema versions, excessive nesting and unknown fields are rejected. Source text is displayed as text.
- Import previews skip identical records. Conflicting state IDs either skip or copy under explicitly previewed new IDs; no existing revision is replaced. Relationship conflicts are reported, not rebound silently.
- Saving checks the previously read storage string, preventing silent replacement by another tab. Blocked or unreadable/newer storage remains protected. Recovery download is available. Editing/comparison/draft export work without storage. There is no automatic destructive recovery or history pruning.
- Draft cancellation/navigation warnings protect unsaved edits. Saves retain earlier revisions; there is no per-keystroke undo or cross-device sync.

## Follow-on batches

Add one documented, independently tested effect family at a time. Percentage stage/stacking/rounding rules, probabilities, active/standby/revival transitions and multi-turn history require their own mechanics gates. Add equipped-effect structure beyond flat/skill bonuses, richer context editors, revision diff tools, and performance measurements before expanding candidate generation. A verified graph can later provide a separate board-checked mode; it is not needed for this custom authoring path.

No provider request, credential, purchase, artwork, merge or deployment is part of this milestone.
