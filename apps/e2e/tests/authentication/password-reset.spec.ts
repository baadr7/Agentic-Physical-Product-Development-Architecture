import { test } from '@playwright/test';

import { AuthPageObject } from './auth.po';

const newPassword = (Math.random() * 10000).toString();
const emailAddress = (Math.random() * 10000).toFixed(0);

test.describe('Password Reset Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('will reset the password and sign in with new one', async ({ page }) => {
    const email = `${emailAddress}@makerkit.dev`;
    const auth = new AuthPageObject(page);

    await page.goto('/auth/sign-up');

    await auth.signUp({
      email,
      password: 'password',
      repeatPassword: 'password',
    });

    await auth.visitConfirmEmailLink(email);
    await page.waitForURL('**/home');
    await page.waitForLoadState('networkidle');

    // Ensure logged-out state before password reset page
    await page.context().clearCookies();
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
    });
    // Allow any client-side redirects triggered by storage clearing to settle
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(100);
    // Prefer app-driven redirect to sign-in; fallback to explicit navigation
    try {
      await page.waitForURL('**/auth/sign-in', { timeout: 3000 });
    } catch {}
    if (!page.url().includes('/auth/sign-in')) {
      // Reset to a neutral page to avoid in-flight navigations
      await page.goto('about:blank');
      await page.goto('/auth/sign-in', { waitUntil: 'load' });
    }
    await page.waitForLoadState('networkidle');
    await page.goto('/auth/password-reset', { waitUntil: 'load' });

    await page.fill('[name="email"]', email);
    await page.click('[type="submit"]');

    // Fetch the password recovery email (type=recovery)
    await auth.visitConfirmEmailLink(email, { deleteAfter: true, filter: 'recovery' });

    // Some builds redirect to /home; navigate to update password if needed
    if (!page.url().includes('/update-password')) {
      await page.goto('/update-password', { waitUntil: 'load' });
    } else {
      await page.waitForURL('/update-password');
    }

    await auth.updatePassword(newPassword);

    await page
      .locator('a', { hasText: 'Back to Home Page' })
      .click();
    // The app may redirect /home -> /dashboard; wait for navigation to settle
    await page.waitForLoadState('networkidle');
    await page.waitForURL(/\/(home|dashboard)(\/)?$/);

    // Simulate logout without UI flakiness
    await page.context().clearCookies();
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
    });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(100);
    try {
      await page.waitForURL('**/auth/sign-in', { timeout: 3000 });
    } catch {}
    if (!page.url().includes('/auth/sign-in')) {
      await page.goto('about:blank');
      await page.goto('/auth/sign-in', { waitUntil: 'load' });
    }

    await auth.signIn({
      email,
      password: newPassword,
    });

    await page.waitForURL('/home');
  });
});
