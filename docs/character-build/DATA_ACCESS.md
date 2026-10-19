# Character snapshot: access and reuse assessment

## Individual record research — 2026-10-19

On the user's request, this assessed whether a few individual factual records could be documented from permitted public pages. It was not bulk acquisition. Rules followed:

- no Dokkan Info, dokkan.wiki, APIs, hidden endpoints, assets, listings or crawling;
- `robots.txt` checked first on each host;
- at most 14 requests, at least 3 seconds apart.

Six requests were made:

- **Fandom wiki and DokkanStats.** `robots.txt` returned a Cloudflare challenge (HTTP 403) on the first try and on the single retry. With their rules unreadable, **no page on either site was requested**. A blocked automated request is not evidence about whether facts may be recorded, and is not a reason to work around the block.
- **dokkan.fyi.** `robots.txt` does not disallow `/characters/`. **One page** (`/characters/1003211`) was retrieved and its facts were recorded manually. The page's deferred data and its Markdown alternate were not requested.

Outcome:

- **One state admitted:** the pre-EZA base state of card 1003211, single source and source-documented; see [evidence](EVIDENCE.md).
- **Super EZA state and pre-awakening card:** rejected for missing evidence.

What blocks more real coverage is specific:

- the two cross-check sources are unreachable by automated retrieval;
- the one reachable source is a single, recently corrected database without a dataset-reuse grant;
- bulk use remains unauthorized.

Recording a handful more individual states the same way is possible, one page per state. Each would stay single-source until an independent observation exists. No contact, account, token or purchase was made.

## Provider-independent catalog status — 2026-10-19

Dokkan Info is the preferred prospective provider, but bulk acquisition is paused pending an approved method. The catalog implementation migrates existing admitted local facts only. No provider acquisition adapter, source request, expanded dataset, artwork or new permission grant is included. The normalized schema, fixture tests and local validation/update commands confer no integration rights. Existing source assessments below are historical records, not a new source review for this milestone. See [catalog scope](../CATALOG.md).

Reviewed 2026-10-18. This separates access conditions, expressive content, compiled-dataset reuse and mechanics verification. It is a record of the acquisition decision, not a legal opinion or a claim to rights over game content.

## What is actually included

One exact card identity/stat profile, six individual numeric equip facts, and short independently written rule summaries. These were manually normalized from reference pages and identified search-index excerpts. Original internal IDs are signatures; absent source item IDs stay null. No database export/compiled schema, source calculator code, artwork, animations or long descriptions are copied. No third-party requests occur in the application.

Missing bulk-dataset permission is **not treated as proof that individual numerical facts cannot be independently recorded**. Conversely, manual recording is not a blanket redistribution license. Factual values, original prose, original selection/organization, game assets and contractual access conditions are assessed separately. Attribution is supplied for research transparency; it is not represented as a substitute for permission where permission is required. Broader dataset reuse and any publisher-specific restrictions remain unresolved.

## Source decisions

| Source                                                                                                                                                                                             | Access / reuse evidence                                                                                                                                     | Decision                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [DokkanAPI terms](https://dokkanapi.com/global/en/terms), updated 2026-10-03                                                                                                                       | Readable; no public API; prohibits automated internal-endpoint use and asset mirroring                                                                      | No internal requests or import.                                                                                                                                                                                                        |
| [DokkanStats terms](https://dokkanstats.com/en/terms-of-use/), updated 2026-10-11                                                                                                                  | Readable; prior permission for automated scraping/systematic downloading; original code/writing restrictions                                                | Ordinary public page research only, no systematic requests, compiled-data import or calculator reuse. Statistical table agreement is not independent verification.                                                                     |
| [DokkanWiki terms](https://dokkan.wiki/terms) / [Dokkan Info](https://dokkaninfo.com/)                                                                                                             | Rechecks returned 503/402; no current integration grant verified                                                                                            | No integration. A retrieval error establishes neither a ban on facts nor an authorized API.                                                                                                                                            |
| [Fandom licensing](https://www.fandom.com/licensing) / Dokkan wiki                                                                                                                                 | Prior indexed CC-BY-SA footer; current direct license/wiki retrieval failed or was restricted                                                               | Source-linked indexed facts and original summaries only; no bulk import or copied expressive text/media. Exact current automated-access and text-license obligations unresolved. Fan concepts/blogs excluded.                          |
| [DOKKAN.FYI](https://dokkan.fyi/)                                                                                                                                                                  | Public reference pages readable; no dataset-reuse grant found; revamped-stage page timed out, but indexed labels identify generic silver items              | Manually record six item facts and link sources; no dataset, assets, hidden APIs or acquisition-rate claims. Publisher/compiled-dataset redistribution questions are not declared settled.                                             |
| [Original player guide](https://gamefaqs.gamespot.com/boards/178921-dragon-ball-z-dokkan-battle/74852076?page=13) / [authored calculation guide](https://kandymanis.github.io/dokkanalytics/guide) | Ordinary public explanations, not dataset licenses                                                                                                          | Independently written mathematical implementation and short factual summaries; no guide/code copying. A player's explanation remains documented evidence unless independent observations are actually supplied.                        |
| [GachaData terms](https://gacha-data.com/terms/) and [documented API](https://gacha-data.com/api/), newly assessed                                                                                 | Terms dated 2026-10-05 describe authenticated free evaluation/personal use and Pro for community applications; restrictions on compiled-data redistribution | No token obtained, no API called, no board/catalog imported. Potential future permitted service path, subject to explicit scope, caching/redistribution clarification and separate mechanics validation. No paid access was purchased. |

## Maintenance path

Maintain this small source-linked numerical snapshot manually. Pin its revision. Review game/card/orb changes and terms before updating; retain evidence per field and record disagreements. Add independent game captures or independent research methods with dates before promoting confidence. Do not infer independence from two websites or successful math tests. No live adapter is required for this slice.

A future compiled-dataset adapter requires a documented access grant, permitted fields, redistribution/caching scope and update cadence. Permission for code alone does not license a dataset or game media. No contact messages, account registrations or permission requests were sent.
