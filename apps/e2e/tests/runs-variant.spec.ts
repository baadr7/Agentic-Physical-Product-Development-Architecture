import { test, expect } from '@playwright/test';

// Assumes dev server (Next.js) running at http://localhost:3000 and API at http://127.0.0.1:8001
// This is a smoke-level test; real project should seed data or mock network.

const WEB_BASE = process.env.WEB_BASE_URL || 'http://localhost:3000';

// Helper selectors are minimal since UI specifics may evolve.

test.describe('Runs & Variant Detail', () => {
  test('Navigate to Runs page', async ({ page }) => {
    await page.goto(`${WEB_BASE}/dashboard/runs`);
    await expect(page.locator('h1:text("Runs")')).toBeVisible();
  });

  test('Variant detail page loads synthetic or real data', async ({ page }) => {
    // Navigate directly to placeholder variant; synthetic fallback should render
    const syntheticId = 'var-demo';
    await page.goto(`${WEB_BASE}/dashboard/variants/${syntheticId}`);
    await expect(page.locator('h1')).toContainText(syntheticId);
    await expect(page.locator('text=DfX Summary')).toBeVisible();
  });
});
