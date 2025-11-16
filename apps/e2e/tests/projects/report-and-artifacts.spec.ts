import { test, expect } from '@playwright/test';

// Validates artifact download buttons and report link on results page.

test('artifacts and report presence', async ({ page }) => {
  await page.goto('/projects');
  // Navigate to first project results directly if link exists.
  // If not, go via generate after quick simulation.
  const detailsBtn = page.getByTestId('project-details-btn').first();
  await detailsBtn.click();

  // From project details page attempt to navigate to existing results path (assumes run already mocked)
  // Fallback: navigate to generate and perform quick generation simulation.
  const resultsUrlPattern = /\/projects\/.+\/results$/;
  try {
    await page.goto(page.url().replace(/\/projects\/(.+)$/,'$&/results'));
  } catch {
    // ignore
  }
  if (!resultsUrlPattern.test(page.url())) {
    // Fallback
    await page.getByTestId('project-generate-btn').first().click();
    await page.getByTestId('generate-brief-input').fill('Test bref pour artefacts.');
    await page.getByTestId('generate-run-btn').click();
    await page.waitForURL(resultsUrlPattern, { timeout: 60000 });
  }

  await expect(page.getByTestId('results-heading')).toBeVisible();
  // Buttons
  await expect(page.getByTestId('download-stl-btn')).toBeVisible();
  await expect(page.getByTestId('download-step-btn')).toBeVisible();
  await expect(page.getByTestId('view-report-btn')).toBeVisible();
});
