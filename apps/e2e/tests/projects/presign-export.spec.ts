import { test, expect } from '@playwright/test';

// Directly calls the presign export endpoint and validates structure.

test('presign export endpoint', async ({ request }) => {
  const base = process.env.PLAYWRIGHT_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8001';
  const resp = await request.post(`${base}/api/v1/exports/presign`, {
    data: { run_id: 'run-e2e', kind: 'pdf' },
  });
  expect(resp.ok()).toBeTruthy();
  const json = await resp.json();
  expect(json).toHaveProperty('upload_url');
  expect(json.upload_url).toContain('https://example.com/upload');
});
