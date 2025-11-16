import { Page, expect } from '@playwright/test';

import { Mailbox } from '../utils/mailbox';

export class AuthPageObject {
  private readonly page: Page;
  private readonly mailbox: Mailbox;

  constructor(page: Page) {
    this.page = page;
    this.mailbox = new Mailbox(page);
  }

  goToSignIn() {
    return this.page.goto('/auth/sign-in');
  }

  goToSignUp() {
    return this.page.goto('/auth/sign-up');
  }

  async signOut() {
    // Remove Next.js dev overlay which can intercept pointer events during tests
    await this.page.evaluate(() => {
      const overlay = document.querySelector('[data-nextjs-dev-overlay="true"]')?.parentElement;
      if (overlay) {
        overlay.remove();
      }
      const portal = document.querySelector('nextjs-portal');
      if (portal) {
        portal.remove();
      }
    });
    const trigger = this.page.locator('[data-test="account-dropdown-trigger"]');
    await trigger.waitFor({ state: 'visible' });
    await trigger.click({ force: true });

    const signOutBtn = this.page.locator('[data-test="account-dropdown-sign-out"]');
    await signOutBtn.waitFor({ state: 'visible' });
    await signOutBtn.click();
  }

  async signIn(params: { email: string; password: string }) {
    await this.page.waitForTimeout(1000);

    await this.page.fill('input[name="email"]', params.email);
    await this.page.fill('input[name="password"]', params.password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForURL('**/home');
    await this.page.waitForSelector('[data-test="account-dropdown-trigger"]', { timeout: 30000 });
  }

  async signUp(params: {
    email: string;
    password: string;
    repeatPassword: string;
  }) {
    await this.page.waitForTimeout(1000);

    await this.page.fill('input[name="email"]', params.email);
    await this.page.fill('input[name="password"]', params.password);
    await this.page.fill('input[name="repeatPassword"]', params.repeatPassword);

    await this.page.click('button[type="submit"]');
  }

  async visitConfirmEmailLink(
    email: string,
    params: {
      deleteAfter: boolean;
      filter?: 'recovery' | 'email' | RegExp;
    } = {
      deleteAfter: true,
    },
  ) {
    return expect(async () => {
      const res = await this.mailbox.visitMailbox(email, params);

      expect(res).not.toBeNull();
    }).toPass();
  }

  createRandomEmail() {
    const value = Math.random() * 10000000000;

    return `${value.toFixed(0)}@makerkit.dev`;
  }

  async signUpFlow(path: string) {
    const email = this.createRandomEmail();

    await this.page.goto(`/auth/sign-up?next=${path}`);

    await this.signUp({
      email,
      password: 'password',
      repeatPassword: 'password',
    });

    await this.visitConfirmEmailLink(email);
  }

  async updatePassword(password: string) {
    await this.page.waitForSelector('[name="password"]');
    await this.page.waitForSelector('[name="repeatPassword"]');
    await this.page.fill('[name="password"]', password);
    await this.page.fill('[name="repeatPassword"]', password);
    await this.page.click('[type="submit"]');
  }
}
