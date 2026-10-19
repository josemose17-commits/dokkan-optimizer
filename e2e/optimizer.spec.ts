import type { Page } from '@playwright/test';
import { expect, GOKU_OPTIMIZER, GOKU_STATE, test } from './fixtures';

const panel = (page: Page) => page.locator('#result-explanation');
const row = (page: Page, text: RegExp) =>
  page.getByRole('row').filter({ hasText: text });

test('the optimizer lists exact states and opens the chosen one', async ({
  page,
}) => {
  await page.goto('?workbench=character-build');
  await expect(
    page.getByRole('heading', { name: '1 exact state with an evaluator' }),
  ).toBeVisible();
  await page.getByRole('link', { name: /Super Saiyan 3 Goku/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`state=${encodeURIComponent(GOKU_STATE)}$`),
  );
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Optimize Super Saiyan 3 Goku',
  );
});

test('a state without an evaluator is refused, never replaced by another', async ({
  page,
}) => {
  for (const id of ['global-en:1003211:seza-1', 'not-a-state']) {
    await page.goto(
      `?workbench=character-build&state=${encodeURIComponent(id)}`,
    );
    await expect(
      page.getByRole('heading', { name: 'Optimization unavailable' }),
    ).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(
      `State ${id} is not in this catalog. No other state is substituted.`,
    );
    await expect(
      page.getByRole('button', { name: 'Compare legal builds' }),
    ).toHaveCount(0);
    await expect(page.getByText('Optimize Super Saiyan 3 Goku')).toHaveCount(0);
  }
  await page
    .getByRole('link', { name: 'Choose a supported character' })
    .click();
  await expect(
    page.getByRole('heading', { name: '1 exact state with an evaluator' }),
  ).toBeVisible();
});

test('results carry computed summaries and an explanation of the top change', async ({
  page,
}) => {
  await page.goto(GOKU_OPTIMIZER);
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(
    'Explanation for #1: AGL ATK +500 · bronze Lv.5 / Additional Attack +2 · silver',
  );
  await expect(panel(page)).toContainText(
    '7.0% vs 5.0% for the current build: +2.0 percentage points (+40.0% relative change), better than the current build on this objective. Rank #1 of 16 distinct results, tied with 3 other results.',
  );
  await expect(panel(page)).toContainText(
    'Ownership is ignored in this comparison; with your inventory it would need 1 × AGL ATK +500 · bronze Lv.5; 1 × Additional Attack +2 · silver.',
  );
  await panel(page).getByText('Stat additions by source').click();
  const stats = panel(page).getByRole('table', {
    name: /Card stats are summed/,
  });
  await expect(
    stats.getByRole('row', { name: /Card base stats \(Lv\.140\)/ }),
  ).toContainText('+11,111');
  await expect(stats.getByRole('row', { name: /^Change/ })).toContainText(
    '+500 (+3.59% relative change)',
  );
  await panel(page)
    .getByText('Skill levels and probability calculations')
    .click();
  await expect(panel(page)).toContainText(
    'Initial extra Super: 14.0% (Initial AA trigger) × 50.0% (Super conversion) = 7.0%',
  );
});

test('a dominated result explains which result dominates it and why', async ({
  page,
}) => {
  await page.goto(GOKU_OPTIMIZER);
  const target = row(page, /Empty\s*Additional Attack \+2 · silver/);
  await expect(target).toContainText('above the baseline · dominated by #1');
  await target.getByRole('button', { name: 'Explain #1' }).click();
  const heading = panel(page).getByRole('heading', { level: 2 });
  await expect(heading).toHaveText(
    'Explanation for #1: Additional Attack +2 · silver',
  );
  await expect(heading).toBeFocused();
  await expect(panel(page)).toContainText(
    'Off the frontier: #1 (AGL ATK +500 · bronze Lv.5 / Additional Attack +2 · silver / Empty) is at least as good on every selected metric (Card ATK, Card DEF, Card HP, Initial extra Super, Critical chance, Evasion chance) and better on Card ATK.',
  );
});

test('a zero baseline is reported as an undefined relative change', async ({
  page,
}) => {
  await page.goto(GOKU_OPTIMIZER);
  await row(page, /AGL ATK \+500 · bronze Lv\.5\s*Critical Hit \+2 · silver/)
    .getByRole('button', { name: /^Explain #/ })
    .click();
  await expect(panel(page)).toContainText(
    'equal to the current build on this objective (a tie)',
  );
  await panel(page)
    .getByText('Skill levels and probability calculations')
    .click();
  await expect(panel(page)).toContainText(
    'Critical chance: 2 (Critical Hit levels) × 2.0% (chance per level) = 4.0%',
  );
  await expect(panel(page)).toContainText(
    'change +4.0 percentage points (relative change undefined: zero baseline)',
  );
});

test('an equivalent configuration is explained from its own sources', async ({
  page,
}) => {
  await page.goto(GOKU_OPTIMIZER);
  await page.getByLabel('Incoming-attack assumption').selectOption('disabled');
  await page.getByRole('button', { name: 'Compare legal builds' }).click();
  const current = row(page, /CURRENT/);
  await current.getByText('2 legal equip options').click();
  await current
    .getByRole('button', { name: 'Explain this configuration' })
    .nth(1)
    .click();
  await expect(panel(page)).toContainText(
    '2 legal configurations give these exact results; this explanation follows configuration 2.',
  );
  await panel(page)
    .getByText('Skill levels and probability calculations')
    .click();
  await expect(
    panel(page).getByRole('row', {
      name: /Silver equip: Evasion \+2 · silver/,
    }),
  ).toBeVisible();
  await expect(panel(page)).toContainText(
    'Evasion chance: 0.0% (Fixed at 0 by the explicit context: evasion disabled.)',
  );
});
