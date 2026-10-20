import {
  expect,
  test,
  GOKU_OPTIMIZER,
  WORKING_KEY,
  LIBRARY_KEY,
} from './fixtures';

test('opt-in event sequence uses the existing search, preserves ties, and explains event timing', async ({
  page,
}) => {
  await page.goto(GOKU_OPTIMIZER);
  await page.getByLabel('Evaluation model').selectOption('event-sequence-v1');
  await expect(page.locator('input[name="objective"]:checked')).toHaveCount(0);
  await expect(
    page.getByRole('radio', { name: /^Expected Supers in sequence/ }),
  ).toBeEnabled();
  await page
    .getByRole('radio', { name: /^Expected Supers in sequence/ })
    .check();
  await page.getByRole('button', { name: 'Optimize', exact: true }).click();
  const result = page.getByRole('region', { name: 'Optimize and result' });
  await expect(
    result.getByRole('heading', { name: 'Multiple builds tie.', exact: true }),
  ).toBeVisible();
  await expect(result).toContainText('1.05 → 1.07 (+0.02)');
  await expect(result).toContainText('4 configurations tie.');
  await result.getByText('Event timing and branches', { exact: true }).click();
  await expect(
    result.getByRole('heading', { name: 'Event sequence trace' }),
  ).toBeVisible();
  await expect(
    result.getByRole('region', { name: 'Event timing table' }),
  ).toContainText('super-activation');
  await expect(
    result.getByRole('region', { name: 'Event timing table' }),
  ).toContainText('damage-calculation');
  await expect(result).toContainText('probability mass 1.0000000000');
  await expect(
    page.getByText(
      'Full allocation support not available for this character yet.',
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test('later appearances, context edits and returning to v1 update results without stale output', async ({
  page,
}) => {
  await page.goto(GOKU_OPTIMIZER);
  await page.getByLabel('Evaluation model').selectOption('event-sequence-v1');
  await page
    .getByRole('radio', { name: /^Expected Supers in sequence/ })
    .check();
  await page
    .getByLabel('Supplied sequence', { exact: true })
    .selectOption('goku-sequence:two-appearances');
  await page.getByRole('button', { name: 'Optimize', exact: true }).click();
  const result = page.getByRole('region', { name: 'Optimize and result' });
  await expect(result).toContainText('2.1 → 2.14 (+0.04)');
  await page
    .getByLabel('Incoming attacks are evadable in this sequence')
    .uncheck();
  await expect(
    result.getByRole('heading', { name: 'Your recommendation appears here.' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: /^Expected evaded attacks/ }).check();
  await page.getByRole('button', { name: 'Optimize', exact: true }).click();
  await expect(result).toContainText('Your current build is already best');
  await page.getByLabel('Evaluation model').selectOption('initial-check-v1');
  await expect(page.locator('input[name="objective"]:checked')).toHaveCount(0);
  await expect(page.locator('input[name="objective"]')).toHaveCount(6);
  await page.getByRole('radio', { name: /^Critical chance/ }).check();
  await page.getByRole('button', { name: 'Optimize', exact: true }).click();
  await expect(result).toContainText('0.0% → 4.0%');
});

test('sequence named saves round-trip without rewriting old working settings', async ({
  page,
}) => {
  await page.goto(GOKU_OPTIMIZER);
  await page.evaluate(
    (key) => localStorage.setItem(key, 'keep the original working settings'),
    WORKING_KEY,
  );
  await page.getByLabel('Evaluation model').selectOption('event-sequence-v1');
  await page
    .getByLabel('Supplied sequence', { exact: true })
    .selectOption('goku-sequence:two-appearances');
  await page
    .getByRole('radio', { name: /^Expected Supers in sequence/ })
    .check();
  await page
    .getByLabel('Name for the current settings')
    .fill('Two-appearance events');
  await page.getByRole('button', { name: 'Save build', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Saved “Two-appearance events”.',
  );
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    LIBRARY_KEY,
  );
  expect(stored).toContain('event-sequence-v1');
  expect(stored).toContain('goku-sequence:two-appearances');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), WORKING_KEY),
  ).toBe('keep the original working settings');
  await page.reload();
  await page
    .getByRole('button', { name: 'Load Two-appearance events', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Load build', exact: true })
    .click();
  await expect(page.getByLabel('Evaluation model')).toHaveValue(
    'event-sequence-v1',
  );
  await expect(
    page.getByLabel('Supplied sequence', { exact: true }),
  ).toHaveValue('goku-sequence:two-appearances');
  await page.getByRole('button', { name: 'Optimize', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Optimize and result' }),
  ).toContainText('2.1 → 2.14 (+0.04)');
});

test('real UI Goku has a bounded native entry preview with explicit missing mechanics', async ({
  page,
}) => {
  await page.goto(
    '?workbench=optimizer&state=unknown-region%3A1020311%3Aeza%3Alv150%3Asa25',
  );
  await expect(
    page.getByText(
      'Additional Evasion cannot improve an active native evasion guarantee; keep the remaining build tradeoff unresolved.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Optimize', exact: true }),
  ).toHaveCount(0);
  const panel = page.locator('details[aria-label="Character event mechanics"]');
  await panel
    .getByText('Character event mechanics · support and timing', {
      exact: true,
    })
    .click();
  await panel.getByLabel('Preview metric').selectOption('evadedAttacks');
  await panel
    .getByRole('button', { name: 'Evaluate native event', exact: true })
    .click();
  await expect(panel.getByRole('status')).toContainText(
    'Expected evaded attacks: 1',
  );
  await expect(panel).toContainText('Expected critical attacks: Unavailable');
  await panel
    .getByLabel('Incoming attack is evadable in this preview')
    .uncheck();
  await expect(panel.getByRole('status')).toHaveCount(0);
  await panel
    .getByRole('button', { name: 'Evaluate native event', exact: true })
    .click();
  await expect(panel.getByRole('status')).toContainText(
    'Expected evaded attacks: 0',
  );
  await panel
    .getByText('Recorded / structured / implemented / supported context', {
      exact: true,
    })
    .click();
  await expect(
    panel.getByRole('columnheader', { name: 'Implementation', exact: true }),
  ).toBeVisible();
  await expect(panel).toContainText('ui-18-ki-attack');
  await panel.getByLabel('Preview scenario').selectOption('1');
  await panel.getByLabel('Preview metric').selectOption('expectedSupers');
  await panel
    .getByRole('button', { name: 'Evaluate native event', exact: true })
    .click();
  await expect(panel.getByRole('status')).toContainText(
    'Expected Supers in sequence: 1.77',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test('Gohan event records preserve material gates and never borrow the Goku evaluator', async ({
  page,
}) => {
  await page.goto(
    '?workbench=optimizer&state=unknown-region%3A1020091%3Aeza%3Alv140%3Asa15',
  );
  const panel = page.locator('details[aria-label="Character event mechanics"]');
  await panel
    .getByText('Character event mechanics · support and timing', {
      exact: true,
    })
    .click();
  await expect(panel).toContainText('Expected Supers in sequence: Unavailable');
  await expect(panel).toContainText('Modelled DEF raise: Unavailable');
  await expect(
    panel.getByRole('button', { name: 'Evaluate native event', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Optimize', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      'Additional-led priorities for the untransformed defensive buildup role.',
      { exact: true },
    ),
  ).toBeVisible();
});

test('editing sequence context during cooperative search invalidates its pending result', async ({
  page,
}) => {
  await page.goto(GOKU_OPTIMIZER);
  await page.getByLabel('Evaluation model').selectOption('event-sequence-v1');
  await page
    .getByRole('radio', { name: /^Expected Supers in sequence/ })
    .check();
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Optimize',
    )!;
    button.click();
    const sequence = document.querySelector<HTMLSelectElement>(
      'select[aria-label="Supplied sequence"]',
    )!;
    sequence.value = 'goku-sequence:two-appearances';
    sequence.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const result = page.getByRole('region', { name: 'Optimize and result' });
  await expect(
    result.getByRole('heading', { name: 'Your recommendation appears here.' }),
  ).toBeVisible();
  await page.waitForTimeout(100);
  await expect(
    result.getByRole('heading', { name: 'Your recommendation appears here.' }),
  ).toBeVisible();
  await expect(
    page.getByLabel('Supplied sequence', { exact: true }),
  ).toHaveValue('goku-sequence:two-appearances');
});
