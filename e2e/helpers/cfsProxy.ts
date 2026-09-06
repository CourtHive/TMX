import type { Page } from '@playwright/test';
import { SERVER } from './role-fixtures';

/** API path prefixes CFS serves and TMX calls. */
const API_PREFIXES = ['auth', 'provider', 'factory', 'participation', 'registrations', 'admin', 'declarations'];

/**
 * Anchored at the START of the path — a CFS endpoint is always `/<prefix>/…` at
 * the root. The anchor is load-bearing: unanchored, this matched anywhere in the
 * URL, and in dev mode Vite serves every source module from the same origin, so
 * `/src/services/factory/engine.ts`, `/src/services/provider/providerState.ts`,
 * `/src/pages/admin/renderAdminPage.ts` and `/src/pages/participation/…` were all
 * "API calls" — as was `/@fs/…/CourtHive/factory/dist/esm/index.mjs`, the linked
 * competition-factory bundle, because the repo directory is itself named
 * `factory`. Each was re-fetched from CFS, 404'd, and took the module graph with
 * it: the app never booted, and all nine CFS-gated journeys failed identically on
 * `waitForSelector('#dnav')` against a blank page. Journey 120 guards this.
 */
const API_PATH_PATTERN = new RegExp(`^/(${API_PREFIXES.join('|')})(/|$)`);

/** True for a CFS endpoint path, false for anything Vite serves. Exported for journey 120. */
export const isCfsApiPath = (pathname: string): boolean => API_PATH_PATTERN.test(pathname);

/** Pages this proxy is already installed on — see the idempotence note below. */
const installedOn = new WeakSet<Page>();

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
 * directly, so the app already issues absolute cross-origin requests. It still
 * has to survive being installed there, though — these journeys run in dev like
 * every other one, so the matcher must not touch anything Vite serves.
 */
export async function routeApiToCfs(page: Page): Promise<void> {
  // Idempotent, and that matters. Playwright matches the LAST-registered route
  // FIRST, and `AuthFlow.login()` installs this proxy itself — so a spec that
  // installed it, then registered its own stub, then logged in would have the
  // re-installed proxy jump ahead of that stub and silently shadow it. Journey
  // 103 lost its registrations stub exactly that way: the request escaped to the
  // real declarations service, 404'd, and the table rendered zero rows.
  if (installedOn.has(page)) return;
  installedOn.add(page);

  await page.route(
    (url) => isCfsApiPath(url.pathname),
    async (route) => {
      const request = route.request();
      // Only ever proxy data calls. A script/stylesheet/document reaching this
      // handler means the matcher over-matched; passing it through keeps a
      // future mistake from silently emptying the page again.
      if (!['xhr', 'fetch'].includes(request.resourceType())) return route.fallback();

      const url = new URL(request.url());
      // Absolute calls already aimed at CFS (dev mode) need no rewriting.
      if (url.origin === new URL(SERVER).origin) return route.continue();
      const response = await route.fetch({ url: `${SERVER}${url.pathname}${url.search}` });
      await route.fulfill({ response });
    },
  );
}
