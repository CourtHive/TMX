import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';
import { S } from '../helpers/selectors';

/**
 * Journey 128 — the tournaments search box searches the CORPUS, not the page it loaded.
 *
 * The listing filters client-side (`tournamentsFilter.ts`). Over a list that fits in memory that
 * is right; over a PAGED list it is a lie told with a confident count, and we shipped exactly that
 * lie on 2026-09-17, when ALTA's public listing served 500 of its 967 tournaments for about an
 * hour. Filtering "narrowed" 500 rows and reported the result as if it were the whole calendar.
 *
 * The public path now asks courthive-query's `GET /tournaments/search`, which searches every
 * published tournament (49,749 of them after the 2026-09-23 projection rebuild) and reports its
 * own total. This journey exists because the pieces are individually unit-tested and their
 * ASSEMBLY is not: the debounce, the provider scoping, the card mapper, and the count banner only
 * meet in a browser.
 *
 * WHY IT IS DETERMINISTIC. Nothing here races. Both endpoints are stubbed by the test, the search
 * hits carry names that appear in NO calendar row, and the calendar rows carry names that appear
 * in no hit — so "which rows are on screen" answers "which source rendered them" with no timing
 * assumption. Revert the wiring in `createTournamentsTable` and the search rows never appear.
 */

const PROVIDER_ID = 'e2e-search-provider';
const CALENDAR_PREFIX = 'E2E Calendar Only Tournament';
const SEARCH_PREFIX = 'E2E Search Result Tournament';
const ROW = `${S.TOURNAMENTS_TABLE} .tabulator-row`;
// `input#…`, not `#…`: the control bar renders a wrapper <p> carrying the SAME id as the input,
// so the bare id selector is a strict-mode violation rather than a missing element.
const SEARCH_INPUT = 'input#tournamentSearch';
const TITLE = '.tmx-tournaments-header__title';

/** What the server says it could serve — deliberately far more than either stub returns. */
const SERVER_TOTAL = 967;

function calendarBody() {
  const tournaments = Array.from({ length: 2 }, (_, i) => ({
    tournamentId: `cal-${i}`,
    providerId: PROVIDER_ID,
    tournament: {
      tournamentId: `cal-${i}`,
      tournamentName: `${CALENDAR_PREFIX} ${i}`,
      startDate: '2026-09-01',
      endDate: '2026-09-03',
    },
  }));
  return JSON.stringify({
    success: true,
    calendar: {
      provider: {
        organisationId: PROVIDER_ID,
        organisationName: 'E2E Search Provider',
        organisationAbbreviation: 'E2ES',
      },
      tournaments,
    },
    paging: { limit: 500, offset: 0, total: tournaments.length, returned: tournaments.length, hasMore: false },
  });
}

/** The discovery projection's shape — flat, and NOT a tournament record. */
function searchBody() {
  const tournaments = Array.from({ length: 3 }, (_, i) => ({
    tournamentId: `hit-${i}`,
    tournamentName: `${SEARCH_PREFIX} ${i}`,
    providerId: PROVIDER_ID,
    startDate: '2027-05-01',
    endDate: '2027-05-03',
    venueName: null,
    city: 'Brno',
    state: null,
    countryCode: 'CZE',
    levelSystem: null,
    levelValue: null,
    entriesOpen: null,
    entriesClose: null,
    feeMin: null,
    feeMax: null,
    feeCurrency: null,
    feeUnit: null,
    eventCount: 2,
    cancelledAt: null,
  }));
  return JSON.stringify({
    tournaments,
    paging: { total: SERVER_TOTAL, returned: tournaments.length, limit: 100, offset: 0, hasMore: false },
  });
}

test.describe('Journey 128 — tournament search asks the server, not the loaded page', () => {
  test('a query renders server hits and reports the server total; clearing it restores the list', async ({ page }) => {
    const searchUrls: string[] = [];

    await page.route('**/provider/calendar', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: calendarBody() }),
    );
    // Matched by PATHNAME, not by a URL glob, and both halves of that matter:
    //   - the ORIGIN varies by environment. `.env.development` sets QUERY_SERVER=:3150, so the
    //     request is absolute to the query service; `.env.production` leaves it empty, so it is
    //     same-origin under a `/query` prefix that nginx routes. A glob pinned to either shape
    //     passes in one environment and silently matches nothing in the other.
    //   - a loose glob like `**/tournaments/search*` ALSO matches this app's own modules, which
    //     Vite serves over HTTP: `/src/pages/tournaments/searchHitToRecord.ts` gets stubbed with
    //     the response body, the app never boots, and the failure surfaces 100 lines away as
    //     "#dnav never appeared". Ask me how I know.
    const isSearchRequest = (url: URL) => /(^|\/)(query\/)?tournaments\/search$/.test(url.pathname);
    await page.route(isSearchRequest, (route) => {
      searchUrls.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'application/json', body: searchBody() });
    });

    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    // The listing renders a Tabulator table unless this says otherwise; pin it so the row
    // selector below is not at the mercy of a persisted preference.
    await page.evaluate(() => localStorage.setItem('tmx_tournaments_view_mode', 'table'));

    // A logged-OUT browser with a provider in scope: the public path, which is the one that
    // searches. (The authenticated list stays on CFS for read-your-writes.)
    await page.evaluate((providerId) => {
      dev.tournamentContext.provider = {
        organisationId: providerId,
        organisationName: 'E2E Search Provider',
        organisationAbbreviation: 'E2ES',
      };
    }, PROVIDER_ID);
    await page.evaluate(() => dev.tournamentContext.router?.navigate(`/tournaments/${Date.now()}`));

    // Baseline: the calendar rows, and only them.
    await expect(page.locator(ROW).filter({ hasText: CALENDAR_PREFIX })).toHaveCount(2);
    await expect(page.locator(TITLE)).toHaveText('Tournaments (2)');

    // TYPED, not `fill()`. The box is wired to `onKeyUp` (`buildSearchItem`), which `fill` does not
    // fire — and typing is also what makes the debounce assertion below mean anything, since it
    // produces one keystroke per character exactly as a user does.
    await page.locator(SEARCH_INPUT).click();
    await page.locator(SEARCH_INPUT).pressSequentially('search result', { delay: 20 });

    // The server's rows replace the loaded ones …
    await expect(page.locator(ROW).filter({ hasText: SEARCH_PREFIX })).toHaveCount(3);
    // … and the rows that were only ever local are gone, so this is a replacement and not a merge.
    await expect(page.locator(ROW).filter({ hasText: CALENDAR_PREFIX })).toHaveCount(0);
    // The count is the SERVER's, not the three rows rendered — the whole point of the change.
    await expect(page.locator(TITLE)).toHaveText(`Tournaments (${SERVER_TOTAL})`);

    // Scoped to the provider whose listing is on screen, by organisationId and not abbreviation.
    expect(searchUrls.length, 'no search request was issued').toBeGreaterThan(0);
    const issued = new URL(searchUrls[searchUrls.length - 1]);
    expect(issued.searchParams.get('q')).toBe('search result');
    expect(issued.searchParams.get('providerId')).toBe(PROVIDER_ID);
    expect(issued.searchParams.get('limit')).toBe('100');

    // Typing is debounced: one request for the whole phrase, not one per character.
    expect(searchUrls.length, 'the search box is not debounced').toBe(1);

    // Clearing the box goes back to the rows the calendar loaded.
    await page.locator(SEARCH_INPUT).press('ControlOrMeta+a');
    await page.locator(SEARCH_INPUT).press('Backspace');
    await expect(page.locator(ROW).filter({ hasText: CALENDAR_PREFIX })).toHaveCount(2);
    await expect(page.locator(ROW).filter({ hasText: SEARCH_PREFIX })).toHaveCount(0);
    await expect(page.locator(TITLE)).toHaveText('Tournaments (2)');
  });
});
