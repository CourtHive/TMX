import type { BrowserContext, Page } from '@playwright/test';

/**
 * Initialize the dev bridge on a page.
 *
 * Enables mutation logging via dev.context({ internal: true }) and
 * optionally injects a page.exposeFunction bridge for structured
 * mutation capture (Phase 2+).
 *
 * Must be called after page.goto() since the dev object is created
 * during tmxReady() in initialState.ts.
 */
export async function initDevBridge(page: Page): Promise<void> {
  // Wait for the dev object to be available (set during tmxReady)
  await page.waitForFunction(() => typeof globalThis.dev !== 'undefined', null, { timeout: 15_000 });

  // Enable mutation logging to console
  await page.evaluate(() => {
    dev.context({ internal: true });
  });
}

/**
 * Reset the TMX database and clear state for a clean test run.
 */
export async function resetState(page: Page): Promise<void> {
  // resetDB now reopens the Dexie database after delete; awaiting the
  // returned promise (instead of fire-and-forget) ensures the next
  // mutation/save doesn't race against a closed Dexie instance.
  await page.evaluate(async () => {
    await dev.tmx2db.resetDB();
  });
}

/**
 * Clear the persisted events-view mode so the next `navigateToEvents*`
 * sees the fresh-visit default (table). Use in `beforeEach` of specs
 * that assert default-view behaviour.
 */
export async function resetEventsViewMode(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      localStorage.removeItem('tmx_events_view_mode');
    } catch {
      /* ignore */
    }
  });
}

/**
 * Clear the persisted draws-view mode + draw-card display mode so
 * draws-list specs see the fresh-visit defaults (table view, no viz).
 */
export async function resetDrawsViewState(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      localStorage.removeItem('tmx_draws_view_mode');
      localStorage.removeItem('tmx_draws_card_display');
    } catch {
      /* ignore */
    }
  });
}

/**
 * Force the draws-list view into Tabulator/table mode so specs that target
 * `.tabulator-row` selectors keep working. As of f2a85a90 the draws-list
 * defaults to table mode, so this matches the current default — but pinning it
 * explicitly keeps such specs robust against future default changes.
 */
export async function ensureDrawsTableMode(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      localStorage.setItem('tmx_draws_view_mode', 'table');
    } catch {
      /* ignore */
    }
  });
}

/**
 * Force the draws-list view into card-grid mode. The draws-list defaults to
 * table mode (f2a85a90), so card-grid specs (e.g. draw-card visualizations)
 * must opt in explicitly rather than relying on the default.
 */
export async function ensureDrawsGridMode(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      localStorage.setItem('tmx_draws_view_mode', 'grid');
    } catch {
      /* ignore */
    }
  });
}

/**
 * Wait for the app to be fully ready (splash dismissed, navbar visible).
 *
 * TMX starts with an animated splash screen that dismisses on click,
 * then shows either the welcome view (no tournaments) or the calendar.
 * #tmxContent starts display:none and only becomes visible when a
 * tournament is opened — so we wait for the navbar instead.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Dismiss the splash if it's showing (click anywhere)
  const splash = page.locator('#splash');
  if (await splash.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await splash.click();
  }

  // Wait for the navbar (#dnav) — it's always visible once the app is ready
  await page.waitForSelector('#dnav', { state: 'visible', timeout: 15_000 });
}

/**
 * Check whether the dev object is available on the page.
 */
export async function isDevAvailable(page: Page): Promise<boolean> {
  return page.evaluate(() => typeof globalThis.dev !== 'undefined');
}

/**
 * Options shared by every synthetic-login helper in this file.
 *
 * Each of those helpers cuts the page off from CFS by default — see
 * `isolateFromCfs` for why an unsigned token and a live server cannot share a
 * page. `liveCfs: true` is the explicit, greppable opt-out for a journey that
 * genuinely wants the server: it leaves the page's traffic alone. Reach for it
 * rarely. Any real CFS answers these unsigned tokens with 401, so a journey that
 * needs a live server almost always wants a REAL session (`AuthFlow.login`, which
 * signs in through `/auth/login` and installs `routeApiToCfs`) rather than one of
 * these helpers with the isolation turned off.
 */
export interface SyntheticLoginOptions {
  /** Leave the page connected to a real CFS instead of isolating it. Default `false`. */
  liveCfs?: boolean;
}

async function isolateUnlessLiveCfs(page: Page, options?: SyntheticLoginOptions): Promise<void> {
  if (!options?.liveCfs) await isolateFromCfs(page);
}

/**
 * Inject a synthetic super-admin JWT into localStorage so admin-gated
 * surfaces (Tournament Actions panel, super-admin-only pages) render
 * during e2e runs. The JWT is unsigned — `validateToken` uses
 * `jwtDecode` which does NOT verify the signature, so a base64-encoded
 * payload with the right claims is enough for the client.
 *
 * Evaluate-based, so it writes to the CURRENT page's localStorage; to have the
 * token present when TMX first boots, use `seedSuperAdminTokenInitScript`.
 *
 * Isolates the page from CFS first, unless `{ liveCfs: true }` — see
 * `isolateFromCfs`.
 */
export async function loginAsSuperAdmin(page: Page, options?: SyntheticLoginOptions): Promise<void> {
  await isolateUnlessLiveCfs(page, options);
  await page.evaluate(() => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        roles: ['superadmin'],
        sub: 'e2e-superadmin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
    localStorage.setItem('tmxToken', `${header}.${payload}.fake-signature`);
  });
}

/**
 * Add an init script that seeds the super-admin token before any TMX
 * code runs. This is the right hook for tests where role-gated UI
 * needs to render correctly on the first paint.
 *
 * Call once in `test.beforeAll` (or before your first `page.goto`) —
 * Playwright re-runs init scripts on every navigation, so the token
 * stays present across `page.goto` calls within the same test.
 *
 * Isolates the page from CFS first, unless `{ liveCfs: true }` — see
 * `isolateFromCfs`.
 */
export async function seedSuperAdminTokenInitScript(page: Page, options?: SyntheticLoginOptions): Promise<void> {
  await isolateUnlessLiveCfs(page, options);
  await page.addInitScript(() => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        roles: ['superadmin'],
        sub: 'e2e-superadmin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
    localStorage.setItem('tmxToken', `${header}.${payload}.fake-signature`);
  });
}

/** Browser contexts already cut off from CFS — see the idempotence note below. */
const isolatedContexts = new WeakSet<BrowserContext>();

/**
 * Cut the page off from CFS for the rest of the test.
 *
 * Every synthetic-login helper in this file calls this BY DEFAULT (opt out with
 * `{ liveCfs: true }`), so a journey that injects a token is hermetic without
 * having to remember to ask. Calling it yourself as well is harmless.
 *
 * ## The cascade it prevents
 *
 * The synthetic tokens are UNSIGNED. The client accepts them because
 * `validateToken` only decodes — but a real CFS on :8383 rejects them with 401.
 * `baseApi`'s response interceptor answers a 401 by attempting one silent
 * refresh and, finding no refresh token in localStorage, calls `logOut()`, which
 * clears the token, resets the tournament engine and navigates to
 * `#/tournaments/logout`. A journey whose UI is role-gated then loses the role it
 * just injected, mid-test. Two ways in, both seen:
 *
 * - a mutation: `mutationRequest` → `checkPermissions` → `ensureUserContext()`
 *   fires `GET /auth/me`. Journey 61 passed only while its `waitForSelector` beat
 *   that 401 (~100ms) and flaked when it did not (2026-10-04, fixed by #1536);
 * - the tournaments list: with a token present it reads `/provider/my-calendars`
 *   at boot. Journey 86 logged out at the start of both its tests on every run
 *   against a live CFS, and passed only because it navigates on afterwards.
 *
 * Journey 30 is the deterministic form: with CFS running its
 * `#formatWizardActionButton` never rendered and every test timed out. CI has no
 * CFS, so none of this happens there — which is exactly why it must not decide a
 * local run either. Aborting is what makes it hermetic: a network error does not
 * log anyone out (`baseApi` only logs out on 401), so this reproduces the
 * no-server environment deterministically in both.
 *
 * ## Why the CONTEXT, not the page
 *
 * Playwright gives `page.route` handlers precedence over `context.route` ones,
 * whatever order they were registered in. Installed at the context, this is the
 * lowest-priority answer for a CFS URL: a spec's own stub for one endpoint
 * (`/auth/me`, `/provider/my-calendars`, `/factory/schedule-projection`, …) still
 * wins even when the spec registered it BEFORE logging in, as journeys 113 and
 * 124 do. Installed at the page, it would have jumped ahead of those stubs and
 * aborted the very responses the journeys exist to observe.
 *
 * ## Idempotent
 *
 * Tracked per context, so the second and later calls install nothing — a spec
 * that isolates explicitly and then logs in through a helper gets one route.
 *
 * Scope is the CFS ORIGIN, deliberately. A bare path glob such as
 * `**\/tournaments/search*` also matches the app's own source modules served by
 * the dev server, which breaks boot instead of isolating anything.
 *
 * Override the origin with `E2E_API_BASE`, as `role-fixtures.ts` does.
 */
export async function isolateFromCfs(page: Page): Promise<void> {
  const context = page.context();
  if (isolatedContexts.has(context)) return;
  isolatedContexts.add(context);

  const cfs = process.env.E2E_API_BASE ?? 'http://localhost:8383';
  await context.route(`${cfs}/**`, (route) => route.abort());
}

/**
 * Seed a NON-super-admin JWT whose `providerAssociations` tie the user to a
 * specific provider, so provider-member-gated behaviour fires in e2e. The
 * schedule "Now" strip auto-call (isTournamentProviderMember → runAutoCallPass)
 * only stamps calledAt for a user associated with the loaded tournament's
 * provider, so any journey asserting auto-call must (a) seed the tournament with
 * `parentOrganisation.organisationId === providerId` and (b) inject this token.
 *
 * Evaluate-based (not addInitScript): `getLoginState()` re-reads localStorage on
 * every call, and the gate runs at strip-mount — after boot — so the token only
 * needs to be present in localStorage by then. Call AFTER any beforeEach
 * `localStorage.clear()` and before navigating to the scheduling view; the token
 * persists across the in-SPA hash routes that follow. addInitScript would not
 * work here: `tournament.goto('/#/...')` is a same-document hash change that
 * doesn't reload, so an init script wouldn't re-fire, and the boot-set token
 * would already be wiped by the clear. Roles deliberately exclude 'superadmin' —
 * the gate must pass on genuine provider membership, not the super-admin escape.
 *
 * Isolates the page from CFS first, unless `{ liveCfs: true }` — see
 * `isolateFromCfs`.
 */
export async function loginAsProviderMember(
  page: Page,
  providerId: string,
  options?: SyntheticLoginOptions,
): Promise<void> {
  await isolateUnlessLiveCfs(page, options);
  await page.evaluate((pid: string) => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        roles: ['client'],
        sub: 'e2e-provider-member',
        providerAssociations: [
          {
            providerId: pid,
            providerRole: 'DIRECTOR',
            organisationName: 'E2E Provider',
            organisationAbbreviation: 'E2EP',
          },
        ],
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
    localStorage.setItem('tmxToken', `${header}.${payload}.fake-signature`);
  }, providerId);
}

/**
 * Enable a beta feature flag in localStorage before the app boots.
 * Format Wizard, for example, is hidden from the UI until the user
 * opts in via Settings; e2e tests need the flag pre-seeded so the
 * launcher / actions-menu entry render on first paint.
 */
export async function seedFeatureFlagInitScript(
  page: Page,
  flag: 'formatWizard' | 'assistant' | 'reports' | 'schedulePlan',
): Promise<void> {
  await page.addInitScript((flagName: string) => {
    const KEY = 'tmx_settings';
    const existing = localStorage.getItem(KEY);
    const parsed = existing ? JSON.parse(existing) : {};
    parsed[flagName] = true;
    localStorage.setItem(KEY, JSON.stringify(parsed));
  }, flag);
}

/**
 * Turn on a user PREFERENCE before the app reads it.
 *
 * Deliberately separate from `seedFeatureFlagInitScript`: a preference is not a
 * beta flag, and merging the two would blur the distinction the officials-board
 * toggle exists to make. Writes the stored blob and reloads, because
 * `hydrateConfigFromStorage` runs once at boot — setting the key on a live page
 * changes nothing until something re-reads it.
 */
export async function enablePreference(page: Page, preference: 'officialsBoard'): Promise<void> {
  await page.evaluate((name: string) => {
    const KEY = 'tmx_settings';
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    parsed[name] = true;
    localStorage.setItem(KEY, JSON.stringify(parsed));
  }, preference);
  await page.reload();
  await waitForAppReady(page);
}
