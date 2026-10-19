import { readFile, writeFile, stat } from 'node:fs/promises';
import { validateCatalog } from '../src/character-data/validation.ts';
import {
  assessCatalogUpdate,
  catalogCounts,
} from '../src/character-data/catalog.ts';

// Local normalized JSON only. No URLs, credentials, provider requests or evaluation.
const [command, file, previousFile, ...extra] = process.argv.slice(2);
async function load(path) {
  if ((await stat(path)).size > 20 * 1024 * 1024) throw new Error('oversized');
  const result = validateCatalog(JSON.parse(await readFile(path, 'utf8')));
  if (!result.ok) {
    process.stdout.write(
      `${JSON.stringify({ valid: false, errors: result.errors }, null, 2)}\n`,
    );
    process.exitCode = 1;
    return null;
  }
  return result.snapshot;
}
try {
  if (command === 'export-admitted' && file && !previousFile && !extra.length) {
    const { catalogSnapshot } = await import('../src/data/real/catalog.ts');
    await writeFile(file, `${JSON.stringify(catalogSnapshot, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    process.stdout.write(
      'Exported the bundled reviewed and historical reference catalog. No provider request occurred.\n',
    );
  } else if (command === 'validate' && file && !extra.length) {
    const snapshot = await load(file);
    if (snapshot) {
      const previous = previousFile ? await load(previousFile) : null;
      if (!previousFile || previous) {
        const update = previous
          ? assessCatalogUpdate(previous, snapshot)
          : null;
        process.stdout.write(
          `${JSON.stringify({ valid: true, meaning: 'Schema validation only; not source accuracy, permission or combat verification.', id: snapshot.id, revision: snapshot.revision, counts: catalogCounts(snapshot), update }, null, 2)}\n`,
        );
        if (update && !update.compatible) process.exitCode = 2;
      }
    }
  } else {
    process.stderr.write(
      'Usage: node scripts/catalog.mjs export-admitted <new-file.json> | validate <file.json> [previous.json]\n',
    );
    process.exitCode = 1;
  }
} catch {
  // Do not echo untrusted content, paths, stack traces or imported error text.
  process.stderr.write(
    'Catalog command failed: check local JSON, file size (20 MiB maximum), permissions, and that an export destination does not already exist.\n',
  );
  process.exitCode = 1;
}
