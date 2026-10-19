import { expect, test } from './fixtures';

test('browse the imported LR record, source profiles and exact state without borrowing an evaluator', async ({
  page,
}) => {
  await page.goto('?workbench=catalog');
  await page.getByLabel('Name, title or ID').fill('Broly Cheelai');
  await page.getByLabel('Rarity', { exact: true }).selectOption('LR');
  await page.getByLabel('Type', { exact: true }).selectOption('PHY');
  await page
    .getByLabel('Category', { exact: true })
    .selectOption('Joined Forces');
  await expect(page.locator('.catalog-result-count')).toHaveText(
    '1 card form · 1 matching state',
  );
  await page.locator('.catalog-result').getByRole('button').click();
  const details = page.locator('article.catalog-details');
  await expect(details).toContainText('Broly & Cheelai & Lemo');
  await expect(details).toContainText('mnprojects:card:11900:base:lv150:sa20');
  const tables = page.getByRole('region', {
    name: 'Historical source stat tables',
  });
  await expect(
    tables.getByRole('row', { name: /Source free-dupe column/ }),
  ).toContainText('23,575');
  await expect(
    tables.getByRole('row', { name: /Source rainbow column/ }),
  ).toContainText('26,975');
  await expect(
    tables.getByRole('row', { name: /Source rainbow column/ }),
  ).toContainText('Unknown');
  await expect(details).toContainText('Copied source prose omitted');
  await expect(
    page.getByRole('button', { name: 'Optimize', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(details).toContainText('mnprojects:card:11900:base:lv150:sa20');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test('historical EZA selection does not invent levels, SEZA or Hidden Potential choices', async ({
  page,
}) => {
  await page.goto('?workbench=catalog');
  await page.getByLabel('Name, title or ID').fill('mnprojects:card:11168');
  await page.getByLabel('Awakening state', { exact: true }).selectOption('eza');
  await expect(page.locator('.catalog-result-count')).toHaveText(
    '1 card form · 1 matching state',
  );
  await page.locator('.catalog-result').getByRole('button').click();
  const details = page.locator('article.catalog-details');
  await expect(details).toContainText('EZA · Region unknown · Lv.? / SA?');
  await expect(
    details.getByRole('row', { name: /Raw card stats/ }),
  ).toContainText('Unavailable');
  await expect(
    details.getByRole('region', { name: 'Historical source stat tables' }),
  ).toHaveCount(0);
  await page
    .getByLabel('Awakening state', { exact: true })
    .selectOption('seza');
  await expect(page.locator('.catalog-result-count')).toHaveText(
    '0 card forms · 0 matching states',
  );
});

test('full source is paginated and carries attribution, license and explicit exclusions', async ({
  page,
}) => {
  await page.goto('?workbench=catalog');
  await expect(page.locator('.catalog-result')).toHaveCount(50);
  await expect(page.locator('.catalog-result-count')).toContainText(
    '794 matching card forms',
  );
  await page.getByRole('button', { name: 'Show 50 more' }).click();
  await expect(page.locator('.catalog-result')).toHaveCount(100);
  await expect(page.locator('#character-catalog')).toContainText(
    'MNprojects / Michael Nash',
  );
  const download = page.waitForEvent('download');
  await page
    .getByRole('link', { name: 'AGPL-3.0 license copy', exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe('MNprojects-AGPL-3.0.txt');
  await page
    .getByText('Coverage, evidence definitions and snapshot provenance', {
      exact: true,
    })
    .click();
  await expect(page.locator('#character-catalog')).toContainText(
    '796 source rows reconciled: 793 accepted, 3 excluded',
  );
  await page.getByText('Excluded source records', { exact: true }).click();
  await expect(page.locator('#character-catalog')).toContainText(
    'Conflicting source ID 12521',
  );
  await expect(page.locator('#character-catalog')).toContainText(
    'Non-character Zeni material',
  );
});
