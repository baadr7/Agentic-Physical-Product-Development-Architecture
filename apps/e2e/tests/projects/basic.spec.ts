import { test, expect } from '@playwright/test';

// Smoke test for Project page wiring to API.
// Requires web app on :3000 and API base configured via NEXT_PUBLIC_API_BASE_URL.

test('project page renders and actions exist', async ({ page }) => {
  await page.goto('/projects/proj-1');
  await expect(page.getByText('Navigation Projet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter Run' })).toBeVisible();
});

test('project page report/export controls visible', async ({ page }) => {
  await page.goto('/projects/proj-1');
  // Use heading role to avoid strict mode violation (button also contains Rapport)
  await expect(page.getByRole('heading', { name: 'Rapport' })).toBeVisible();
  await expect(page.getByText('Export STL/STEP')).toBeVisible();
});
