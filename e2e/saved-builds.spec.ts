import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, LIBRARY_KEY, test } from './fixtures';

const open = async (page: Page) => {
  await page.goto('?workbench=character-build');
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

  await page.getByRole('button', { name: 'Reset working settings' }).click();
  await dialog.getByRole('button', { name: 'Reset settings' }).click();
  await expect(silver(page)).toHaveValue('');

  await page.reload();
  await page.getByRole('button', { name: 'Load Crit silver' }).click();
  await page
    .getByRole('dialog', { name: 'Load “Crit silver”?' })
    .getByRole('button', { name: 'Load build' })
    .click();
  await expect(silver(page)).toHaveValue('generic:silver:critical:2');

  await page.getByRole('button', { name: 'Delete Crit silver' }).click();
  await page
    .getByRole('dialog', { name: 'Delete “Crit silver”?' })
    .getByRole('button', { name: 'Delete build' })
    .click();
  await expect(library(page).getByRole('listitem')).toHaveCount(0);
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
  await expect(review).toContainText('1 saved build will be added');
  await review.getByLabel(/Also replace my working settings/).check();
  await review.getByRole('button', { name: 'Import' }).click();
  await expect(silver(other)).toHaveValue('generic:silver:critical:2');
  await expect(
    other.getByLabel('Unequipped copies: AGL ATK +500 · bronze Lv.5'),
  ).toHaveValue('3');
  await expect(library(other).getByRole('status')).toContainText(
    'Added 1 build',
  );

  // Re-importing the same file adds nothing.
  await library(other)
    .getByLabel('Import JSON')
    .setInputFiles(file('backup.json', text));
  await review.getByRole('button', { name: 'Import' }).click();
  await expect(library(other).getByRole('status')).toContainText(
    'skipped 1 exact duplicate',
  );
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
