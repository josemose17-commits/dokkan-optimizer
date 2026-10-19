import { expect, GOKU_OPTIMIZER, GOKU_STATE, test } from './fixtures';

const GOHAN = 'unknown-region:1020091:eza:lv140:sa15';

test('one workspace with a compact secondary menu, not competing workbench tabs', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Dokkan Potential Optimizer');
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  await page.getByText('Menu', { exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Secondary' });
  await expect(nav.getByRole('link')).toHaveText([
    'Add, edit or import character data',
    'Character details and catalog import',
    'About and sources',
  ]);
  await nav
    .getByRole('link', { name: 'Add, edit or import character data' })
    .click();
  await expect(page).toHaveURL(/\/dokkan-optimizer\/\?workbench=definitions$/);
  await expect(page).toHaveTitle(
    'Character maintenance · Dokkan Potential Optimizer',
  );
});

test('retired URLs redirect intentionally and preserve exact states and browser storage', async ({
  page,
}) => {
  await page.goto('./');
  await page.evaluate(() =>
    localStorage.setItem('dokkan-team-lab.collection.v1', 'older-team-data'),
  );
  for (const path of [
    '?workbench=legacy-team',
    '?workbench=tools',
    `?workbench=character-build&state=${encodeURIComponent(GOKU_STATE)}`,
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/workbench=optimizer/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Build around the character’s kit.',
    );
    await expect(
      page.getByRole('button', { name: /Generate teams/ }),
    ).toHaveCount(0);
  }
  await expect(page.getByLabel('Character and exact state')).toHaveValue(
    GOKU_STATE,
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem('dokkan-team-lab.collection.v1'),
    ),
  ).toBe('older-team-data');
  await page.goto(`?state=${encodeURIComponent(GOHAN)}`);
  await expect(page).toHaveURL(/workbench=optimizer/);
  await expect(page.locator('#character-catalog')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Character analysis' }),
  ).toBeVisible();
});

test('production assets load from the Pages prefix; removed demo and test fixtures are absent', async ({
  page,
  request,
}) => {
  const assets: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/assets/')) assets.push(response.url());
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(assets.some((path) => path.endsWith('.js'))).toBe(true);
  expect(assets.some((path) => path.endsWith('.css'))).toBe(true);
  expect(
    assets.every((url) =>
      new URL(url).pathname.startsWith('/dokkan-optimizer/assets/'),
    ),
  ).toBe(true);
  for (const url of assets.filter((url) => url.endsWith('.js'))) {
    const body = await (await request.get(url)).text();
    for (const removed of [
      'test-only-node-v1',
      'TEST ONLY',
      'Generate teams',
      'Synthetic demonstration — not real Dokkan recommendations.',
    ])
      expect(body).not.toContain(removed);
  }
});

test('primary, browsing and maintenance layouts fit the viewport', async ({
  page,
}) => {
  for (const path of [
    './',
    '?workbench=catalog',
    '?workbench=definitions',
    GOKU_OPTIMIZER,
    `?workbench=optimizer&state=${encodeURIComponent(GOHAN)}`,
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
      path,
    ).toBeLessThanOrEqual(0);
  }
});
