import type { Page } from '@playwright/test';
import { SERVER } from './role-fixtures';

/** API path prefixes CFS serves and TMX calls. */
const API_PREFIXES = ['auth', 'provider', 'factory', 'participation', 'registrations', 'admin', 'declarations'];
const API_PATTERN = new RegExp(`/(${API_PREFIXES.join('|')})(/|$)`);

/**
 * Point the page's same-origin API calls at a real CFS, for the handful of
 * journeys that need a live server.
 *
 * Why this is needed at all: Vite's env precedence puts `.env.production`
 * (`SERVER=`) ahead of `.env.local`, so a `TEST_PROD=1` build calls its OWN
 * origin. That is correct for real production — CFS serves the built TMX
 * same-origin — but `vite preview` has no API behind it, so the calls 404
 * against the preview server. The visible symptom is not an HTTP error: login
 * silently fails, no token is stored, `getLoginState()` is empty, and
 * capability-gated UI stays hidden. Specs then fail on a locator, pointing at
 * the app instead of at the harness.
 *
 * Why per-spec rather than a `preview.proxy` in vite.config: a proxy is
 * server-wide and changes the environment for all ~115 journeys at once.
 * Measured — it made journey 61 fail, landing the app on the welcome screen
 * instead of its seeded tournament, because tournament routing behaves
 * differently once an API is reachable. The rest of the suite is written
 * against "prod mode has no server"; only these few want one, so only these
 * few opt in.
 *
 * Dev mode needs none of this: `.env.development` points `SERVER` at CFS
 * directly, so the app already issues absolute cross-origin requests.
 */
export async function routeApiToCfs(page: Page): Promise<void> {
  await page.route(API_PATTERN, async (route) => {
    const url = new URL(route.request().url());
    // Absolute calls already aimed at CFS (dev mode) need no rewriting.
    if (url.origin === new URL(SERVER).origin) return route.continue();
    const response = await route.fetch({ url: `${SERVER}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
}
