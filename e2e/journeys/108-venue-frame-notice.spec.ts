import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { todayLocal } from '../helpers/dates';

/**
 * Journey 108 — the venue-frame notice says when the clock is a guess.
 *
 * TMX renders every stored instant (`calledAt`, `scoredTime`, a sign-in, an
 * embargo) in the tournament's own zone — `tournamentRecord.localTimeZone`,
 * resolved through `functions/venueTimeFrame`. Before #1362 it used the
 * BROWSER's, so a director running a Florida event from a Pacific-set laptop
 * read rest, call times and order-of-play timing three hours out, silently, in
 * numbers that stayed plausible.
 *
 * Most tournaments carry no `localTimeZone` today, so the device's zone still
 * has to stand in — refusing to render times would break the running desk. What
 * cannot happen is that standing in SILENTLY: that reproduces the same wrongness
 * through a different door, a page right for one director and wrong for another
 * with nothing on screen to say which. Hence this notice, and hence this
 * journey. The decision is recorded in
 * `Mentat/planning/DECISION_VENUE_TIME_FRAME.md`.
 *
 * The notice is DOM-only and TMX runs vitest without a DOM, so — exactly as
 * journey 106 says of the Inspector popover — this is the only evidence it
 * renders at all. `venueTimeFrame` itself has unit coverage; what no unit test
 * can see is whether the thing ever reaches the screen.
 *
 * The assertions are deliberately about the notice's CONTRACT rather than its
 * wording: it appears only when the venue zone is unset, it names the zone the
 * page is actually using, it routes to where that zone is set, and it goes away
 * once the tournament carries one.
 */

const DATE = todayLocal();
const STRIP_SELECTOR = '.spl-active-strip';
const NOTICE = '[data-tmx="venue-frame-notice"]';
// `openEditDatesModal` hosts in courthive-components' modal, NOT `#tmxModal`.
// Assert on the DIALOG: `.chc-modal-container` is `position: fixed`, so the outer
// section collapses to zero height and reads as hidden while the modal is plainly
// on screen. Journey 106 documents the same trap.
const MODAL = '.chc-modal-dialog';
// Present only in the Edit Dates form — proves WHICH modal opened, so the
// assertion cannot pass on any modal that happens to be up.
const EDIT_DATES_MARKER = '#modalActiveDates';
const VENUE_ZONE = 'America/Denver';

/**
 * A tournament with courts and one scheduled matchUp, and deliberately NO
 * `localTimeZone` — which is the default `generateTournamentRecord` produces and
 * the state most real tournaments are in.
 *
 * Persists through `tmx2db.addTournament` reading `getTournament()`, not the
 * object `generateTournamentRecord` returned: the engine holds its own record
 * under `setState: true`, so post-generation mutations are not on the returned
 * one. (Journey 102 documents the same trap.)
 */
async function seedZonelessTournament(page: Page): Promise<string> {
  return page.evaluate(async (date) => {
    await dev.tmx2db.initDB();
    const engine = dev.factory.tournamentEngine;

    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'E2E Venue Frame',
      tournamentAttributes: { tournamentId: 'e2e-venue-frame', startDate: date, endDate: date },
      drawProfiles: [{ eventName: 'Frame Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION', drawId: 'e2eFrameDraw' }],
      venueProfiles: [{ courtsCount: 2, venueName: 'Frame Venue' }],
    });

    const courts = engine.getVenuesAndCourts().venues[0].courts;
    const playable = (engine.allTournamentMatchUps({ matchUpFilters: { roundNumbers: [1] } }).matchUps || []).filter(
      (m: any) => (m.sides || []).every((s: any) => s.participant),
    );

    engine.addMatchUpScheduleItems({
      schedule: {
        courtId: courts[0].courtId,
        venueId: courts[0].venueId,
        courtOrder: 1,
        scheduledDate: date,
        scheduledTime: '09:30',
      },
      removePriorValues: true,
      matchUpId: playable[0].matchUpId,
      drawId: 'e2eFrameDraw',
    });

    const record = engine.getTournament().tournamentRecord;
    // The premise of the whole journey — if a future mocksEngine default started
    // supplying a zone, every assertion below would quietly invert.
    if (record.localTimeZone) throw new Error('fixture carries a localTimeZone; the unset case is untestable');
    await dev.tmx2db.addTournament(record);

    return tournamentRecord.tournamentId as string;
  }, DATE);
}

async function openGrid(page: Page, tournamentId: string): Promise<void> {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToScheduling();
  await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });
}

test.describe('Journey 108 — the venue-frame notice says when the clock is a guess', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('appears on the schedule when the tournament carries no time zone', async ({ page }) => {
    const tournamentId = await seedZonelessTournament(page);
    await openGrid(page, tournamentId);

    await expect(page.locator(NOTICE)).toBeVisible({ timeout: 10_000 });
  });

  test('names the zone the page is actually reading times in', async ({ page }) => {
    const tournamentId = await seedZonelessTournament(page);
    await openGrid(page, tournamentId);

    // Not a wording assertion: the point is that the operator can see WHICH zone
    // is standing in, so a director in the wrong one can recognise it as wrong.
    const deviceZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    await expect(page.locator(NOTICE)).toContainText(deviceZone, { timeout: 10_000 });
  });

  test('routes to where the zone is set, rather than only complaining', async ({ page }) => {
    const tournamentId = await seedZonelessTournament(page);
    await openGrid(page, tournamentId);

    await page.locator(NOTICE).click();
    await expect(page.locator(MODAL)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(EDIT_DATES_MARKER)).toHaveCount(1);
  });

  test('goes away once the tournament carries a venue zone', async ({ page }) => {
    const tournamentId = await seedZonelessTournament(page);
    await openGrid(page, tournamentId);
    await expect(page.locator(NOTICE)).toBeVisible({ timeout: 10_000 });

    await page.evaluate(async (localTimeZone) => {
      const engine = dev.factory.tournamentEngine;
      engine.setTournamentLocalTimeZone({ localTimeZone });
      await dev.tmx2db.addTournament(engine.getTournament().tournamentRecord);
    }, VENUE_ZONE);

    await openGrid(page, tournamentId);
    // The grid is present, so the bar has rebuilt — the notice's absence is a
    // decision it made, not a page that has not rendered yet.
    await expect(page.locator(NOTICE)).toHaveCount(0);
  });
});
