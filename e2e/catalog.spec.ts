import { catalogSnapshot } from '../src/data/real/catalog.ts';
import { expect, test } from './fixtures';

const STATE_ID = 'global-en:1003211:eza-7:lv140:sa15';
const jsonFile = (name: string, value: unknown) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(
    typeof value === 'string' ? value : JSON.stringify(value),
  ),
});

test('search and filters use admitted fields, with an empty state and reset', async ({
  page,
}) => {
  await page.goto('?workbench=catalog');
  const count = page.locator('.catalog-result-count');
  // One card form with two exact states (EZA and the pre-EZA base state).
  await expect(count).toHaveText('1 card form · 2 matching states');

  await page.getByLabel('Name, title or ID').fill('mystery GOKU');
  await expect(count).toHaveText('1 card form · 2 matching states');
  await page.getByLabel('Type', { exact: true }).selectOption('TEQ');
  await expect(count).toHaveText('0 card forms · 0 matching states');
  await expect(
    page.getByText('No records in this catalog match these filters.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByLabel('Name, title or ID')).toHaveValue('');
  await expect(count).toHaveText('1 card form · 2 matching states');

  await page
    .getByLabel('Optimization support', { exact: true })
    .selectOption('unavailable');
  // Only the base state lacks an evaluator.
  await expect(count).toHaveText('1 card form · 1 matching state');
  await page
    .getByLabel('Optimization support', { exact: true })
    .selectOption('limited');
  await expect(count).toHaveText('1 card form · 1 matching state');
  // Categories were never admitted: "not admitted" is not an empty list.
  await page
    .getByLabel('Category', { exact: true })
    .selectOption('__missing__');
  await expect(count).toHaveText('1 card form · 1 matching state');
  await page.getByLabel('Sort', { exact: true }).selectOption('name');
  await expect(count).toHaveText('1 card form · 1 matching state');
});

test('details keep identity, stat layers and missing fields separate', async ({
  page,
}) => {
  await page.goto('?workbench=catalog');
  const details = page.locator('article.catalog-details');
  await expect(
    details.getByRole('heading', { name: 'Super Saiyan 3 Goku' }),
  ).toBeVisible();
  await expect(details).toContainText('EZA step 7 · global-en · Lv.140 / SA15');
  await expect(details).toContainText(STATE_ID);
  const row = (label: string) =>
    details.getByRole('row', { name: new RegExp(`^${label}`) });
  await expect(row('Raw card stats')).toContainText('12,527');
  await expect(row('Raw card stats')).toContainText('11,111');
  await expect(row('Battle stats after modifiers')).toContainText(
    'Unavailable',
  );
  await details
    .getByLabel('Hidden Potential illustration')
    .selectOption({ index: 1 });
  await expect(row('Pre-battle total')).toContainText('15,327');
  await expect(row('Pre-battle total')).toContainText('13,911');
  await expect(row('Pre-battle total')).toContainText('8,596');
  await expect(details).toContainText(
    'Leader-skill details are not in the existing admitted record.',
  );
  await expect(details).toContainText('0 independently confirmed');

  await details
    .getByRole('link', { name: 'Compare documented profile' })
    .click();
  await expect(page).toHaveURL(
    /\?workbench=optimizer&state=global-en%3A1003211%3Aeza-7%3Alv140%3Asa15$/,
  );
  await expect(
    page.getByRole('heading', { name: /Find what to change/ }),
  ).toBeVisible();
});

test('exact state URLs survive reload and history; unknown states are not substituted', async ({
  page,
}) => {
  await page.goto('?workbench=catalog');
  await page.getByRole('button', { name: /EZA step 7/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`state=${encodeURIComponent(STATE_ID)}`),
  );
  await page.reload();
  await expect(
    page.getByRole('button', { name: /EZA step 7/ }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page.goto(`./?state=${encodeURIComponent('global-en:1003211:seza-1')}`);
  await expect(
    page.getByRole('heading', { name: 'State unavailable' }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Super Saiyan 3 Goku', level: 2 }),
  ).toBeVisible();
});

test('local catalog files are validated as data and browsed only for the session', async ({
  page,
}) => {
  await page.goto('?workbench=catalog');
  await page.getByText('Inspect a local normalized catalog file').click();
  const input = page.getByLabel('Normalized catalog JSON (20 MiB maximum)');
  const alert = page.locator('.catalog-import-errors');

  await input.setInputFiles(jsonFile('broken.json', '{"oops":'));
  await expect(alert).toContainText('The file could not be read as JSON.');

  await input.setInputFiles(jsonFile('empty.json', {}));
  await expect(alert).toContainText(
    'does not match the normalized catalog schema',
  );

  // Deeply nested unknown content is rejected, not left "validating".
  const depth = 100_000;
  await input.setInputFiles(
    jsonFile(
      'deep.json',
      JSON.stringify(catalogSnapshot).replace(
        /}$/,
        `,"extra":${'['.repeat(depth)}${']'.repeat(depth)}}`,
      ),
    ),
  );
  await expect(alert).toContainText('Rejected: deep.json');
  await expect(alert).toContainText('snapshot.extra');

  const fixture = {
    ...structuredClone(catalogSnapshot),
    origin: 'test-fixtures',
  };
  await input.setInputFiles(jsonFile('fixture.json', fixture));
  await expect(alert).toContainText(
    'test fixtures are not admitted to the application catalog',
  );

  // A re-export of the admitted record under another revision: no new facts.
  const copy = {
    ...structuredClone(catalogSnapshot),
    revision: 'local-copy-1',
  };
  await input.setInputFiles(jsonFile('local-copy.json', copy));
  await expect(page.getByText('Schema-valid: local-copy.json')).toBeVisible();
  await expect(page.locator('.catalog-import-result')).toContainText(
    'keeps every bundled ID and alias',
  );
  await page
    .getByRole('button', { name: 'Browse this file for this session' })
    .click();
  const banner = page.getByRole('region', {
    name: 'Browsing local file: local-copy.json',
  });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('not reviewed by this project');
  // A file's declared support is not presented as support in this app.
  await expect(
    page.getByRole('heading', {
      name: 'Declared by the file: limited — not offered in this app',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /declared limited · not offered here/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Compare documented profile' }),
  ).toBeDisabled();
  expect(new URL(page.url()).searchParams.has('state')).toBe(false);
  expect(await page.evaluate(() => Object.keys(window.localStorage))).toEqual(
    [],
  );

  await banner
    .getByRole('button', { name: 'Return to bundled catalog' })
    .click();
  await expect(banner).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Compare documented profile' }),
  ).toBeVisible();
});

test('the individually recorded base state shows its own facts and why it cannot be optimized', async ({
  page,
}) => {
  await page.goto('?workbench=catalog');
  await page.getByRole('button', { name: /Base \(no EZA\)/ }).click();
  await expect(page).toHaveURL(
    /state=unknown-region%3A1003211%3Abase%3Alv120%3Asa10$/,
  );
  const details = page.locator('article.catalog-details');
  await expect(details).toContainText(
    'Base (no EZA) · Region unknown · Lv.120 / SA10',
  );
  const raw = details.getByRole('row', { name: /^Raw card stats/ });
  await expect(raw).toContainText('9,500');
  await expect(raw).toContainText('8,672');
  await expect(raw).toContainText('4,623');
  await expect(details).toContainText('AGL Type Ki +3 and ATK +3000.');
  await expect(
    details.getByRole('heading', { name: 'Optimization support: unavailable' }),
  ).toBeVisible();
  await expect(details).toContainText(
    'No evaluator: the progression profile, eligible equipment and evaluation contexts for this pre-EZA state are not admitted.',
  );
  // Same card as the EZA state with an evaluator, but none is borrowed.
  await expect(
    details.getByRole('link', { name: 'Compare documented profile' }),
  ).toHaveCount(0);
  const rawField = details
    .locator('.catalog-field')
    .filter({ hasText: 'HP 9,500 · ATK 8,672 · DEF 4,623' });
  await rawField.getByText('Evidence: source-documented').click();
  await expect(rawField).toContainText('Retrieved: 2026-10-19');
  await expect(rawField).toContainText(
    'Independent confirmation: none recorded',
  );
});
