# Character event mechanics

Implemented on `feature/character-build-mechanics`. This extends the actual
kit-first workspace and pure evaluation/search pipeline. It does not complete
attainable-allocation optimization or introduce a damage/survival proxy.

## Contracts and compatibility

`src/character-build/mechanics/` defines **event-sequence schema version 1**.
An entry's optional `sequence` extension binds its model to the exact card,
state and original build-data revision. `execution.ts` selects the registered
implementation from the request context; a missing event binding never falls
back to the initial-check implementation. The original Goku entry ID,
`goku-initial-check-v1`, its model revision, default request, working-settings
key and original six objectives are unchanged.

The new opt-in saved context has exactly four fields:

```json
{
  "id": "event-sequence-v1",
  "modelRevision": "goku-eza-sequence-2026-10-20.1",
  "scenarioId": "goku-sequence:first-appearance",
  "evasionAllowed": true
}
```

Old request/context objects keep their exact shape. Imports reject extra
fields, future contexts and malformed revisions. An unavailable saved event
revision stays identifiable as stale. No autosave, key deletion or migration
is introduced. Definition libraries retain their schema; the phase vocabulary
is extended to record explicit events, while their existing flat-snapshot
evaluator does not acquire event simulation automatically.

## Execution and arithmetic boundary

| Event/model feature               | Implemented behavior                                                                                                                                                            | Important boundary                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Appearance/start of turn          | Trigger admitted effects and inspect supplied conditions                                                                                                                        | No previous buffs, hits or revivals inferred from an appearance number                                         |
| Before attack / attack activation | Activate only applicable conditions and source/kind filters                                                                                                                     | Completed attack counters do not advance early                                                                 |
| Super activation                  | Apply the bound 12-Ki, 18-Ki or initial/additional-specific effects                                                                                                             | An unknown additional-Super variant remains `unspecified-super`, with unknown Ki; it is not changed to 12-Ki   |
| Damage calculation                | Capture established effect factors and attack properties                                                                                                                        | No outgoing/incoming damage formula, critical damage multiplier or type multiplier                             |
| After attack                      | Increment completed attack/Super counts and then inspect dependent rules                                                                                                        | Parent activations and counters remain local to each probability branch                                        |
| Native additional attacks         | Bounded activation/conversion rolls, dependent releases and explicit per-turn attempt limits                                                                                    | A failed once-per-turn roll cannot retry indefinitely; unresolved real mappings block affected objectives      |
| Hidden Potential additional       | Under the separately declared convention, each completed non-potential attack contributes an independent trial; at most one potential attack is released after the native queue | Mathematical model convention, not independent game confirmation; no extra potential trial from its own attack |
| Critical / evasion                | Explicit independent, additive or maximum overlap; native guarantees stay at 100%; evasion can be disabled                                                                      | No implicit probability clamp or assumed overlap convention                                                    |
| All-type effectiveness            | Track an active attack property separately from criticals                                                                                                                       | Never multiply the two into a damage index                                                                     |
| Received/evaded incoming attacks  | Resolve branch-local events, counters, guarded-hit dependencies and supplied HP changes                                                                                         | Incoming damage is an input, not a function of card DEF                                                        |
| Death / enemy defeat              | Stop later actions and clear pending attacks for terminal branches                                                                                                              | No revival, resurrection or subsequent combat inferred                                                         |
| Temporary/permanent raises        | ATK/DEF percentage groups, explicit additive/multiplicative stacking, additive caps and individual expirations                                                                  | Factors are declared effect algebra, not battle stats or a verified Dokkan stage formula                       |
| Later turns/appearances           | Expire buffs before later actions; distinguish elapsed turns from appearances                                                                                                   | A three-turn buff includes its activation turn; off-rotation turns do not invent new appearances               |

Unknown activation, essential dependencies, resolved death outcomes and
overlap rules make the affected result unavailable. A hit invalidates a stale
HP percentage unless maximum HP is supplied. Circular dependencies and
event dependencies outside their resolved phase are refused.

Every nonzero branch participates. Budgets (rules, effects, actions, branches,
events and chain length) fail closed rather than renormalizing a truncated
subset. Probability mass is checked within `1e-9`. Reported expectations use
14 significant digits to remove irrelevant floating-summation tie-breaks;
small nonzero values and the full branch probabilities are retained.

## Source records and actual released contexts

| Exact state                                                                          | Executable scope                                                                                                                                                                     | Still gated                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global English AGL UR Super Saiyan 3 Goku, EZA step 7, Lv140 / SA15                  | Existing v1 comparisons, plus opt-in experimental one/two-appearance counts using the original profile or explicitly entered totals and the existing eligible equipment subset       | Full node allocation, native mechanics for other characters, damage, battle stat stages, survival                                                                                                                           |
| Unknown-region AGL LR Goku (Ultra Instinct), EZA, Lv150 / SA25, alias `1020311`      | Native-only entry guarantee for one supplied incoming attack; native-only Super count for one supplied 18-Ki initial Super and one 77% native opportunity (expected Supers **1.77**) | Hidden Potential/native chaining, additional Super variant for stat/critical effects, repeated self/team critical overlap, later evasion buildup/cap, revival/Active Skill and full stat stages; no board/equipment mapping |
| Unknown-region TEQ UR Gohan (Teen), untransformed EZA, Lv140 / SA15, alias `1020091` | Existing reviewed qualitative kit guidance; additional source-linked Super-ATK and event records and implementation-status inspection                                                | Numerical counts/raises remain blocked by native-chain/counter/guard semantics, 99-turn/infinite disagreement and remaining effects; no board/equipment mapping                                                             |

UI Goku's native preview explicitly excludes potential/equipment. Its one
incoming-attack guarantee does not authorize later evasion predictions. Its
Super-count objective does not require the unknown additional-Super variant;
objectives that could depend on the variant stay blocked. This is a bounded
native-event preview, **not a full build recommendation**.

Each real effect retains selected original wording or a short original factual
summary and a field reference. Source review dates, raw-page revision/hash
availability and independent-confirmation status are separate. The new
normalization is not independent game verification. Unknown region, numeric
EZA step, raw stats, links and categories stay null. Historical MNprojects
identities and source pins are not merged or revised.

Four statuses are displayed separately: **recorded**, **structured**,
**implementation available**, and **supported for this metric/context**.
Reviewed exclusions bind the complete scenario fingerprint and a reason;
copying its ID while changing events/history cannot reuse its evidence scope.
Imported user definitions never gain a registered policy or evaluator.

## Search, explanations and verification

Generation, eligibility, evaluation, comparison and explanations remain separate.
The sequence adapter consumes the same traced card/potential/equipment
contributions. The baseline participates; equivalent configurations and genuine
ties remain. Search yields between event-model candidates and during dominance
checks. Context edits invalidate pending results. Truncation still says **Best
found**, never a global optimum.

Capability gates run before search. New objectives are opt-in and experimental;
old initial-check objectives remain unchanged. No objective is selected when
switching model families. Event traces show turn/appearance, source/kind,
activation effects, completed counters, factors and branch probabilities.

Tests include independently specified expectations for native chains,
conditional guarantees, completed-counter dependencies, overlap, 12/18-Ki
timing, before/after effects, HP changes, caps, expiration, death, normalization,
budgets, exact-state binding, scenario tampering, equipment eligibility,
baseline/ties, enumeration/dominance cancellation and old/new saved settings.
The browser suite exercises the actual application at `/dokkan-optimizer/` on
desktop and mobile. See `VALIDATION.md` for commands actually run and results.

Remaining evidence is required per card/objective: complete attainable board or
allocation set and mapping, compatible item restrictions, exact check/variant
semantics, repeated critical/evasion conventions, guard/revival/form history,
and verified combat stages before any damage or survival objective. None of
those is supplied by a successful arithmetic test.
