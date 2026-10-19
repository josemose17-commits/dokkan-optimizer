import { expect, GOKU_OPTIMIZER, test } from './fixtures';

test('the consolidated comparison preserves source-by-source explanations and ties', async ({
  page,
}) => {
  await page.goto(GOKU_OPTIMIZER);
  await page.getByRole('radio', { name: /^Initial extra Super/ }).check();
  await page.getByRole('button', { name: 'Optimize', exact: true }).click();
  const result = page.getByRole('region', { name: 'Optimize and result' });
  await expect(result).toContainText('5.0% → 7.0% (+2.0 percentage points)');
  await expect(result).toContainText('4 configurations tie.');
  await result.getByText('Formula trace and evidence', { exact: true }).click();
  const trace = result.locator('#result-explanation');
  await expect(trace).toContainText('7.0% vs 5.0% for the current build');
  await trace.getByText('Stat additions by source', { exact: true }).click();
  await expect(
    trace.getByRole('row', { name: /Card base stats \(Lv.140\)/ }),
  ).toContainText('11,111');
  await trace
    .getByText('Skill levels and probability calculations', { exact: true })
    .click();
  await expect(trace).toContainText(
    '14.0% (Initial AA trigger) × 50.0% (Super conversion) = 7.0%',
  );
  await result.getByText('Search completeness', { exact: true }).click();
  await expect(result).toContainText('16 evaluated · 16 distinct results');
});

test('Gohan guidance follows kit, position/role and priorities with specific limits', async ({
  page,
}) => {
  await page.goto('./');
  await page
    .getByRole('button', { name: /^Gohan \(Teen\).*Kit guidance$/ })
    .click();
  const analysis = page.getByRole('region', { name: 'Character analysis' });
  await expect(analysis).toContainText('Slot 1');
  await expect(analysis).toContainText('main rotation');
  await expect(analysis).toContainText('defender');
  await expect(analysis).toContainText('Additional-led priorities');
  await expect(analysis).toContainText('reviewed character-aware rule');
  await expect(analysis).toContainText(
    'No numerical winning allocation is claimed.',
  );
  await expect(
    page.getByRole('button', { name: 'Optimize', exact: true }),
  ).toHaveCount(0);
  await analysis.getByText('Conflicts and conditions', { exact: true }).click();
  await expect(analysis).toContainText('Evasion may postpone');
  await expect(analysis).toContainText('Goku formula is not borrowed');
  await analysis
    .getByText('Advanced priority override', { exact: true })
    .click();
  await analysis
    .getByLabel('Priority', { exact: true })
    .selectOption('opening-protection');
  await expect(analysis).toContainText('Opening protection first;');
  await analysis.getByLabel('Incoming attacks are evadable').uncheck();
  await expect(analysis).toContainText('context disables evasion');
  await analysis
    .getByText('Missing exact-build evidence', { exact: true })
    .click();
  await expect(analysis).toContainText(
    'No complete choice/increment/prerequisite list',
  );
  await expect(analysis).toContainText('unresolved generic silver records');
  await analysis
    .getByText('Kit facts, sources and support limits', { exact: true })
    .click();
  await expect(analysis).toContainText('no independent in-game confirmation');
});
