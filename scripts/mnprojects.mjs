import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Local pinned published JSON -> factual allowlist only. Never execute source
// content, follow embedded URLs, download artwork or expose arbitrary errors.
export const EXPECTED_BLOB = 'e42a9904720b956e7406d79cee74d497a7578a58';
const KEYS = [
  'id',
  'name',
  'title',
  'rarity',
  'type',
  'class',
  'maxLevel',
  'maxSALevel',
  'links',
  'categories',
  'baseHP',
  'maxLevelHP',
  'freeDupeHP',
  'rainbowHP',
  'baseAttack',
  'maxLevelAttack',
  'freeDupeAttack',
  'rainbowAttack',
  'baseDefence',
  'maxDefence',
  'freeDupeDefence',
  'rainbowDefence',
];
export function projectSource(bytes) {
  const actual = createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex');
  if (actual !== EXPECTED_BLOB)
    throw new Error(
      'The input does not match the reviewed published Git blob. Review a new source revision before changing the pin.',
    );
  const data = JSON.parse(bytes.toString('utf8'));
  if (!Array.isArray(data) || data.length > 10_000)
    throw new Error('Invalid source row list.');
  return data.map((r, sourceRow) => ({
    sourceRow,
    ...Object.fromEntries(
      KEYS.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]),
    ),
    hasEzaDescriptions: Object.entries(r).some(
      ([k, v]) =>
        k.startsWith('eza') && typeof v === 'string' && v.trim().length > 0,
    ),
    embeddedForms: Array.isArray(r.transformations)
      ? r.transformations.length
      : 0,
  }));
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [input, output, ...extra] = process.argv.slice(2);
  if (!input || !output || extra.length) {
    console.error(
      'Usage: node scripts/mnprojects.mjs <local-pinned-source.json> <new-facts.json>',
    );
    process.exitCode = 1;
  } else
    try {
      if ((await stat(input)).size > 20 * 1024 * 1024)
        throw new Error('oversized');
      const rows = projectSource(await readFile(input));
      await writeFile(output, `${JSON.stringify(rows, null, 2)}\n`, {
        flag: 'wx',
      });
      console.log(
        `Projected ${rows.length} published UR/LR source rows. Artwork and skill prose omitted. Validate the normalized catalog and review the reconciliation report before updating.`,
      );
    } catch {
      console.error(
        'Projection failed: check the reviewed Git blob, JSON, size limit and a new output path. Nothing was overwritten.',
      );
      process.exitCode = 1;
    }
}
