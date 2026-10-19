import type { Page } from '@playwright/test';
import { expect, test, WORKING_KEY, GOKU_OPTIMIZER } from './fixtures';

// Expected values are the hand-checked figures documented in README.md.
const open = async (page: Page) => {
  await page.goto(GOKU_OPTIMIZER);
  await expect(page.locator('.cb-search')).toBeVisible();
};
const compare = (page: Page) =>
  page.getByRole('button', { name: 'Compare legal builds' }).click();
const rows = (page: Page) => page.locator('.cb-table tbody tr');
const search = (page: Page) => page.locator('.cb-search');

test('default comparison enumerates 16 targets with the documented baseline', async ({
  page,
}) => {
  await open(page);
  await expect(search(page)).toContainText(
    '16 legal targets evaluated · 16 distinct evaluations',
  );
  const baseline = page.locator('.cb-baseline');
  for (const value of ['13,911', '8,596', '15,327', '5.0%'])
    await expect(baseline).toContainText(value);
  await expect(rows(page)).toHaveCount(16);
  // One "Explain #1" control per rank-1 row: four exact ties.
  await expect(
    page.getByRole('button', { name: 'Explain #1', exact: true }),
  ).toHaveCount(4);
  await expect(rows(page).filter({ hasText: 'FRONTIER' })).toHaveCount(9);
  await expect(page.locator('#space-estimate')).toContainText(
    '4 bronze × 4 silver × 1 gold option (each including empty) × 1 allocation = 16 targets at most',
  );
  // Unsupported metrics are not offered as objectives.
  await expect(
    page.getByLabel('Sort by supported objective').locator('option'),
  ).toHaveText([
    'Card ATK',
    'Card DEF',
    'Card HP',
    'Initial extra Super',
    'Critical chance',
    'Evasion chance',
  ]);
});

test('current equips change the baseline and labelled deltas', async ({
  page,
}) => {
  await open(page);
  await page
    .getByLabel('Current silver equip')
    .selectOption({ label: 'Additional Attack +2 · silver' });
  await expect(page.getByText('Inputs changed. Compare again')).toBeVisible();
  await compare(page);
  await expect(page.locator('.cb-baseline')).toContainText('7.0%');
  const emptySilver = rows(page).filter({
    hasText: /Empty\s*Empty/,
  });
  // 5% vs 7%: −2 percentage points, −28.6% relative.
  await expect(emptySilver).toContainText('−2.0 pp (−28.6% rel.)');
  const atkCrit = rows(page).filter({
    hasText: /AGL ATK \+500 · bronze Lv\.5\s*Critical Hit \+2 · silver/,
  });
  await expect(atkCrit).toContainText('+500 (+3.59%)');
  await expect(atkCrit).toContainText('+4.0 pp (rel. n/a: 0% baseline)');
});

test('inventory mode restricts targets while current equips can be retained', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Use my inventory quantities').check();
  await compare(page);
  await expect(search(page)).toContainText('1 legal targets evaluated');
  await page
    .getByLabel('Unequipped copies: AGL ATK +500 · bronze Lv.5')
    .fill('1');
  await page
    .getByLabel('Current silver equip')
    .selectOption({ label: 'Critical Hit +2 · silver' });
  await compare(page);
  // bronze {empty, ATK} × silver {empty, retained critical}
  await expect(search(page)).toContainText('4 legal targets evaluated');
});

test('evasion-disabled context groups 16 targets into 12 evaluations', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Incoming-attack assumption').selectOption('disabled');
  await compare(page);
  await expect(search(page)).toContainText(
    '16 legal targets evaluated · 12 distinct evaluations',
  );
});

test('truncation is disclosed and makes no global claim', async ({ page }) => {
  await open(page);
  await page.getByLabel('Candidate limit').fill('2');
  await expect(page.locator('#space-estimate')).toContainText(
    'search may be truncated',
  );
  await compare(page);
  await expect(page.getByRole('alert')).toContainText(
    'Search truncated at 2 targets; total legal count is unknown.',
  );
});

test('invalid inputs are reported on their fields and block comparison', async ({
  page,
}) => {
  await open(page);
  const limit = page.getByLabel('Candidate limit');
  await limit.fill('');
  await expect(limit).toHaveAttribute('aria-invalid', 'true');
  await expect(limit).toHaveAccessibleDescription(
    /Enter a whole number from 1 to 20,000/,
  );
  const quantity = page.getByLabel(
    'Unequipped copies: AGL HP +500 · bronze Lv.5',
  );
  await quantity.fill('1.5');
  await expect(quantity).toHaveAccessibleDescription(
    'Enter a whole number from 0 to 999.',
  );
  await expect(
    page.getByText('Not saved: fix the highlighted input.'),
  ).toBeVisible();
  await compare(page);
  await expect(page.getByRole('alert').first()).toContainText(
    'Fix 2 highlighted inputs before comparing.',
  );
  await expect(page.locator('.cb-results')).toHaveCount(0);
  // Saving is refused too, rather than storing the last valid limit silently.
  await page.getByLabel('Name for the current settings').fill('Invalid');
  await page.getByRole('button', { name: 'Save build' }).click();
  await expect(
    page.getByText(
      'Only valid settings can be saved. Fix the highlighted inputs.',
    ),
  ).toBeVisible();

  await quantity.fill('0');
  await limit.fill('16');
  await page.getByLabel(/Hidden Potential is already unlocked/).uncheck();
  await expect(
    page.getByText('Required: this evaluator supports only an unlocked system'),
  ).toBeVisible();
  await compare(page);
  await expect(page.locator('.cb-results')).toHaveCount(0);
});

test('an invalid field pauses autosave so no hidden value is stored', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Candidate limit').fill('');
  await page
    .getByLabel('Current silver equip')
    .selectOption({ label: 'Critical Hit +2 · silver' });
  await expect(
    page.getByText('Not saved: fix the highlighted input.'),
  ).toBeVisible();
  await page.reload();
  // Nothing after the invalid edit was stored.
  await expect(page.getByLabel('Current silver equip')).toHaveValue('');
  await expect(page.getByLabel('Candidate limit')).toHaveValue('20000');
});

test('settings persist across reload and navigation without touching other keys', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() =>
    window.localStorage.setItem(
      'dokkan-team-lab.collection.v1',
      'legacy-owned',
    ),
  );
  await page
    .getByLabel('Current silver equip')
    .selectOption({ label: 'Critical Hit +2 · silver' });
  await page.getByLabel('Use my inventory quantities').check();
  await page.reload();
  await expect(page.getByLabel('Current silver equip')).toHaveValue(
    'generic:silver:critical:2',
  );
  await expect(page.getByLabel('Use my inventory quantities')).toBeChecked();
  // The catalog only reads the working key; it never writes it.
  await page.goto('./');
  await page.goto(GOKU_OPTIMIZER);
  await expect(page.getByLabel('Current silver equip')).toHaveValue(
    'generic:silver:critical:2',
  );
  const stored = await page.evaluate(
    (key) => [
      window.localStorage.getItem(key),
      window.localStorage.getItem('dokkan-team-lab.collection.v1'),
    ],
    WORKING_KEY,
  );
  expect(JSON.parse(stored[0]!)).toMatchObject({
    version: 1,
    catalogRevision: 'goku-initial-check-2026-10-18.1',
  });
  expect(stored[1]).toBe('legacy-owned');
});

test('keyboard users can submit and the identity bar follows scrolling', async ({
  page,
}) => {
  await open(page);
  const bar = page.locator('.cb-identity-bar');
  // Hidden while the full identity card is on screen.
  await expect(bar).toBeHidden();
  await page.getByLabel('Candidate limit').focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('20000');
  await page.keyboard.press('Enter');
  await expect(search(page)).toContainText('16 legal targets evaluated');
  await page.locator('.cb-results').scrollIntoViewIfNeeded();
  await expect(bar).toBeVisible();
  await expect(bar).toContainText(
    'EZA step 7 · without Super EZA · Lv.140 · SA15',
  );
});

test('results fit the viewport without horizontal table scrolling on narrow screens', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'narrow-layout check');
  await open(page);
  const wrap = page.locator('.cb-table-wrap');
  const overflow = await wrap.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // Card layout keeps table relationships for assistive technology...
  const table = page.getByRole('table', { name: /Sorted by/ });
  await expect(table.getByRole('columnheader')).toHaveCount(7);
  const first = table.getByRole('row').nth(1);
  await expect(first.getByRole('rowheader')).toHaveCount(1);
  await expect(first.getByRole('cell')).toHaveCount(6);
  // ...and a visible metric label on every cell.
  const labels = await first
    .getByRole('cell')
    .evaluateAll((cells) =>
      cells.map((cell) => getComputedStyle(cell, '::before').content),
    );
  expect(labels).toEqual([
    '"Card ATK"',
    '"Card DEF"',
    '"Card HP"',
    '"Initial extra Super"',
    '"Critical chance"',
    '"Evasion chance"',
  ]);
});
