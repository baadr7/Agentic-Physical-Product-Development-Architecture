import { test, expect } from '@playwright/test';

// This test assumes the backend is running and the project has at least one completed run
// with a variant that exposes STL/STEP/PDF links. In CI, you can pre-seed the DB or mock.

test('results page shows artifact links when available', async ({ page }) => {
  await page.goto('/projects/proj-1/results');
  await expect(page.getByRole('heading', { name: 'Résultats' })).toBeVisible();

  // Buttons/Links text are present (gracefully disabled when not available)
  await expect(page.getByText('Télécharger STL')).toBeVisible();
  await expect(page.getByText('Télécharger STEP')).toBeVisible();
  await expect(page.getByText('Voir Rapport DfX')).toBeVisible();
});
