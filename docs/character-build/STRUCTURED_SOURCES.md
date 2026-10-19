# Focused structured-source audit

Checked 2026-10-19 UTC (2026-10-18 America/New_York), against main `01480eaa55c3a6f95e0cc68866aae7930d7edae4`. Scope: the existing Global English, Super AGL [Mystery Super Technique] Super Saiyan 3 Goku, EZA step 7 / Lv140 / SA15, without SEZA. This audit changes no application records, formulas, eligibility rules or UI.

## Decision

MNprojects/DokkanAPI has an inspectable public dataset but no allocation graph or orb records. GachaData has a documented authenticated API worth evaluating; its full Dokkan response schema is **uninspected**, not established to be missing the graph. Its public tables alone cannot establish one. No adapter or assumed graph is admitted. In-game captures remain paused while a permitted API sample/access path is investigated.

The observations below are source documentation and repository inspection, not independent confirmation of game behavior. Existing arithmetic tests do not change that status. No combat formula is verified by structured data's existence.

## GachaData

Sources: [Dokkan overview](https://gacha-data.com/dokkan-battle/), [API documentation](https://gacha-data.com/api/), [terms](https://gacha-data.com/terms/), [potential summaries](https://gacha-data.com/dokkan-battle/potential_boards/), [orb table](https://gacha-data.com/dokkan-battle/skill_orbs/), [game changelog](https://gacha-data.com/dokkan-battle/changelog/).

- Availability: public documentation/tables were readable. One GET to the explicitly documented `/api/dokkan-battle/potential_boards` endpoint returned HTTP 401 and a JSON object containing `error: auth_required`, token instructions and documentation links. This confirms a responding authentication boundary, not successful dataset access. No token was supplied, requested by email or acquired; no authentication was bypassed. The inspected JSON is an error envelope, not the board schema.
- Freshness: the Dokkan overview reports September 7, 2026 and Global EN; its changelog lists six archived builds. These are publisher-reported snapshot dates, not proof of coverage of today's game. A newer date on GachaData's overall site is not a newer Dokkan snapshot.
- API contract: header `X-API-Key`; documented collection/detail endpoints for characters and named datasets, including `potential_boards` and `skill_orbs`. Public docs show a character-list envelope (`game`, `total`, `count`, `sort`, `characters`) using another game's example. They do not publish a complete Dokkan node/orb schema. Those example fields cannot be treated as observed Dokkan response fields.
- Access/reuse: terms dated October 5, 2026 reserve original code, writing and compiled organization; there is no open-source code grant identified. Free API access is for evaluation/light personal use; applications require Pro, which permits community projects with attribution and confidential tokens. Terms restrict compiled-data scraping/redistribution outside API permissions. Permission to commit a raw public snapshot or redistribute a normalized subset needs clarification; application use is not automatically a standalone dataset-export grant. Game-content ownership is separately disclaimed. These observations do not establish a ban on independently recording individual numerical facts.
- Identity/state: the roster names the intended card, but its exact detail link could not be resolved by the retrieval tool. A readable [related awakening-chain page](https://gacha-data.com/dokkan-battle/characters/1004220/) combines multiple forms and an EZA section with a complex passive description, rather than supplying a verified EZA-step-7 record. Do not transfer that page's values or current passive into our state. An explicit card/form/EZA/SEZA mapping remains required.

## MNprojects/DokkanAPI

Sources: [README](https://github.com/MNprojects/DokkanAPI), [license](https://github.com/MNprojects/DokkanAPI/blob/main/LICENSE), pinned [TypeScript model](https://github.com/MNprojects/DokkanAPI/blob/c28a0248e36d97ebb678345d97be746f5f98d656/src/character.ts), [GraphQL schema](https://github.com/MNprojects/DokkanAPI/blob/c28a0248e36d97ebb678345d97be746f5f98d656/src/server.ts), and [JSON](https://github.com/MNprojects/DokkanAPI/blob/c28a0248e36d97ebb678345d97be746f5f98d656/data/DokkanCharacterData.json).

- This is distinct from the previously assessed dokkanapi.com website and its terms. Do not apply that other service's private-endpoint restrictions to this repository's documented public API.
- Availability: the public repository and JSON blob were readable via GitHub. The advertised unauthenticated `https://dokkanapi.azurewebsites.net/graphql` endpoint returned HTTP 503 with an upstream-connect error from this environment, including for a small documented-style character query. No successful live GraphQL response was obtained; this is not a claim about worldwide uptime.
- Pinned inspection: main `c28a0248e36d97ebb678345d97be746f5f98d656`, dated January 22, 2023. `data/DokkanCharacterData.json` blob `e42a9904720b956e7406d79cee74d497a7578a58`, last file commit `1d0421a37d27d689259b3464172a23c9ceefb990` on January 12, 2023. All 796 top-level records were parsed in memory and their keys inspected; no source JSON, artwork or source code was imported into this project. The repository's later `updated_at`/`pushed_at` timestamps are not data verification dates.
- Actual schema: GraphQL exposes `character`/`characters` with identity, descriptive skills, categories/links, stat totals and transformations. JSON additionally contains optional `ezaLeaderSkill`, `ezaSuperAttack`, `ezaPassive` and related EZA text keys; those are absent from the exposed GraphQL character fields. Neither schema nor JSON key inventory contains potential-board/node/route/prerequisite/orb records. No region, game-build, verification-date or explicit SEZA fields were found.
- State disagreement: the matching source record has ID `1321`, name Super Saiyan 3 Goku, title Mystery Super Technique, Super AGL, `maxLevel: 140`, `maxSALevel: 15`, and EZA text fields. Its `maxLevelHP/maxLevelAttack/maxDefence` are 9500/8672/4623, which conflict with this project's documented EZA values 12527/11111/5796. No distinct EZA stat-stage table resolves this within the record. Preserve `1321` as that source's alias; do not substitute it for game/card-state IDs or infer an ID conversion formula.
- Licensing/provenance: root license is AGPL-3.0 for the repository's original work. The README explicitly attributes its data to a Dokkan Fandom wiki scraper. The root code license does not establish rights to relicense all upstream game/wiki text, images or compiled content. Dataset attribution/share-alike obligations and extraction/access provenance need separate assessment before redistribution. No code or dataset is adopted; this is not a conclusion that individual numerical facts are unusable.

## Fields actually inspected

| Required information                                 | GachaData public view / documented API                                                                                 | MNprojects pinned repository                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Fixed native skill levels                            | Some named path summaries include Combo Attack Lv5; no individual native-node record                                   | No node/native-level fields                                                |
| Choice-node IDs, positions, alternatives, increments | Not exposed in inspected summary table; authenticated response unknown                                                 | Absent from model and inspected JSON keys                                  |
| Connections and prerequisite/unlock graph            | Not exposed in inspected summary table; authenticated response unknown                                                 | Absent                                                                     |
| Card-to-board mapping                                | Board summary has aggregate card counts, not individual card references; authenticated response unknown                | Absent                                                                     |
| Orb slot and restrictions                            | Public grade and effect prose include character/category restrictions; typed restrictions, IDs and full schema unknown | No orb dataset/fields                                                      |
| Exact three generic silver +2 records                | Not established: public table explicitly shows 2,000 / 8,698 rows; absence there cannot prove nonexistence             | No orb records                                                             |
| Exact EZA/SEZA state                                 | Public chain view is insufficient; authenticated state schema unknown                                                  | Optional EZA text, mixed stat metadata; no explicit SEZA/state-stage model |

The board table's actual columns are Name, Path, Cards, HP, ATK, DEF, Skills and Materials. Its 176 displayed entries are summaries, not an observed adjacency/choice graph. The orb table's columns are Name, Grade, HP, ATK, DEF and Effect. Do not infer numeric restriction IDs or source item IDs from names, row order or prose. The three existing generic silver entries retain their unresolved restrictions/IDs and are ineligible for any future mode described as verified-only. The current app has no verified-only mode.

## Smallest next evidence request

Prefer an authorized GachaData evaluation sample before requesting game captures. A free evaluation token must be obtained by its owner through GachaData; do not paste tokens into chat or commit them. No account registration, outbound permission message or paid access is performed by this project.

A permitted sample or published schema needs only:

1. Dataset envelope/build/region metadata and one exact Goku record, including its form/state and board reference.
2. The referenced board's full node definitions: stable IDs; coordinates or identifiable positions; fixed/choice effects and increments; edges and their AND/OR interpretation; route gates; SA/other prerequisites; and unknown/unsupported rule types. Include referenced node/effect tables needed to resolve IDs. Omitted fields must be identified, not interpreted as unrestricted.
3. The exact generic silver AA/Crit/Evasion +2 records with source IDs, slot, effects, type/class/category/card restrictions, SA/route requirements and reusability. Explicitly distinguish empty restrictions from missing data.
4. Applicable permission for application display, build-time caching and public redistribution of a small normalized snapshot, separately from a raw API sample. Do not assume Pro grants every form of redistribution.

If the authorized board sample lacks particular graph fields, request only those fields or the corresponding inspectable game-node screens. Do not ask the user to unlock, respec, reverse, awaken or spend resources. The screenshot request stays paused now.

## Conditional adapter design

If the sample and permitted reuse establish a complete graph, use build-time ingestion with a reviewed, versioned minimal snapshot. Validate the external schema outside the pure engine; retain source IDs, snapshot/commit, region, exact state, terms-review date, per-field evidence and null independent-verification dates. Unknown rule types and unresolved references must fail closed. Never put a confidential token into Vite variables or browser code.

Before admission, check card-to-board mappings, node increments/prerequisites and exact legal sets against genuinely independent examples or game observations; a second output from the same upstream source is not independent corroboration. Measure the resulting joint search size before choosing a worker/search strategy. No graph test oracle or combat formula can be generated merely by trusting this dataset. No adapter, graph or new performance objective is implemented by this audit.
