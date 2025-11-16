import { test, expect } from '@playwright/test';

// Minimal smoke test for Results page
// Requires the web app to run locally and mock data or backend API available.

test('results page renders', async ({ page }) => {
  await page.goto('/projects/proj-1/results');
  await expect(page.getByRole('heading', { name: 'Résultats' })).toBeVisible();
});
