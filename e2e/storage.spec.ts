import { readFile } from 'node:fs/promises';
import {
  expect,
  test,
  WORKING_KEY,
  LEGACY_KEY,
  GOKU_OPTIMIZER,
} from './fixtures';

test('corrupt older working settings remain downloadable and no longer autosave over them', async ({
  page,
}) => {
  await page.goto(GOKU_OPTIMIZER);
  await page.evaluate(
    ([working, legacy]) => {
      localStorage.setItem(working!, 'not-json');
      localStorage.setItem(legacy!, 'legacy-owned');
    },
    [WORKING_KEY, LEGACY_KEY],
  );
  await page.reload();
  await expect(
    page.getByText(/Saved character settings could not be read/),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download stored settings copy' })
    .click();
  expect(await readFile((await (await downloadPromise).path())!, 'utf8')).toBe(
    'not-json',
  );
  await page
    .getByLabel('Current silver equipment')
    .selectOption('generic:silver:critical:2');
  await page.getByRole('radio', { name: /^Critical chance/ }).check();
  await page.getByRole('button', { name: 'Optimize', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Optimize and result' }),
  ).toContainText('4.0% (no change)');
  await page.goto('?workbench=catalog');
  await page.goto(GOKU_OPTIMIZER);
  expect(
    await page.evaluate(
      ([working, legacy]) => [
        localStorage.getItem(working!),
        localStorage.getItem(legacy!),
      ],
      [WORKING_KEY, LEGACY_KEY],
    ),
  ).toEqual(['not-json', 'legacy-owned']);
});

test('blocked storage is reported while calculations and factual browsing stay usable', async ({
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
      /Local storage is unavailable; changes last for this session./,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/Local storage is unavailable. Saved builds cannot be kept/),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save build' })).toBeDisabled();
  await page.getByRole('radio', { name: /^Critical chance/ }).check();
  await page.getByRole('button', { name: 'Optimize', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Optimize and result' }),
  ).toContainText('0.0% → 4.0%');
  await page.goto('?workbench=catalog');
  await expect(
    page.getByRole('heading', { name: 'Super Saiyan 3 Goku', level: 2 }),
  ).toBeVisible();
});
