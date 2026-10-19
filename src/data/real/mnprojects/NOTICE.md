# Historical UR/LR factual catalog

Source: **MNprojects/DokkanAPI**, by Michael Nash / MNprojects, commit `c28a0248e36d97ebb678345d97be746f5f98d656` (2023-01-22), `data/DokkanCharacterData.json`, Git blob `e42a9904720b956e7406d79cee74d497a7578a58`. Retrieved/reviewed 2026-10-19. This is a historical snapshot, not an assertion of complete 2026 coverage.

The source README documents public GraphQL use, offers the repository JSON, and credits the **Dragon Ball Z Dokkan Battle Wiki contributors** as its upstream. The repository publishes **GNU AGPL version 3** with no recorded data-file exception. This factual projection retains that license in `LICENSE-AGPL-3.0.txt`; source and modifications remain public. This notice concerns the dataset, not a new blanket license for the application's original code or game assets.

References:

- [Published data](https://github.com/MNprojects/DokkanAPI/blob/c28a0248e36d97ebb678345d97be746f5f98d656/data/DokkanCharacterData.json)
- [Source README / provenance and intended consumption](https://github.com/MNprojects/DokkanAPI/blob/c28a0248e36d97ebb678345d97be746f5f98d656/README.md)
- [Repository license](https://github.com/MNprojects/DokkanAPI/blob/c28a0248e36d97ebb678345d97be746f5f98d656/LICENSE)
- [Upstream wiki and contributors](https://dbz-dokkanbattle.fandom.com/wiki/Dragon_Ball_Z_Dokkan_Battle_Wiki)

Changes: retain only individual factual names, provider IDs, type/class/rarity, levels, link/category labels, stat columns and flags for the presence of EZA descriptions/embedded forms. Remove artwork URLs, all leader/passive/Super/Active prose, Ki multiplier descriptions and embedded transformation content. Reorganize the records into the project's separate card/state contract. No downloaded code is executed or calculator implementation reused.

Access is through the repository's published file, not scraping a website or calling a private endpoint. Its project license addresses the published compilation's own contributions; it is not a grant of rights to game artwork or all upstream expressive text. Copied skill descriptions are deliberately excluded, both for this boundary and because missing icons/footnotes make them unreliable. No unsupported assertion that the AGPL code license independently verifies game data is made.

## Scope and update policy

`facts.json` is the allowlisted factual projection. `scripts/mnprojects.mjs` reproduces it from a local copy of the pinned published JSON and refuses a mismatched Git blob hash. It makes no network request. A source update requires an explicit new commit/blob pin, a new factual extraction, row/identity reconciliation, a source/license review and saved-ID compatibility checks; there is no silent live updater.

Conflicting ID `12521` is quarantined, not guessed. Duplicate `11066` has matching identity but conflicting row fields; matching identity is shared while disputed fields are missing and both stat tables remain labeled by source row. Zeni material `11148` is excluded explicitly. Missing SA/type/class alone never excludes a character. Embedded transformation entries lack complete rarity/state mappings and are counted separately rather than guessed as additional cards.

Free-dupe/rainbow columns do not provide a complete attainable allocation set. No universal percentage ladder, native skill levels, chosen-node totals or intermediate stat interpolation is added. The source's mixed base/EZA stat scopes remain unresolved. Existing reviewed Goku/Gohan state IDs, data revisions and saves are unchanged.
