import { initDevBridge, loginAsSuperAdmin, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { S } from '../helpers/selectors';

/**
 * Journey 113 — logging out must not leave the previous user's tournaments on screen.
 *
 * Regression (#1370). `logOut()` navigates SYNCHRONOUSLY:
 *
 *   void tmx2db.deleteProviderBoundTournaments().then(resetLocalCalendar)...  // async
 *   context.router?.navigate(`/${TMX_TOURNAMENTS}/logout`);                   // runs first
 *
 * The navigate re-renders the tournaments list, and with the identity just cleared
 * `createTournamentsTable` takes its `fromLocalDb` fallback — reading local IndexedDB while
 * the wipe is still in flight. So the departing user's provider-bound tournaments paint for
 * whoever is at the browser next, and nothing re-reads afterwards: they sit there until a
 * manual reload. Impersonation makes it worse rather than causing it, because browsing an
 * impersonated provider seeds more provider-bound records first — which is how CA hit it.
 *
 * ## What this journey does and does NOT prove — read before trusting it
 *
 * It covers the post-logout END STATE: the provider-bound tournament is gone from the list
 * and from storage, and the unowned one survives. That is real regression value — it fails if
 * anyone breaks the wipe's selectivity.
 *
 * It does **not** prove the redraw fix. Reverting `logOut`'s `.finally(redraw)` leaves this
 * journey GREEN, which was established rather than assumed: the revert was made to compile
 * (`check-types` and `lint` both exit 0 first) and the spec still passed. Locally the wipe
 * simply wins the race, so the stale render never happens. Adding 600 ballast records did not
 * open the window either, and counting anchor rebuilds does not separate the two states
 * because the logout navigate alone produces several childList mutations.
 *
 * Recording that here rather than deleting the journey, and rather than tuning a threshold
 * until it went red — a probe tuned to pass is not evidence. Covering the ORDERING needs a
 * different instrument: export `redrawTournamentsListAfterWipe` (or the wipe chain) and unit
 * test with `tmx2db` and the tournaments-table module mocked, asserting the table is rebuilt
 * only after the wipe promise settles. That is deterministic; this is not.
 *
 * ## Why `/provider/my-calendars` is stubbed
 *
 * Logged in, `createTournamentsTable` takes its `userContext` branch and asks the server for
 * calendars; only an empty/failed answer falls through to `fromLocalDb`, which is the path
 * this journey is about. Against the preview server that request never resolves usefully — a
 * first cut of this spec sat at zero rows with `tmx_local_calendar_migrated` still `null`,
 * proving `fromLocalDb` had not run at all rather than having run and found nothing. Stubbing
 * it to an empty calendar set makes the fallback deterministic; it is the same state a
 * logged-in user with no server-side calendars is in.
 *
 * ## Why the local tournament is not decoration
 *
 * Asserting only that the provider-bound row disappears would pass if logout simply broke
 * the list — an empty table satisfies "the row is gone" for entirely the wrong reason. The
 * wipe is deliberately SELECTIVE: `isProviderBoundTournament` keys on
 * `parentOrganisation.organisationId`, and demo/scratchpad tournaments without one are
 * preserved (USER_TOURNAMENT_ACCESS_MODEL.md PR 11). So the local tournament is the control:
 * it must still be there afterwards, and its presence is what proves the list re-read and
 * rendered rather than collapsed.
 */

const PROVIDER_BOUND = 'E2E Provider Bound Tournament';
const LOCAL_ONLY = 'E2E Local Only Tournament';
const ROW = `${S.TOURNAMENTS_TABLE} .tabulator-row`;
const AVATAR = '#login';
const PROVIDER_ID = 'e2e-provider-1';
const LOCAL_BUCKET = '__local__';

/**
 * Two tournaments in IndexedDB: one carrying `parentOrganisation.organisationId` (the shape
 * the wipe targets) and one without (the shape it must preserve).
 *
 * Records are taken from `getTournament()` rather than the object `generateTournamentRecord`
 * returned — under `setState: true` the engine holds its own copy, so post-generation
 * mutations are not on the returned one. Journeys 102 and 108 document the same trap.
 *
 * **The calendar entry is not optional.** The list reads lightweight entries out of the
 * `providers` store (`readLocalCalendarEntries`), NOT the tournaments table — so
 * `addTournament` alone seeds a tournament the list cannot see, and the first attempt at this
 * journey failed its own pre-condition with the Welcome view on screen. Production keeps the
 * two in step via `maintainLocalCalendarEntry` on every save; this mirrors that exactly,
 * bucketing by `parentOrganisation.organisationId` with `__local__` for the unowned record —
 * which is also precisely the split the wipe acts on.
 */
async function seedBothTournaments(page: Page): Promise<void> {
  await page.evaluate(
    async ({ providerName, localName, providerId, localBucket }) => {
      await dev.tmx2db.initDB();
      const engine = dev.factory.tournamentEngine;
      const mocks = dev.factory.mocksEngine;

      const persist = async (tournamentRecord: any, bucket: string) => {
        await dev.tmx2db.addTournament(tournamentRecord);
        const entry = engine.getTournamentCalendarEntry({ tournamentRecord });
        await dev.tmx2db.upsertCalendarEntry(bucket, entry);
      };

      mocks.generateTournamentRecord({ nonRandom: 1, setState: true, tournamentName: providerName });
      const bound = engine.getTournament().tournamentRecord;
      bound.parentOrganisation = { organisationId: providerId, organisationName: 'E2E Provider' };
      await persist(bound, providerId);

      mocks.generateTournamentRecord({ nonRandom: 1, setState: true, tournamentName: localName });
      const local = engine.getTournament().tournamentRecord;
      // The premise of the control. If a future mocksEngine default started stamping a
      // parentOrganisation, this record would be wiped too and the control would silently
      // stop controlling for anything.
      if (local.parentOrganisation) throw new Error('local fixture carries a parentOrganisation');
      await persist(local, localBucket);

    },
    { providerName: PROVIDER_BOUND, localName: LOCAL_ONLY, providerId: PROVIDER_ID, localBucket: LOCAL_BUCKET },
  );
}

function row(page: Page, name: string) {
  return page.locator(ROW).filter({ hasText: name });
}

test.describe('Journey 113 — logout clears the departing user tournaments from the list', () => {
  test('the provider-bound tournament goes, the local one stays, without a reload', async ({ page }) => {
    // Empty calendars ⇒ createTournamentsTable falls through to local IndexedDB, the branch
    // logout lands on. Routed before the first navigation so no render can beat it.
    await page.route('**/provider/my-calendars', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ calendars: [] }) }),
    );

    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());

    await loginAsSuperAdmin(page);
    await seedBothTournaments(page);

    // `reload`, NOT `goto('/#/tournaments')`. The app is already on that route, so Navigo
    // treats the navigation as a no-op and the list is never rebuilt — the table would still
    // be the one built at boot against an empty database. The first cut of this spec did
    // exactly that and sat at zero rows with `tmx_local_calendar_migrated` still `null`,
    // which is what proved the list had not re-read rather than having read and found nothing.
    await page.reload();
    await waitForAppReady(page);
    await initDevBridge(page);

    // Prove the fixture is NON-DEGENERATE before asserting anything about it: both rows must
    // actually be on screen, or "the row is gone" afterwards means nothing. A list that never
    // rendered would satisfy the post-condition trivially.
    await page.locator(S.TOURNAMENTS_TABLE).waitFor({ timeout: 15_000 });
    await expect(row(page, PROVIDER_BOUND)).toHaveCount(1, { timeout: 15_000 });
    await expect(row(page, LOCAL_ONLY)).toHaveCount(1);

    // The real gesture — logOut is not exposed on the dev bridge, and going through the
    // avatar menu is what the user did.
    await page.locator(AVATAR).click();
    await page.getByText('Log out', { exact: true }).click();

    // The load-bearing assertion. No reload, no second navigation: the list must re-read
    // itself once the wipe lands. Before the fix this row survived indefinitely, because
    // nothing re-read after the delete resolved.
    await expect(row(page, PROVIDER_BOUND)).toHaveCount(0, { timeout: 15_000 });

    // Control: the wipe is selective, and the list genuinely re-rendered rather than
    // collapsing. Without this, a logout that emptied the table would pass the line above.
    await expect(row(page, LOCAL_ONLY)).toHaveCount(1);

    // And the wipe really reached storage — not merely the view. Distinguishes "the list
    // stopped showing it" from "it is gone", which is the difference the next login sees.
    const remaining = await page.evaluate(async () => {
      const all = await dev.tmx2db.findAllTournaments();
      return all.map((t: any) => t.tournamentName);
    });
    expect(remaining).toContain(LOCAL_ONLY);
    expect(remaining).not.toContain(PROVIDER_BOUND);
  });
});
