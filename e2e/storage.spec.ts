import { readFile } from 'node:fs/promises';
import { expect, test, WORKING_KEY, GOKU_OPTIMIZER } from './fixtures';

test('corrupt working settings warn and are kept until an explicit edit', async ({
  page,
}) => {
  await page.goto(GOKU_OPTIMIZER);
  await page.evaluate(
    (key) => window.localStorage.setItem(key, 'not-json'),
    WORKING_KEY,
  );
  await page.reload();
  await expect(
    page.getByText('Saved character settings could not be read'),
  ).toBeVisible();
  // Browsing the catalog does not write it either.
  await page.goto('?workbench=catalog');
  await page.goto(GOKU_OPTIMIZER);
  expect(
    await page.evaluate((key) => window.localStorage.getItem(key), WORKING_KEY),
  ).toBe('not-json');
  // A copy can be downloaded before an edit replaces it.
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download stored settings copy' })
    .click();
  const copy = await downloadPromise;
  expect(await readFile((await copy.path())!, 'utf8')).toBe('not-json');
  await page
    .getByLabel('Sort by supported objective')
    .selectOption({ label: 'Card ATK' });
  await expect(
    page.getByRole('button', { name: 'Download stored settings copy' }),
  ).toHaveCount(0);
  const stored = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    WORKING_KEY,
  );
  expect(JSON.parse(stored!).request.objective).toBe('attack');
});

test('blocked storage is reported while calculations stay usable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  await page.goto(GOKU_OPTIMIZER);
  await expect(
    page.getByText(
      'Local storage is unavailable; changes last for this session.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText('Local storage is unavailable. Saved builds cannot be kept'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save build' })).toBeDisabled();
  await page
    .getByRole('button', { name: 'Compare compatible configurations' })
    .click();
  await expect(page.locator('.cb-search')).toContainText(
    '16 compatible targets evaluated',
  );
  await page.goto('?workbench=catalog');
  await expect(
    page.getByRole('heading', { name: 'Super Saiyan 3 Goku', level: 2 }),
  ).toBeVisible();
});
