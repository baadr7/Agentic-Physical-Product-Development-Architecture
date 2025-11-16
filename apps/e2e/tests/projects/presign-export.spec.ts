import { test, expect } from '@playwright/test';

// Directly calls the presign export endpoint and validates structure.

test('presign export endpoint', async ({ request }) => {
  const resp = await request.post('/api/v1/exports/presign', {
    data: { run_id: 'run-e2e', kind: 'pdf' },
  });
  expect(resp.ok()).toBeTruthy();
  const json = await resp.json();
  expect(json).toHaveProperty('upload_url');
  expect(json.upload_url).toContain('https://example.com/upload');
});
