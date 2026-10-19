import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import {
  example,
  withEffect,
} from '../src/character-definitions/definition.fixtures';
import { DEFINITION_KEY } from '../src/character-definitions/library';
import {
  expect,
  GOKU_OPTIMIZER,
  LEGACY_KEY,
  LIBRARY_KEY,
  test,
  WORKING_KEY,
} from './fixtures';

const file = (value: unknown) => ({
  name: 'test-only-definitions.json',
  mimeType: 'application/json',
  buffer: Buffer.from(
    typeof value === 'string' ? value : JSON.stringify(value),
  ),
});
const payload = () => ({ schemaVersion: 1, documents: [example()] });

test('blocked storage still permits explicit comparison and draft export', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  await newCharacter(page);
  await expect(page.getByRole('status')).toContainText(
    'Local storage is blocked.',
  );
  await expect(
    page.getByRole('button', { name: 'Save as new revision' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Compare supported metrics' }).click();
  await expect(
    page.getByRole('region', { name: 'Definition comparison' }),
  ).toContainText('200');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export draft + library' }).click();
  const downloaded = await downloading;
  expect(
    JSON.parse(await readFile((await downloaded.path())!, 'utf8')).documents,
  ).toHaveLength(1);
});

test('another state shares a card ID without overwriting the original state', async ({
  page,
}) => {
  await newCharacter(page);
  await page
    .getByLabel('Awakening state', { exact: true })
    .selectOption('base');
  await page.getByRole('button', { name: 'Save as new revision' }).click();
  await page
    .getByText('Links, categories, forms and identity', { exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Duplicate as another state (same card)' })
    .click();
  await page.getByLabel('Awakening state', { exact: true }).selectOption('eza');
  await page.getByRole('button', { name: 'Save as new revision' }).click();
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    DEFINITION_KEY,
  );
  expect(
    stored.documents.map(
      (d: { definition: { awakening: { kind: string } } }) =>
        d.definition.awakening.kind,
    ),
  ).toEqual(['base', 'eza']);
  expect(stored.documents[0].definition.cardId).toBe(
    stored.documents[1].definition.cardId,
  );
  expect(stored.documents[0].definition.id).not.toBe(
    stored.documents[1].definition.id,
  );
});
const importInput = (page: Page) =>
  page.getByLabel('Import definition library (JSON, ≤1 MiB)');
async function newCharacter(page: Page) {
  await page.goto('?workbench=definitions');
  await page
    .getByRole('button', { name: 'New character', exact: true })
    .click();
  await page
    .getByLabel('Character name', { exact: true })
    .fill('My authored character');
  await page.getByLabel('Raw card stats HP', { exact: true }).fill('100');
  await page.getByLabel('Raw card stats ATK', { exact: true }).fill('200');
  await page.getByLabel('Raw card stats DEF', { exact: true }).fill('300');
  await page
    .getByRole('button', {
      name: 'Set no potential additions or skill levels (0)',
    })
    .click();
}

test('primary editor is empty until the user creates records, and saves revisions', async ({
  page,
}) => {
  await newCharacter(page);
  await expect(page).toHaveTitle(
    'Dokkan Character Lab · Definitions and custom builds',
  );
  await expect(
    page.getByText('Custom allocation — board compatibility not checked.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save as new revision' }).click();
  await expect(page.getByRole('status')).toContainText('revision 1');
  await page.getByLabel('Raw card stats ATK', { exact: true }).fill('220');
  await page.getByRole('button', { name: 'Save as new revision' }).click();
  await expect(page.getByRole('status')).toContainText('revision 2');
  await page.reload();
  await page
    .getByRole('button', { name: 'My authored character · unknown · r2' })
    .click();
  await expect(
    page.getByLabel('Raw card stats ATK', { exact: true }),
  ).toHaveValue('220');
  await page.getByText('Revision history', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Open revision 1', exact: true })
    .click();
  await expect(
    page.getByLabel('Raw card stats ATK', { exact: true }),
  ).toHaveValue('200');
});

test('end-to-end custom build, conditional flat effect, equipment and independent trace', async ({
  page,
}) => {
  await newCharacter(page);
  await page.getByLabel('Type', { exact: true }).selectOption('AGL');
  await page.getByRole('button', { name: 'Add ability', exact: true }).click();
  await page.getByLabel('Ability name', { exact: true }).fill('Snapshot boost');
  await page.getByRole('button', { name: 'Add effect', exact: true }).click();
  await page.getByLabel('Amount (blank = unknown)', { exact: true }).fill('20');
  await page
    .getByLabel('Condition type at depth 0', { exact: true })
    .selectOption('threshold');
  await page.getByLabel('Current HP (%)', { exact: true }).fill('60');
  await page
    .getByRole('button', { name: 'Add equipment', exact: true })
    .click();
  await page
    .getByLabel('Equipment name', { exact: true })
    .fill('Entered bronze stat orb');
  await page
    .getByRole('button', { name: 'Set all equipment bonuses to 0' })
    .click();
  await page
    .getByLabel('Flat equipment additions ATK', { exact: true })
    .fill('5');
  await page
    .getByRole('button', { name: 'Add requirement', exact: true })
    .click();
  await page
    .getByLabel('bronze availability', { exact: true })
    .selectOption('available');
  await page
    .getByLabel('bronze equipment', { exact: true })
    .selectOption({ label: 'Entered bronze stat orb' });
  await expect(page.getByText(/Entered requirements met: slot/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Duplicate configuration', exact: true })
    .click();
  await page
    .getByLabel('Hidden Potential additions ATK', { exact: true })
    .last()
    .fill('30');
  await page
    .getByRole('button', { name: 'Compare supported metrics', exact: true })
    .click();
  const results = page.getByRole('region', { name: 'Definition comparison' });
  await expect(results).toContainText(
    '2 of 2 saved/draft configurations compared.',
  );
  const cards = results.locator(':scope > article');
  const modeledAtk = (card: ReturnType<typeof cards.nth>) =>
    card
      .locator('.definition-metrics > div')
      .filter({ has: page.getByText('Modeled snapshot ATK', { exact: true }) });
  await expect(modeledAtk(cards.nth(0))).toContainText('225'); // 200 + 0 + 5 + 20
  await expect(modeledAtk(cards.nth(1))).toContainText('255'); // 200 + 30 + 5 + 20
  await expect(modeledAtk(cards.nth(1))).toContainText('+30');
  await cards
    .nth(1)
    .getByText('Calculation trace and effect coverage', { exact: true })
    .click();
  await expect(cards.nth(1)).toContainText(
    'Manual Current HP (%): 60 >= 50 is true.',
  );
  await expect(cards.nth(1)).toContainText(
    'effect · Snapshot boost: Stat addition: attack 20',
  );
  await expect(results).toContainText(
    'No allocation or equipment search was performed.',
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem('dokkan.character-definitions.v1'),
    ),
  ).toBe(null);
});

test('missing condition context is unavailable and numeric errors block actions', async ({
  page,
}) => {
  await newCharacter(page);
  await page.getByRole('button', { name: 'Add ability', exact: true }).click();
  await page.getByRole('button', { name: 'Add effect', exact: true }).click();
  await page.getByLabel('Amount (blank = unknown)', { exact: true }).fill('10');
  await page
    .getByLabel('Condition type at depth 0', { exact: true })
    .selectOption('threshold');
  await page
    .getByRole('button', { name: 'Compare supported metrics', exact: true })
    .click();
  const results = page.getByRole('region', { name: 'Definition comparison' });
  await expect(
    results
      .locator('.definition-metrics > div')
      .filter({ hasText: 'Modeled snapshot ATK' }),
  ).toContainText('Unavailable');
  await page.getByLabel('Raw card stats ATK', { exact: true }).fill('-1');
  await expect(
    page.getByLabel('Raw card stats ATK', { exact: true }),
  ).toHaveAttribute('aria-invalid', 'true');
  await expect(
    page.getByRole('button', { name: 'Save as new revision' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Compare supported metrics' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('region', { name: 'Definition comparison' }),
  ).toHaveCount(0);
});

test('imports are previewed; conflicts copy explicitly and script wording stays inert', async ({
  page,
}) => {
  await page.goto('?workbench=definitions');
  await importInput(page).setInputFiles(
    file({ schemaVersion: 2, documents: [] }),
  );
  await expect(page.getByRole('status')).toContainText(
    'Only version 1 is supported.',
  );
  const incoming = payload();
  incoming.documents[0]!.definition.notes =
    '<img src=x onerror="window.importExecuted=true">';
  await importInput(page).setInputFiles(file(incoming));
  const preview = page.getByRole('dialog', {
    name: 'Preview definition import',
  });
  await expect(preview).toContainText('Add (1)');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), DEFINITION_KEY),
  ).toBe(null);
  await preview.getByRole('button', { name: 'Import listed records' }).click();
  await page
    .getByRole('button', {
      name: 'TEST ONLY arithmetic character · unknown · r1',
    })
    .click();
  await expect(
    page.getByLabel('Definition notes', { exact: true }),
  ).toHaveValue(incoming.documents[0]!.definition.notes);
  expect(
    await page.evaluate(
      () => (window as { importExecuted?: boolean }).importExecuted,
    ),
  ).toBeUndefined();
  incoming.documents[0]!.definition.rawStats.attack = 777;
  await importInput(page).setInputFiles(file(incoming));
  await expect(preview).toContainText('Skip (1)');
  await expect(
    preview.getByRole('button', { name: 'Import listed records' }),
  ).toBeDisabled();
  await preview.getByLabel('Conflicting state IDs').selectOption('copy');
  await expect(preview).toContainText('New identity mappings');
  await preview.getByRole('button', { name: 'Import listed records' }).click();
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    DEFINITION_KEY,
  );
  expect(
    stored.documents.map(
      (d: { definition: { rawStats: { attack: number } } }) =>
        d.definition.rawStats.attack,
    ),
  ).toEqual([200, 777]);
  expect(stored.documents[0].definition.id).not.toBe(
    stored.documents[1].definition.id,
  );
});

test('exported library restores definitions and configurations in a fresh session', async ({
  page,
  browser,
}) => {
  await newCharacter(page);
  await page.getByRole('button', { name: 'Save as new revision' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export saved library' }).click();
  const downloaded = await downloading;
  const text = await readFile((await downloaded.path())!, 'utf8');
  const context = await browser.newContext();
  const fresh = await context.newPage();
  await fresh.goto(page.url());
  await importInput(fresh).setInputFiles(file(text));
  await fresh
    .getByRole('dialog')
    .getByRole('button', { name: 'Import listed records' })
    .click();
  await fresh
    .getByRole('button', { name: 'My authored character · unknown · r1' })
    .click();
  await expect(
    fresh.getByLabel('Raw card stats ATK', { exact: true }),
  ).toHaveValue('200');
  await expect(
    fresh.getByLabel('Hidden Potential additions ATK', { exact: true }),
  ).toHaveValue('0');
  await context.close();
});

test('unsaved navigation can be canceled and a copied catalog state is detached', async ({
  page,
}) => {
  await newCharacter(page);
  await page
    .getByRole('link', { name: 'Character catalog', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Character name', { exact: true })).toHaveValue(
    'My authored character',
  );
  await page.getByRole('button', { name: 'Discard draft changes' }).click();
  await dialog
    .getByRole('button', { name: 'Continue and discard changes' })
    .click();
  await page
    .getByText('Start from an admitted catalog state', { exact: true })
    .click();
  await page.getByRole('button', { name: 'Copy selected state' }).click();
  await expect(
    page.getByLabel('Raw card stats ATK', { exact: true }),
  ).toHaveValue('11111');
  await expect(
    page.getByLabel('Hidden Potential additions ATK', { exact: true }),
  ).toHaveValue('');
  await page.getByRole('button', { name: 'Save as new revision' }).click();
  await page
    .getByRole('link', { name: 'Character catalog', exact: true })
    .click();
  await expect(page.locator('.catalog-result-count')).toHaveText(
    '1 card form · 1 matching state',
  );
});

test('old saved builds stay byte-for-byte intact while the editor works', async ({
  page,
}) => {
  await page.goto(GOKU_OPTIMIZER);
  const before = await page.evaluate(
    (keys) => {
      keys.slice(1).forEach((k) => localStorage.setItem(k, `preserve:${k}`));
      return keys.map((k) => localStorage.getItem(k));
    },
    [WORKING_KEY, LIBRARY_KEY, LEGACY_KEY],
  );
  await page.goto('?workbench=definitions');
  await page
    .getByRole('button', { name: 'New character', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save as new revision' }).click();
  expect(
    await page.evaluate(
      (keys) => keys.map((k) => localStorage.getItem(k)),
      [WORKING_KEY, LIBRARY_KEY, LEGACY_KEY],
    ),
  ).toEqual(before);
});

test('unreadable future storage is preserved; recovery export remains available', async ({
  page,
}) => {
  await page.goto('?workbench=definitions');
  await page.evaluate(
    (key) => localStorage.setItem(key, '{"schemaVersion":99}'),
    DEFINITION_KEY,
  );
  await page.reload();
  await page
    .getByRole('button', { name: 'New character', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Save as new revision' }),
  ).toBeDisabled();
  const downloading = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export original storage recovery copy' })
    .click();
  const recovery = await downloading;
  expect(await readFile((await recovery.path())!, 'utf8')).toBe(
    '{"schemaVersion":99}',
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), DEFINITION_KEY),
  ).toBe('{"schemaVersion":99}');
});

test('unknown effects remain saveable and visibly stop modeled stat claims', async ({
  page,
}) => {
  const incoming = payload();
  withEffect(incoming.documents[0]!, {
    family: 'other',
    representation: 'recorded-only',
    description: 'TEST ONLY unknown mechanic',
    stat: null,
  });
  await page.goto('?workbench=definitions');
  await importInput(page).setInputFiles(file(incoming));
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Import listed records' })
    .click();
  await page
    .getByRole('button', {
      name: 'TEST ONLY arithmetic character · unknown · r1',
    })
    .click();
  await page.getByRole('button', { name: 'Compare supported metrics' }).click();
  const results = page.getByRole('region', { name: 'Definition comparison' });
  await results
    .getByText('Calculation trace and effect coverage', { exact: true })
    .click();
  await expect(results).toContainText('recorded only; calculation unavailable');
  await expect(
    results
      .locator('.definition-metrics > div')
      .filter({ hasText: 'Modeled snapshot ATK' }),
  ).toContainText('Unavailable');
  await page.getByRole('button', { name: 'Save as new revision' }).click();
  await expect(page.getByRole('status').first()).toContainText('Saved');
});
