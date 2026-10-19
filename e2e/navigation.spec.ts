import { expect, GOKU_OPTIMIZER, test } from './fixtures';

const SYNTHETIC = 'Synthetic demonstration — not real Dokkan recommendations.';

test('navigation keeps the Pages prefix and marks the current page', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Dokkan Potential Optimizer');
  const nav = page.getByRole('navigation', { name: 'Main' });
  // Three destinations; secondary workbenches live under Tools.
  await expect(nav.getByRole('link')).toHaveText([
    'Optimize',
    'Characters',
    'Tools',
  ]);
  await expect(nav.getByRole('link', { name: 'Optimize' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await nav.getByRole('link', { name: 'Tools' }).click();
  await expect(page).toHaveURL(/\/dokkan-optimizer\/\?workbench=tools$/);
  await expect(page).toHaveTitle('Tools · Dokkan Potential Optimizer');
  await page.getByRole('link', { name: 'Source build examples' }).click();
  await expect(page).toHaveURL(
    /\/dokkan-optimizer\/\?workbench=character-build$/,
  );
  await expect(page).toHaveTitle(
    'Source build examples · Dokkan Potential Optimizer',
  );
  await expect(nav.getByRole('link', { name: 'Tools' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await nav.getByRole('link', { name: 'Tools' }).click();
  await page.getByRole('link', { name: 'Legacy synthetic team demo' }).click();
  await expect(page).toHaveURL(/\/dokkan-optimizer\/\?workbench=legacy-team$/);
  await expect(page).toHaveTitle(
    'Legacy synthetic team demo · Dokkan Potential Optimizer',
  );

  await nav.getByRole('link', { name: 'Tools' }).click();
  await page.getByRole('link', { name: 'Character maintenance' }).click();
  await expect(page).toHaveURL(/\/dokkan-optimizer\/\?workbench=definitions$/);

  await nav.getByRole('link', { name: 'Characters' }).click();
  await expect(page).toHaveURL(/\/dokkan-optimizer\/\?workbench=catalog$/);
  await expect(page).toHaveTitle('Characters · Dokkan Potential Optimizer');
});

test('production assets load from the Pages prefix', async ({ page }) => {
  const assets: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/assets/'))
      assets.push(new URL(response.url()).pathname);
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(assets.some((path) => path.endsWith('.js'))).toBe(true);
  expect(assets.some((path) => path.endsWith('.css'))).toBe(true);
  expect(
    assets.every((path) => path.startsWith('/dokkan-optimizer/assets/')),
  ).toBe(true);
});

test('legacy demo keeps its exact warning and reference search', async ({
  page,
}) => {
  await page.goto('?workbench=legacy-team');
  await expect(page.getByText(SYNTHETIC, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Generate teams/ }).click();
  await expect(page.getByText('21 eligible', { exact: true })).toBeVisible();
});

test('genuine character pages do not carry the synthetic warning', async ({
  page,
}) => {
  for (const path of ['./', GOKU_OPTIMIZER]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(SYNTHETIC)).toHaveCount(0);
  }
});

test('no page scrolls horizontally', async ({ page }) => {
  for (const path of [
    './',
    '?workbench=catalog',
    '?workbench=definitions',
    '?workbench=character-build',
    GOKU_OPTIMIZER,
    '?workbench=legacy-team',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test('test-only characters are not shipped in the production bundle', async ({
  page,
  request,
}) => {
  const scripts: string[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.endsWith('.js'))
      scripts.push(response.url());
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(scripts.length).toBeGreaterThan(0);
  for (const url of scripts) {
    const body = await (await request.get(url)).text();
    expect(body).not.toContain('TEST ONLY');
    expect(body).not.toContain('test-only-node-v1');
  }
});
