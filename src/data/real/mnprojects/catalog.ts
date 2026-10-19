import rows from './facts.json' with { type: 'json' };
import { importMNProjects } from '../../../character-data/mnprojects-adapter.ts';
import type { CatalogSource } from '../../../character-data/domain';

export const MN_COMMIT = 'c28a0248e36d97ebb678345d97be746f5f98d656';
export const MN_BLOB = 'e42a9904720b956e7406d79cee74d497a7578a58';
export const MN_SOURCE: CatalogSource = {
  id: 'mnprojects:dokkan-api',
  label: 'MNprojects/DokkanAPI — historical UR/LR factual snapshot (2023)',
  url: `https://github.com/MNprojects/DokkanAPI/blob/${MN_COMMIT}/data/DokkanCharacterData.json`,
  access: 'approved-export',
  license: 'AGPL-3.0 (published repository license; factual projection only)',
  permissionReference: `https://github.com/MNprojects/DokkanAPI/blob/${MN_COMMIT}/LICENSE`,
  note: 'Public repository JSON explicitly offered for API consumption under its root AGPL license. Credit MNprojects/Michael Nash and the upstream Dragon Ball Z Dokkan Battle Wiki contributors. No artwork, source code or copied leader/passive/Super prose. Historical source rows can be incomplete or inconsistent; this is not current-game coverage or independent confirmation. See the bundled dataset NOTICE and license.',
};
export const mnCatalog = importMNProjects(rows, {
  source: MN_SOURCE,
  revision: `git-blob:${MN_BLOB}`,
  retrievedAt: '2026-10-19',
});
