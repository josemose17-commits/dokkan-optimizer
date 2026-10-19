import type { Page } from '@playwright/test';
import {
  expect,
  GOKU_OPTIMIZER,
  GOKU_STATE,
  LIBRARY_KEY,
  test,
  WORKING_KEY,
} from './fixtures';

// The primary optimizer: character → current build → goal → result.
const OPTIMIZER = `?workbench=optimizer&state=${encodeURIComponent(GOKU_STATE)}&saved=1`;
const BASE_STATE = 'unknown-region:1003211:base:lv120:sa10';
const output = (page: Page) =>
  page.getByRole('region', { name: 'Optimize and result' });
const heading = (page: Page) => output(page).getByRole('heading', { level: 2 });
const optimize = (page: Page) =>
  page.getByRole('button', { name: 'Optimize', exact: true }).click();
const goal = (page: Page, name: string) =>
  page.getByRole('radio', { name: new RegExp(`^${name}`) }).check();

test('the main journey: character, current build, goal, result, save and reload', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Dokkan Potential Optimizer');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Build around the character’s kit.',
  );
  await page
    .getByRole('button', { name: /^Super Saiyan 3 Goku · AGL UR · EZA step 7/ })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`state=${encodeURIComponent(GOKU_STATE)}$`),
  );

  // What this character can do is shown before any search.
  const support = page.getByRole('list', {
    name: 'What this character supports',
  });
  await expect(support).toContainText(
    'Full allocation support not available for this character yet.',
  );
  await expect(support).toContainText(
    '3 bronze · 3 silver · gold: none recorded',
  );
  await support.getByText('Why, and what you can do').click();
  await expect(support).toContainText(
    'Exact selectable node alternatives and increments',
  );

  // One documented progression is a summary, never a one-option selector.
  await expect(
    page.getByRole('radio', { name: 'Documented profile' }),
  ).toBeChecked();
  await expect(
    page.getByText('55% · base board filled · no duplicate routes', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: /progression|scope/i }),
  ).toHaveCount(0);

  // Current build: an Evasion orb in silver.
  await page
    .getByLabel('Current silver equipment')
    .selectOption({ label: 'Evasion +2 · silver' });
  // Candidate equipment: my items, with one spare Critical Hit orb.
  await page.getByRole('radio', { name: 'Use my equipment' }).check();
  await expect(page.getByText('No spare items entered yet')).toBeVisible();
  await page.getByText('Edit spare items').click();
  await page.getByLabel('Critical Hit +2 · silver spare copies').fill('1');
  await expect(
    page.getByText('Spare items: 1 × Critical Hit +2 · silver.'),
  ).toBeVisible();

  // Goal: Critical chance, labeled experimental.
  await expect(output(page)).toContainText('Choose an objective in step 3.');
  await goal(page, 'Critical chance');
  await optimize(page);

  await expect(heading(page)).toHaveText('Recommended build.');
  await expect(heading(page)).toBeFocused();
  await expect(output(page)).toContainText('Experimental');
  await expect(output(page)).toContainText(
    '0.0% → 4.0% (+4.0 percentage points)',
  );
  await expect(
    output(page).getByRole('list').filter({ hasText: 'Silver:' }),
  ).toHaveText('Silver: Evasion +2 · silver → Critical Hit +2 · silver');
  // Potential and equipment levels are shown separately from the total.
  const critical = output(page).getByRole('row', { name: /^Critical Hit/ });
  await expect(critical.getByRole('cell')).toHaveText(['0', '+2', '2']);
  await expect(output(page)).toContainText(
    'Critical Hit: 0 from Hidden Potential + 2 from equipment = 2 levels.',
  );
  await expect(output(page)).toContainText(
    'Critical chance = 2 (Critical Hit levels) × 2.0% (chance per level) = 4.0%.',
  );

  // Save, reload and load: the exact state and inputs come back.
  await page
    .getByText('Saved builds · save, load or export', { exact: true })
    .click();
  await page.getByLabel('Name for the current settings').fill('Crit swap');
  await page.getByRole('button', { name: 'Save build', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved “Crit swap”.');
  await page.reload();
  await page
    .getByText('Saved builds · save, load or export', { exact: true })
    .click();
  await expect(page.getByLabel('Character and exact state')).toHaveValue(
    GOKU_STATE,
  );
  await page
    .getByRole('button', { name: 'Load Crit swap', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Load build', exact: true })
    .click();
  await expect(page.getByLabel('Current silver equipment')).toHaveValue(
    'generic:silver:evasion:2',
  );
  await expect(
    page.getByRole('radio', { name: /^Critical chance/ }),
  ).toBeChecked();
  await expect(
    page.getByRole('radio', { name: 'Use my equipment' }),
  ).toBeChecked();
  await optimize(page);
  await expect(heading(page)).toHaveText('Recommended build.');
});

test('your own current values are labeled once and evaluated as entered', async ({
  page,
}) => {
  await page.goto(OPTIMIZER);
  await page.getByRole('radio', { name: 'My current values' }).check();
  await expect(
    page.getByText('Board requirements not checked.', { exact: true }),
  ).toHaveCount(1);
  // Starts from the documented profile: nothing changes until edited.
  await expect(page.getByLabel('Additional Attack levels')).toHaveValue('5');
  await expect(page.getByLabel('ATK addition')).toHaveValue('2800');
  await page.getByLabel('Critical Hit levels').fill('3');
  await goal(page, 'Critical chance');
  await optimize(page);
  await expect(output(page)).toContainText(
    'Your entered values · equipment search',
  );
  await expect(output(page)).toContainText(
    '6.0% → 10.0% (+4.0 percentage points)',
  );
  await expect(output(page)).toContainText(
    'Critical Hit: 3 from Hidden Potential + 2 from equipment = 5 levels.',
  );

  // An out-of-range value is reported on its field and blocks the search.
  await page.getByLabel('Evasion levels').fill('41');
  await expect(
    page.getByText('Enter a whole number from 0 to 40.'),
  ).toBeVisible();
  await expect(heading(page)).toHaveText('Your recommendation appears here.');
  await optimize(page);
  await expect(page.getByLabel('Evasion levels')).toBeFocused();
  await expect(heading(page)).toHaveText('Your recommendation appears here.');
});

test('current build wins, ties and incomplete searches are stated plainly', async ({
  page,
}) => {
  await page.goto(OPTIMIZER);
  await page
    .getByLabel('Current silver equipment')
    .selectOption({ label: 'Critical Hit +2 · silver' });
  await goal(page, 'Critical chance');
  await optimize(page);
  await expect(heading(page)).toHaveText(
    'Your current build is already best for Critical chance.',
  );
  await expect(output(page)).toContainText(
    '3 other configurations reach the same value.',
  );
  await expect(output(page)).toContainText(
    'No changes: keep your current build.',
  );

  await page.getByLabel('Current silver equipment').selectOption('');
  await optimize(page);
  await expect(heading(page)).toHaveText('Multiple builds tie.');
  await expect(output(page)).toContainText(
    '4 configurations tie. Your current build is not among them; the one shown needs the fewest changes.',
  );

  await page.getByText('Advanced search settings').click();
  await page.getByLabel('Maximum combinations checked').fill('1');
  await optimize(page);
  await expect(heading(page)).toHaveText('Best found.');
  await expect(output(page)).toContainText(
    'The search stopped early because the combination limit was reached.',
  );
  await output(page).getByText('Search completeness').click();
  await expect(output(page)).toContainText(
    'Incomplete: a better build may exist',
  );
});

test('objectives are grouped by model status; damage and survival are not offered', async ({
  page,
}) => {
  await page.goto(OPTIMIZER);
  const objectives = page.getByRole('group', { name: 'Objective' });
  await expect(objectives.getByRole('radio')).toHaveCount(6);
  await expect(
    objectives.getByText('Supported', { exact: true }),
  ).toBeVisible();
  await expect(
    objectives.getByText('Experimental', { exact: true }),
  ).toBeVisible();
  await expect(objectives).toContainText(
    'Expected damage: Needs verified damage stages',
  );
  await expect(objectives).toContainText('Damage taken and survival:');
  // No objective is preselected for a new session.
  await expect(objectives.getByRole('radio', { checked: true })).toHaveCount(0);

  // The evasion context sits next to the evasion objective.
  await expect(
    page.getByLabel(/The incoming attack can be evaded/),
  ).toHaveCount(0);
  await goal(page, 'Evasion chance');
  const context = page.getByLabel(/The incoming attack can be evaded/);
  await expect(context).toBeChecked();
  await context.uncheck();
  await optimize(page);
  await expect(output(page)).toContainText(
    'Evasion chance = 0.0% (Fixed at 0 by the explicit context: evasion disabled.).',
  );
});

test('an unsupported state is explained before any search, without substitution', async ({
  page,
}) => {
  await page.goto(
    `?workbench=optimizer&state=${encodeURIComponent(BASE_STATE)}`,
  );
  const refusal = page.getByRole('region', { name: 'Build recommendation' });
  await expect(refusal.getByRole('heading')).toHaveText('Not supported yet');
  await expect(refusal).toContainText(
    'No evaluator: the progression profile, eligible equipment and evaluation contexts for this pre-EZA state are not admitted.',
  );
  await expect(
    page.getByRole('button', { name: 'Optimize', exact: true }),
  ).toHaveCount(0);
  await page.goto('?workbench=optimizer&state=not-a-real-state');
  await expect(refusal).toContainText(
    'State not-a-real-state is not in this catalog. No other state is substituted.',
  );
  await refusal
    .getByRole('link', { name: /^Compare equipment for Super Saiyan 3 Goku/ })
    .click();
  await expect(page.getByLabel('Character and exact state')).toHaveValue(
    GOKU_STATE,
  );
});

test('saved builds stay compatible with the consolidated workspace and older settings', async ({
  page,
}) => {
  await page.goto(OPTIMIZER);
  await page.evaluate(
    (key) => localStorage.setItem(key, 'older settings'),
    WORKING_KEY,
  );
  await page
    .getByLabel('Current bronze equipment')
    .selectOption({ label: 'AGL HP +500 · bronze Lv.5' });
  await goal(page, 'Card HP');
  await page.getByLabel('Name for the current settings').fill('Documented HP');
  await page.getByRole('button', { name: 'Save build', exact: true }).click();
  await page.getByRole('radio', { name: 'My current values' }).check();
  await page.getByLabel('Name for the current settings').fill('My values');
  await page.getByRole('button', { name: 'Save build', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved “My values”.');
  // The optimizer never writes the older working settings.
  expect(
    await page.evaluate((key) => localStorage.getItem(key), WORKING_KEY),
  ).toBe('older settings');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), LIBRARY_KEY),
  ).toContain(GOKU_STATE);

  await page.evaluate((key) => localStorage.removeItem(key), WORKING_KEY);
  await page.goto(GOKU_OPTIMIZER);
  await page
    .getByRole('button', { name: 'Load Documented HP', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Load build', exact: true })
    .click();
  await expect(page.getByLabel('Current bronze equipment')).toHaveValue(
    'agl:bronze:hp:5',
  );
  // The retired source URL now shares the same workspace and can load
  // entered values completely; there is no second partial loader.
  await page
    .getByRole('button', { name: 'Load My values', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Load build', exact: true })
    .click();
  await expect(
    page.getByRole('radio', { name: 'My current values' }),
  ).toBeChecked();
});

test('keyboard users can choose a goal and optimize; results fit the screen', async ({
  page,
}) => {
  await page.goto(OPTIMIZER);
  await page.getByRole('radio', { name: /^Card ATK/ }).focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: /^Card DEF/ })).toBeChecked();
  await page.getByRole('button', { name: 'Optimize', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(heading(page)).toBeFocused();
  await expect(heading(page)).toHaveText('Multiple builds tie.');
  await expect(output(page)).toContainText('8,596 → 9,096 (+500)');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
});
