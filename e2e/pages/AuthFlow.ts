import type { Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/dev-bridge';

/**
 * Shared real-login flow for the auth cluster. TMX's authenticated boot is
 * server-coupled, so the JWT must come from a genuine `/auth/login` (not token
 * injection) — this drives the login modal against the live CFS. Extracted from
 * the copy-paste in journeys 36 / 58.
 */
export class AuthFlow {
  constructor(private page: Page) {}

  /** Boot the app and log in through the modal. Leaves the app on /tournaments. */
  async login(email: string, password: string): Promise<void> {
    await this.page.goto('/');
    await waitForAppReady(this.page);
    await this.page.locator('#login').click();
    await this.page.getByText('Log in').click();
    await this.page.locator('input[placeholder*="email"]').fill(email);
    await this.page.locator('input[placeholder*="8 characters"]').fill(password);
    await this.page.locator('#loginButton').click();
    // Sign-in + provider resolution are async; a settle floor (matches 36/58).
    // Callers should still poll their own assertions.
    await this.page.waitForTimeout(1500);
  }

  /**
   * Select a provider via the navbar super-admin switcher (on /tournaments),
   * setting the active provider. Extracted from journey 58's openSwitcherAndSelect.
   * The type-ahead suggestion must be clicked (not just typed) so the callback
   * fires with the provider's organisationId, which is what enables Select.
   */
  async selectProvider(providerName: string): Promise<void> {
    await this.page.locator('#provider').click();
    await this.page.getByText(/(Select|Switch) provider/).click();
    const input = this.page.locator('input[placeholder="Type provider name"]');
    await input.click();
    await input.fill(providerName);
    await this.page.locator('ul[role="listbox"] li', { hasText: providerName }).first().click();
    await this.page.locator('#selectButton').click();
    await this.page.waitForTimeout(500);
  }
}
