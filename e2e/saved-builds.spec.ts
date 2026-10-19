import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, LIBRARY_KEY, test, GOKU_OPTIMIZER } from './fixtures';

const open = async (page: Page) => {
  await page.goto(GOKU_OPTIMIZER);
  await expect(page.locator('.cb-search')).toBeVisible();
};
const library = (page: Page) =>
  page.getByRole('region', { name: 'Your saved builds' });
const silver = (page: Page) => page.getByLabel('Current silver equip');
async function saveAs(page: Page, name: string) {
  await library(page).getByLabel('Name for the current settings').fill(name);
  await library(page).getByRole('button', { name: 'Save build' }).click();
  await expect(library(page).getByRole('status')).toHaveText(
    `Saved “${name}”.`,
  );
}
const file = (name: string, text: string) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(text),
});

test('save, reset, reload, load and delete with confirmations', async ({
  page,
}) => {
  await open(page);
  await silver(page).selectOption({ label: 'Critical Hit +2 · silver' });
  await saveAs(page, 'Crit silver');
  await expect(library(page).getByRole('listitem')).toContainText([
    'Crit silverReady',
  ]);

  // Escape cancels a destructive action.
  await page.getByRole('button', { name: 'Reset working settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reset working settings?' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(silver(page)).toHaveValue('generic:silver:critical:2');
  // Focus returns to the control that opened the dialog.
  await expect(
    page.getByRole('button', { name: 'Reset working settings' }),
  ).toBeFocused();

  await page.getByRole('button', { name: 'Reset working settings' }).click();
  await dialog.getByRole('button', { name: 'Reset settings' }).click();
  await expect(silver(page)).toHaveValue('');

  await page.reload();
  // Keyboard only: open, move from Cancel to the confirm button, activate.
  const load = page.getByRole('button', { name: 'Load Crit silver' });
  await load.focus();
  await page.keyboard.press('Enter');
  const loadDialog = page.getByRole('dialog', { name: 'Load “Crit silver”?' });
  await expect(
    loadDialog.getByRole('button', { name: 'Cancel' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    loadDialog.getByRole('button', { name: 'Load build' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(silver(page)).toHaveValue('generic:silver:critical:2');
  await expect(load).toBeFocused();

  await page.getByRole('button', { name: 'Delete Crit silver' }).click();
  await page
    .getByRole('dialog', { name: 'Delete “Crit silver”?' })
    .getByRole('button', { name: 'Delete build' })
    .click();
  await expect(library(page).getByRole('listitem')).toHaveCount(0);
  // The removed row's button is gone, so focus moves to the section heading.
  await expect(
    library(page).getByRole('heading', { name: 'Your saved builds' }),
  ).toBeFocused();
  const stored = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    LIBRARY_KEY,
  );
  expect(JSON.parse(stored!)).toEqual({ version: 1, builds: [] });
});

test('JSON export restores builds and working settings in a fresh profile', async ({
  page,
  browser,
}) => {
  await open(page);
  await silver(page).selectOption({ label: 'Critical Hit +2 · silver' });
  await page.getByLabel('Use my inventory quantities').check();
  await page
    .getByLabel('Unequipped copies: AGL ATK +500 · bronze Lv.5')
    .fill('3');
  await saveAs(page, 'Inventory crit');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^dokkan-character-builds-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const text = await readFile((await download.path())!, 'utf8');
  const bundle = JSON.parse(text);
  expect(bundle).toMatchObject({
    format: 'dokkan-optimizer.character-builds',
    version: 1,
    catalogRevision: 'goku-initial-check-2026-10-18.1',
    evaluatorVersion: 'goku-initial-check-v1',
  });
  expect(bundle.builds).toHaveLength(1);
  expect(bundle.working.inventory['agl:bronze:attack:5']).toBe(3);

  const fresh = await browser.newContext({
    viewport: page.viewportSize(),
  });
  const other = await fresh.newPage();
  await open(other);
  await expect(silver(other)).toHaveValue('');
  await library(other)
    .getByLabel('Import JSON')
    .setInputFiles(file('backup.json', text));
  const review = other.getByRole('dialog', { name: 'Review import' });
  await expect(review).toContainText(
    '1 build will be added; 0 exact duplicates skipped.',
  );
  await review.getByLabel(/Also replace my working settings/).check();
  await review.getByRole('button', { name: 'Import 1 build' }).click();
  await expect(silver(other)).toHaveValue('generic:silver:critical:2');
  await expect(
    other.getByLabel('Unequipped copies: AGL ATK +500 · bronze Lv.5'),
  ).toHaveValue('3');
  await expect(library(other).getByRole('status')).toContainText(
    'Added 1 build',
  );

  // Re-importing the same file: the preview says nothing would be added.
  await library(other)
    .getByLabel('Import JSON')
    .setInputFiles(file('backup.json', text));
  await expect(review).toContainText(
    '0 builds will be added; 1 exact duplicate skipped.',
  );
  await expect(review).toContainText(
    'Inventory crit — skipped: exact duplicate of a saved build',
  );
  await expect(
    review.getByRole('button', { name: 'Replace working settings' }),
  ).toBeDisabled();
  await other.keyboard.press('Escape');
  await expect(library(other).getByRole('listitem')).toHaveCount(1);
  await fresh.close();
});

test('untrusted import files are rejected without changes', async ({
  page,
}) => {
  await open(page);
  const input = library(page).getByLabel('Import JSON');
  await input.setInputFiles(file('page.json', '<script>alert(1)</script>'));
  await expect(library(page).getByRole('status')).toHaveText(
    'The file is not valid JSON.',
  );
  await input.setInputFiles(file('other.json', '{"format":"something-else"}'));
  await expect(library(page).getByRole('status')).toHaveText(
    'This is not a Dokkan character-build export.',
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    await page.evaluate((key) => window.localStorage.getItem(key), LIBRARY_KEY),
  ).toBeNull();
});

test('an unreadable stored library is preserved until explicitly replaced', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(
    (key) => window.localStorage.setItem(key, '{"version":1,"builds":[{}]}'),
    LIBRARY_KEY,
  );
  await page.reload();
  await expect(library(page).getByRole('alert')).toContainText(
    'malformed or duplicated',
  );
  await expect(
    library(page).getByRole('button', { name: 'Save build' }),
  ).toBeDisabled();
  // Editing working settings does not touch the library.
  await silver(page).selectOption({ label: 'Evasion +2 · silver' });
  expect(
    await page.evaluate((key) => window.localStorage.getItem(key), LIBRARY_KEY),
  ).toBe('{"version":1,"builds":[{}]}');

  await library(page)
    .getByRole('button', { name: 'Replace with empty library' })
    .click();
  await page
    .getByRole('dialog', { name: 'Replace unreadable saved builds?' })
    .getByRole('button', { name: 'Replace with empty library' })
    .click();
  await expect(
    library(page).getByRole('button', { name: 'Save build' }),
  ).toBeEnabled();
  expect(
    await page.evaluate((key) => window.localStorage.getItem(key), LIBRARY_KEY),
  ).toBe('{"version":1,"builds":[]}');
});

test('imported builds with unknown items stay identifiable and are not loadable', async ({
  page,
}) => {
  await open(page);
  await saveAs(page, 'Original');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const bundle = JSON.parse(
    await readFile((await (await downloadPromise).path())!, 'utf8'),
  );
  bundle.builds[0].id = 'imported-unknown-item';
  bundle.builds[0].name = 'Unknown item build';
  bundle.builds[0].request.current.equips.bronze = 'agl:bronze:imaginary:9';
  await library(page)
    .getByLabel('Import JSON')
    .setInputFiles(file('unknown.json', JSON.stringify(bundle)));
  const review = page.getByRole('dialog', { name: 'Review import' });
  await expect(review).toContainText(
    'Unknown item build — will be added · Invalid settings',
  );
  await expect(review).toContainText(
    'Unknown equip in bronze: agl:bronze:imaginary:9.',
  );
  await expect(review).toContainText(
    '1 of the added builds cannot be loaded (stale or invalid) but will be kept.',
  );
  await review.getByRole('button', { name: 'Import 1 build' }).click();
  const row = library(page)
    .getByRole('listitem')
    .filter({ hasText: 'Unknown item build' });
  await expect(row).toContainText('Unknown item (agl:bronze:imaginary:9)');
  await expect(
    row.getByRole('button', { name: 'Load Unknown item build' }),
  ).toBeDisabled();
});

test('export never includes a hidden value behind an invalid field', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Candidate limit').fill('');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const bundle = JSON.parse(
    await readFile((await (await downloadPromise).path())!, 'utf8'),
  );
  expect(bundle.working).toBeNull();
  await expect(library(page).getByRole('status')).toContainText(
    'working settings were omitted because the highlighted inputs are invalid',
  );
});

test('a second tab never silently overwrites saved builds', async ({
  page,
  context,
}) => {
  await open(page);
  const other = await context.newPage();
  await open(other);
  await saveAs(other, 'From the other tab');
  // This tab still shows the list it loaded; its write must not clobber.
  await library(page)
    .getByLabel('Name for the current settings')
    .fill('From this tab');
  await library(page).getByRole('button', { name: 'Save build' }).click();
  await expect(library(page).getByRole('status')).toContainText(
    'Saved builds changed in another tab or window.',
  );
  await expect(library(page).getByRole('listitem')).toHaveText([
    /From the other tab/,
  ]);
  await library(page).getByRole('button', { name: 'Save build' }).click();
  await expect(library(page).getByRole('listitem')).toHaveText([
    /From the other tab/,
    /From this tab/,
  ]);
});
