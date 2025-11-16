import { test, expect } from '@playwright/test';

// Generates a run from a project via the UI, using mock/in-memory API.

test('generate run flow', async ({ page }) => {
  // Start from projects page and ensure at least one project exists.
  await page.goto('/projects');
  // Prefer clicking first generate button.
  const generateBtns = page.getByTestId('project-generate-btn');
  await generateBtns.first().click();

  // On generate page.
  await expect(page.getByRole('heading', { name: 'Génération' })).toBeVisible();

  // Fill a brief.
  await page.getByTestId('generate-brief-input').fill('Chaise ergonomique modulable, aluminium, tissu, contraintes de durabilité.');

  // Try normalization (may show error if LLM not configured).
  await page.getByTestId('normalize-brief-btn').click();
  // Wait a short period for either success log or error message.
  await page.waitForTimeout(800);

  // Trigger generate.
  await page.getByTestId('generate-run-btn').click();

  // Wait for redirect to results (polling completion or simulated fallback).
  await page.waitForURL(/\/projects\/.+\/results$/ , { timeout: 120000 });

  // Assert results heading.
  await expect(page.getByTestId('results-heading')).toBeVisible();
  // Assert at least one variant grid item present.
  await expect(page.getByTestId('variants-grid')).toBeVisible();
});
