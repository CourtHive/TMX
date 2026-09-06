import { test, expect } from '@playwright/test';
import { isCfsApiPath, routeApiToCfs } from '../helpers/cfsProxy';
import { waitForAppReady } from '../helpers/dev-bridge';

/**
 * Journey 120 — the CFS proxy must not intercept anything Vite serves.
 *
 * `routeApiToCfs()` rewrites the page's API calls to a live CFS. Its matcher used
 * to be an UNANCHORED regex tested against the whole URL, so in dev mode — where
 * Vite serves every source module from the page's own origin — it also captured
 * `/src/services/factory/…`, `/src/services/provider/…`, `/src/pages/admin/…`,
 * `/src/pages/participation/…` and `/@fs/…/CourtHive/factory/dist/esm/index.mjs`
 * (the repo directory is named `factory`). Those module requests were re-fetched
 * from CFS, 404'd, and the app never booted: a blank page, and all nine CFS-gated
 * journeys failing identically on `waitForSelector('#dnav')`.
 *
 * Nothing caught it because the whole cluster self-skips unless a server is
 * reachable, and journeys are in no CI workflow — so the failure only appears
 * when someone deliberately runs the suite against a live CFS.
 *
 * This spec needs no server: it asserts that installing the proxy leaves the app
 * able to boot, and that no script request dies while it is installed.
 */
test.describe('Journey 120 — CFS proxy scope', () => {
  test('installing the proxy does not break the module graph', async ({ page }) => {
    const failedScripts: string[] = [];
    page.on('requestfailed', (request) => {
      if (['script', 'stylesheet', 'document'].includes(request.resourceType())) {
        failedScripts.push(`${request.resourceType()} ${new URL(request.url()).pathname}`);
      }
    });

    await routeApiToCfs(page);
    await page.goto('/');

    // The real assertion: the app boots. This is the exact wait that failed for
    // every CFS-gated journey while the matcher was over-broad.
    await waitForAppReady(page);

    expect(failedScripts, 'the proxy must not swallow anything Vite serves').toEqual([]);
  });

  test('re-installing the proxy does not shadow a stub registered in between', async ({ page }) => {
    // Playwright matches the LAST-registered route FIRST, and `AuthFlow.login()`
    // installs the proxy itself. Before the installer was made idempotent, the
    // sequence below let the second install jump ahead of the stub — which is how
    // journey 103's registrations stub stopped applying: the request escaped to
    // the real declarations service, 404'd, and the table rendered zero rows
    // while every geometry assertion after it stayed green for the wrong reason.
    await routeApiToCfs(page);
    await page.route('**/registrations?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ stub: true }]) }),
    );
    await routeApiToCfs(page); // what AuthFlow.login() does

    await page.goto('/');
    const body = await page.evaluate(() =>
      fetch('http://localhost:3120/registrations?provider=E2E&tournamentId=probe').then((r) => r.text()),
    );

    expect(JSON.parse(body), 'the spec-level stub must still win').toEqual([{ stub: true }]);
  });

  test('the matcher accepts CFS endpoints and rejects Vite paths', () => {
    for (const apiPath of [
      '/auth/login',
      '/provider/list',
      '/factory/tournament',
      '/participation/index',
      '/registrations/profile',
      '/admin/users',
      '/declarations/list',
      '/auth',
    ]) {
      expect(isCfsApiPath(apiPath), `${apiPath} should reach CFS`).toBe(true);
    }

    for (const vitePath of [
      '/src/services/factory/engine.ts',
      '/src/services/provider/providerState.ts',
      '/src/services/provider/initProviderSwitcher.ts',
      '/src/pages/admin/renderAdminPage.ts',
      '/src/pages/participation/renderProviderSchedulePage.ts',
      '/@fs/Users/someone/Development/GitHub/CourtHive/factory/dist/esm/index.mjs',
      '/node_modules/.vite/deps/tods-competition-factory.js',
      '/assets/index-D4nT9v.js',
      '/',
    ]) {
      expect(isCfsApiPath(vitePath), `${vitePath} must be served by Vite`).toBe(false);
    }
  });
});
