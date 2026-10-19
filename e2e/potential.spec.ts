import {
  expect,
  GOKU_OPTIMIZER,
  GOKU_STATE,
  LIBRARY_KEY,
  test,
  WORKING_KEY,
} from './fixtures';

async function selectCharacter(page: import('@playwright/test').Page) {
  await page.goto('./');
  await page.getByLabel('Character and exact state').selectOption(GOKU_STATE);
}
async function profile(page: import('@playwright/test').Page) {
  await page
    .getByLabel('Recommendation scope')
    .selectOption('selected-profile');
}
const result = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Build recommendation' });

test('limited profile comparison is primary, with maintenance secondary and an exact allocation gate', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Dokkan · Profile/equipment comparison');
  await expect(
    page.getByRole('heading', { name: /Find what to change/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'New character', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Character and exact state').selectOption(GOKU_STATE);
  await expect(page.getByLabel('Supported progression')).toHaveValue(
    'goku-s-agl:no-dupes:base-board-filled:v1',
  );
  await page
    .getByRole('button', { name: 'Recommend build', exact: true })
    .click();
  await expect(
    result(page).getByRole('heading', { name: 'Cannot recommend yet' }),
  ).toBeVisible();
  await expect(result(page)).toContainText(
    'Exact selectable node alternatives and increments',
  );
  await expect(result(page)).not.toContainText('15,827');
  await page
    .getByRole('link', { name: 'Character maintenance', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'New character', exact: true }),
  ).toBeVisible();
});

test('scoped catalog recommendation is direct and calculation-backed', async ({
  page,
}) => {
  await selectCharacter(page);
  await profile(page);
  await page.getByLabel('Equipment mode').selectOption('catalog');
  await expect(
    page.getByLabel('Equipment mode').locator('option:checked'),
  ).toHaveText('Best available in catalog');
  await page
    .getByRole('button', { name: 'Recommend build', exact: true })
    .click();
  await expect(
    result(page).getByRole('heading', {
      name: 'Multiple builds tie for this objective',
    }),
  ).toBeVisible();
  await expect(result(page)).toContainText('Card HP: 15,827');
  await expect(result(page)).toContainText('+500');
  await expect(result(page)).toContainText('AGL HP +500 · bronze Lv.5');
  await expect(result(page)).toContainText('4 compatible configurations');
  await expect(result(page)).toContainText(
    'not the missing full allocation graph',
  );
  await result(page).getByText('Search details', { exact: true }).click();
  await expect(result(page)).toContainText(
    '16 combinations checked · 0 rejected before evaluation · 16 evaluated',
  );
  await result(page)
    .getByText('Calculation trace and evidence', { exact: true })
    .click();
  await expect(result(page)).toContainText('15,827');
});

test('inventory quantities and retained current items are consistent', async ({
  page,
}) => {
  await selectCharacter(page);
  await profile(page);
  await page
    .getByRole('button', { name: 'Recommend build', exact: true })
    .click();
  await expect(result(page)).toContainText(
    'Your current build is already best for this objective',
  );
  await expect(result(page)).toContainText('Card HP: 15,327');
  await page
    .getByLabel('AGL HP +500 · bronze Lv.5 unequipped quantity', {
      exact: true,
    })
    .fill('1');
  await page
    .getByRole('button', { name: 'Recommend build', exact: true })
    .click();
  await expect(result(page)).toContainText('Recommended build');
  await expect(result(page)).toContainText('Card HP: 15,827');
  await page
    .getByLabel('Current bronze equipment')
    .selectOption({ label: 'AGL HP +500 · bronze Lv.5' });
  await page
    .getByLabel('AGL HP +500 · bronze Lv.5 unequipped quantity', {
      exact: true,
    })
    .fill('0');
  await page
    .getByRole('button', { name: 'Recommend build', exact: true })
    .click();
  await expect(result(page)).toContainText(
    'Your current build is already best for this objective',
  );
  await expect(result(page)).toContainText('No changes required.');
});

test('incomplete searches say best found and preserve a stronger baseline', async ({
  page,
}) => {
  await selectCharacter(page);
  await profile(page);
  await page.getByLabel('Equipment mode').selectOption('catalog');
  await page
    .getByLabel('Current bronze equipment')
    .selectOption({ label: 'AGL HP +500 · bronze Lv.5' });
  await page
    .getByText('Advanced context, alternative metrics and search limits', {
      exact: true,
    })
    .click();
  await page.getByLabel('Maximum evaluations', { exact: true }).fill('1');
  await page
    .getByRole('button', { name: 'Recommend build', exact: true })
    .click();
  await expect(result(page)).toContainText(
    'Best found so far — search incomplete',
  );
  await expect(result(page)).toContainText('Card HP: 15,827');
  await expect(result(page)).toContainText('No changes required.');
});

test('probability objectives require an explicit unverified-model acknowledgement', async ({
  page,
}) => {
  await selectCharacter(page);
  await profile(page);
  await page.getByLabel('Equipment mode').selectOption('catalog');
  await page.getByLabel('Optimization objective').selectOption('critical');
  await page
    .getByRole('button', { name: 'Recommend build', exact: true })
    .click();
  await expect(result(page)).toContainText(
    'unresolved calculator/RNG convention discrepancy',
  );
  await expect(
    result(page).getByRole('heading', { name: 'Cannot recommend yet' }),
  ).toBeVisible();
  await page
    .getByText('Advanced context, alternative metrics and search limits', {
      exact: true,
    })
    .click();
  await page
    .getByLabel(
      'I accept the source-documented initial-check probability model, not independently confirmed game behavior',
    )
    .check();
  await page
    .getByRole('button', { name: 'Recommend build', exact: true })
    .click();
  await expect(result(page)).toContainText('Critical chance: 4.0%');
  await expect(
    result(page).getByRole('heading', { name: /^Source-model comparison:/ }),
  ).toBeVisible();
  await expect(result(page)).toContainText('+4.0 percentage points');
  await expect(result(page)).toContainText(
    'not an overall-strength, damage or survival conclusion',
  );
});

test('invalid numeric inputs block search and do not mutate legacy settings', async ({
  page,
}) => {
  await page.goto(GOKU_OPTIMIZER);
  const before = await page.evaluate(
    (keys) => keys.map((k) => localStorage.getItem(k)),
    [WORKING_KEY, LIBRARY_KEY],
  );
  await page.goto('./');
  await page.getByLabel('Character and exact state').selectOption(GOKU_STATE);
  await profile(page);
  await page.getByLabel('Equipment mode').selectOption('inventory');
  const quantity = page.getByLabel(
    'AGL HP +500 · bronze Lv.5 unequipped quantity',
    { exact: true },
  );
  await quantity.fill('');
  await expect(quantity).toHaveAttribute('aria-invalid', 'true');
  await expect(
    page.getByRole('button', { name: 'Recommend build', exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      (keys) => keys.map((k) => localStorage.getItem(k)),
      [WORKING_KEY, LIBRARY_KEY],
    ),
  ).toEqual(before);
});

test('coverage and unsupported exact states never imply catalog completeness', async ({
  page,
}) => {
  await page.goto('?workbench=optimizer&state=not-a-real-state');
  await expect(result(page)).toContainText('Cannot recommend yet');
  await expect(result(page)).toContainText('No other state is substituted');
  await page.getByText('Character catalog coverage', { exact: true }).click();
  await expect(
    page.getByText('Unknown source total', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('This is not complete coverage', { exact: false }),
  ).toBeVisible();
});

test('the recorded base state is selectable but refused with its own reason', async ({
  page,
}) => {
  await page.goto('./');
  await page
    .getByLabel('Character and exact state')
    .selectOption('unknown-region:1003211:base:lv120:sa10');
  await expect(result(page)).toContainText('Cannot recommend yet');
  await expect(result(page)).toContainText(
    'No evaluator: the progression profile, eligible equipment and evaluation contexts for this pre-EZA state are not admitted.',
  );
  // The same card's EZA evaluator is never borrowed for this state.
  await expect(
    page.getByRole('button', { name: 'Recommend build', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Supported progression')).toHaveCount(0);

  await page.getByText('Character catalog coverage', { exact: true }).click();
  const count = (label: string) =>
    page
      .locator('dl > div')
      .filter({ has: page.getByText(label, { exact: true }) })
      .locator('dd');
  await expect(count('Exact states')).toHaveText('2');
  await expect(count('Base (pre-EZA) states')).toHaveText('1');
  await expect(count('EZA states')).toHaveText('1');
  await expect(count('States with a limited evaluator')).toHaveText('1');
  await expect(
    page.getByText(
      '2 exact states are currently bundled, each recorded individually; 1 with a limited evaluator.',
    ),
  ).toBeVisible();
});

test('primary named saves remain loadable in the preserved exact-state comparator', async ({
  page,
}) => {
  await selectCharacter(page);
  await profile(page);
  await page.getByLabel('Equipment mode').selectOption('catalog');
  await page
    .getByLabel('Current bronze equipment')
    .selectOption({ label: 'AGL HP +500 · bronze Lv.5' });
  await page
    .getByText('Saved builds and JSON backups', { exact: true })
    .click();
  await page
    .getByLabel('Name for the current settings')
    .fill('Potential current HP');
  await page.getByRole('button', { name: 'Save build', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Saved “Potential current HP”.',
  );
  const saved = await page.evaluate(
    (key) => localStorage.getItem(key),
    LIBRARY_KEY,
  );
  expect(saved).toContain(GOKU_STATE);
  await page.goto(GOKU_OPTIMIZER);
  await page
    .getByRole('button', { name: 'Load Potential current HP', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Load build', exact: true })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Current bronze equip', exact: true }),
  ).toHaveValue('agl:bronze:hp:5');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), LIBRARY_KEY),
  ).toBe(saved);
});

test('keyboard submission and mobile result layout work under the Pages prefix', async ({
  page,
}) => {
  await selectCharacter(page);
  await profile(page);
  await page.getByLabel('Equipment mode').selectOption('catalog');
  const button = page.getByRole('button', {
    name: 'Recommend build',
    exact: true,
  });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(result(page)).toContainText('Card HP: 15,827');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  await page.reload();
  await expect(page.getByLabel('Character and exact state')).toHaveValue(
    GOKU_STATE,
  );
});
