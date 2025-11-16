import { test, expect } from '@playwright/test';

// Full flow: generate a run then verify DfX summary page.

test('DfX summary page shows synthesized data', async ({ page }) => {
  await page.goto('/projects');
  // Use first generate button to create a run
  await page.getByTestId('project-generate-btn').first().click();
  await page.getByTestId('generate-brief-input').fill('Concept produit modulaire durable léger.');
  await page.getByTestId('generate-run-btn').click();
  // Wait redirect to results
  await page.waitForURL(/\/projects\/.+\/results$/, { timeout: 120000 });

  // Extract project id from current URL
  const m = page.url().match(/\/projects\/(.*?)\/results/);
  expect(m).toBeTruthy();
  const projectId = m![1];

  // Navigate to DfX page
  await page.goto(`/projects/${projectId}/dfx`);
  await expect(page.getByTestId('dfx-heading')).toBeVisible();
  const summary = page.getByTestId('dfx-summary');
  await expect(summary).toBeVisible();
  const text = await summary.innerText();
  expect(text.trim().length).toBeGreaterThan(0);
});
