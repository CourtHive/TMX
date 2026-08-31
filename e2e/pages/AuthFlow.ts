import type { Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/dev-bridge';
import { routeApiToCfs } from '../helpers/cfsProxy';

/**
 * Shared real-login flow for the auth cluster. TMX's authenticated boot is
 * server-coupled, so the JWT must come from a genuine `/auth/login` (not token
 * injection) — this drives the login modal against the live CFS. Extracted from
 * the copy-paste in journeys 36 / 58.
 */
export class AuthFlow {
  constructor(private page: Page) {}

  /**
   * Boot the app and log in through the modal. Leaves the app on /tournaments.
   *
   * Routes the page's API calls to a live CFS first. Under `TEST_PROD=1` the build takes
   * `.env.production`, where `SERVER` is empty, so every REST call resolves to the preview
   * origin — which serves the client and nothing else. The symptom is not an HTTP error the
   * spec can see: login silently fails, no token is stored, and the assertion times out on a
   * locator, pointing at the app instead of at the harness. That cost journeys 71, 72, 73 and
   * 76 a `TEST_PROD` failure each; 103 already opted in per-spec and passed throughout.
   *
   * It belongs HERE rather than in each spec because every caller of this method is by
   * definition a real-login journey that needs a reachable CFS — and unlike a `preview.proxy`
   * in vite.config (implemented and reverted; see cfsProxy's header) it changes nothing for
   * the ~110 journeys that do not log in.
   */
  async login(email: string, password: string): Promise<void> {
    await routeApiToCfs(this.page);
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
