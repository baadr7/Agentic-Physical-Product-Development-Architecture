import { test, expect } from '@playwright/test';

// Ensures a run exists (via UI generation if needed), then fetches its PDF report.

async function ensureRun(page: any, request: any): Promise<string> {
  // Try existing runs first
  const base = process.env.PLAYWRIGHT_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8001';
  const existing = await request.get(`${base}/api/v1/runs`);
  if (existing.ok()) {
    const runs = await existing.json();
    if (Array.isArray(runs) && runs.length) {
      return runs[0].run_id || runs[0].id;
    }
  }
  // Create by UI flow
  await page.goto('/projects');
  await page.getByTestId('project-generate-btn').first().click();
  await page.getByTestId('generate-brief-input').fill('Rapport PDF attendu pour validation E2E.');
  await page.getByTestId('generate-run-btn').click();
  await page.waitForURL(/\/projects\/.+\/results$/, { timeout: 120000 });
  // Fetch runs again
  const after = await request.get(`${base}/api/v1/runs`);
  expect(after.ok()).toBeTruthy();
  const runs2 = await after.json();
  expect(Array.isArray(runs2) && runs2.length).toBeTruthy();
  return runs2[0].run_id || runs2[0].id;
}

test('pdf report retrieval', async ({ page, request }) => {
  const base = process.env.PLAYWRIGHT_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8001';
  const runId = await ensureRun(page, request);
  const resp = await request.get(`${base}/api/v1/runs/${runId}/report.pdf`);
  expect(resp.ok()).toBeTruthy();
  const ct = resp.headers()['content-type'] || resp.headers()['Content-Type'];
  expect(ct).toMatch(/application\/pdf/);
  const buf = await resp.body();
  expect(buf.byteLength).toBeGreaterThan(100); // minimal size threshold
});
