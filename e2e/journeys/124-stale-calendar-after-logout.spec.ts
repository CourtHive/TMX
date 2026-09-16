import { initDevBridge, loginAsSuperAdmin, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';
import { S } from '../helpers/selectors';

/**
 * Journey 124 — a calendar response that outlives its session must not paint.
 *
 * Production incident, 2026-09-15. A super-admin impersonating a provider clicked the
 * stop-impersonating X and then logged out. The X clears the provider scope and re-requests
 * the calendar (`providerState.updateProviderBranding` → navigate → `createTournamentsTable`),
 * and the server answered that unscoped request with EVERY provider's calendar — 49,000+
 * tournaments. It arrived after the logout and rendered into a logged-out browser, because
 * `fromMyCalendars` never checked that the session which got the answer was the one that
 * asked.
 *
 * Two independent fixes; this journey covers the CLIENT half:
 *   - server: a SUPER_ADMIN with no `providerAbbr` now gets an empty list, not the corpus
 *     (`ProvidersService.resolveTargetAbbrs`, covered by `getMyCalendars.spec.ts`);
 *   - client: the response is discarded when the session moved under it
 *     (`sessionScope.ts`, unit-covered in `sessionScope.test.ts`).
 *
 * ## Why this one IS deterministic, unlike journey 113's caveat
 *
 * Journey 113 documents that it cannot prove its own ordering fix: locally the IndexedDB wipe
 * always wins the race, so the stale render never happens and the spec stays green with the
 * fix reverted. That is a race whose timing the test does not own.
 *
 * This is not a race. The window is created by the test — the route handler holds the
 * response for `RESPONSE_DELAY_MS` — and the logout happens inside it by construction. Revert
 * the guard in `createTournamentsTable` and this spec fails every run, because the delayed
 * response has nowhere to go but the table.
 *
 * ## Why the payload is provider-bound
 *
 * The rows have to be ones a logged-out browser must never show. They carry
 * `parentOrganisation`, so if they paint, they painted from the server response for a session
 * that no longer exists — not from the local-IndexedDB fallback a logged-out list legitimately
 * reads.
 */

const STALE_PREFIX = 'E2E Stale Calendar Tournament';
const ROW = `${S.TOURNAMENTS_TABLE} .tabulator-row`;
const AVATAR = '#login';
const PROVIDER_ID = 'e2e-stale-provider';

/** How long the calendar response is held. Long enough to log out inside it. */
const RESPONSE_DELAY_MS = 4000;

/** Comfortably past the delay, so a response that WAS going to paint has painted. */
const SETTLE_MS = RESPONSE_DELAY_MS + 3000;

function staleCalendarBody(count: number) {
  const tournaments = Array.from({ length: count }, (_, i) => ({
    tournamentId: `stale-${i}`,
    providerId: PROVIDER_ID,
    tournament: {
      tournamentId: `stale-${i}`,
      tournamentName: `${STALE_PREFIX} ${i}`,
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      parentOrganisation: { organisationId: PROVIDER_ID, organisationName: 'E2E Stale Provider' },
    },
  }));

  return JSON.stringify({
    success: true,
    calendars: [{ providerAbbr: 'STALE', provider: { organisationAbbreviation: 'STALE' }, tournaments }],
    paging: { limit: 500, offset: 0, total: count, returned: count, hasMore: false },
  });
}

test.describe('Journey 124 — a stale calendar must not paint into a logged-out session', () => {
  test('logging out while the calendar is in flight leaves its rows unrendered', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());

    // `createTournamentsTable` reaches my-calendars ONLY when a userContext exists, and
    // a JWT seeded straight into localStorage produces none — logIn()/silent-refresh are
    // what populate it live. Stub /auth/me and fill the cache through the real fetch.
    await page.route('**/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'e2e-superadmin',
          email: 'e2e@courthive.com',
          isSuperAdmin: true,
          globalRoles: ['SUPER_ADMIN'],
          providerRoles: {},
          providerIds: [],
        }),
      }),
    );

    let servedDelayedResponse = false;
    await page.route('**/provider/my-calendars', async (route) => {
      servedDelayedResponse = true;
      await new Promise((resolve) => setTimeout(resolve, RESPONSE_DELAY_MS));
      await route.fulfill({ status: 200, contentType: 'application/json', body: staleCalendarBody(25) });
    });

    await loginAsSuperAdmin(page);

    // Issue the request under test, then log out while it is still held open.
    await page.reload();
    await waitForAppReady(page);
    await initDevBridge(page);
    await page.evaluate(async () => {
      await dev.fetchUserContext();
    });

    // The list was built at boot with no userContext; rebuild it now that there is one,
    // which is the render that issues the delayed my-calendars request.
    await page.evaluate(() => dev.tournamentContext.router?.navigate(`/tournaments/${Date.now()}`));

    await page.locator(AVATAR).click();
    await page.getByText('Log out', { exact: true }).click();

    // The response lands here, into a session that no longer exists.
    await page.waitForTimeout(SETTLE_MS);

    // Non-degenerate: the delayed route actually served. Without this, a spec that never
    // issued the request would pass for the wrong reason.
    expect(servedDelayedResponse, 'the delayed calendar route never served').toBe(true);

    // The load-bearing assertion. Before the fix, these rows painted after logout.
    await expect(page.locator(ROW).filter({ hasText: STALE_PREFIX })).toHaveCount(0);

    // And the session really is gone — proving the assertion above is about a logged-out
    // browser rather than about a list that simply failed to render.
    // 'tmxToken' is `getJwtTokenStorageKey()` in src/config/localStorage.ts.
    const token = await page.evaluate(() => localStorage.getItem('tmxToken'));
    expect(token).toBeNull();
  });
});
