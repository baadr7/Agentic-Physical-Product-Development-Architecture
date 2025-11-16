import { test, expect } from '@playwright/test';

// Assumes auth bypass env vars are set via test:dev script.
// Flow: open create form, submit, land on project page or list fallback.

test('create project flow', async ({ page }) => {
  await page.goto('/projects');
  await page.getByTestId('new-project-btn').click();

  // Fill form fields
  await page.getByTestId('create-project-title-field').getByRole('textbox').fill('Projet E2E');
  await page.getByTestId('create-project-description-field').getByRole('textbox').fill('Description du projet E2E');
  await page.getByTestId('create-project-brief-field').getByRole('textbox').fill('Brief E2E avec matériaux et contraintes.');
  await page.getByTestId('create-project-type-field').getByRole('combobox').selectOption('electronics');

  await page.getByTestId('create-project-submit').click();

  // After submit, we should either land on /projects/<id> or /projects fallback.
  await page.waitForURL(/\/projects(\/.+)?$/);

  // Assert that either details button for the new project exists or list shows the title.
  const hasTitle = await page.getByText('Projet E2E').first().isVisible().catch(() => false);
  expect(hasTitle).toBeTruthy();
});
