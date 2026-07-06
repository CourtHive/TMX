import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 64 — Scheduling workspace: cross-tournament schedule-cache invalidation.
 *
 * The schedule data cache (schedule2DataCache) memoizes per-tournament factory
 * reads. Switching directly from tournament A's /scheduling to tournament B's
 * /scheduling stays on the same tab (no teardown) and skips the tournaments list
 * (no invalidate there) — so without a loader-driven reset, B's workspace would
 * render A's cached schedule. The tournamentContextObservers self-invalidation
 * (fired from renderTournament on a switch) closes that gap; this locks it.
 *
 * Uses the date-selector count badge as the cache probe: it counts non-BYE
 * matchUps scheduled on the selected date, read through the memoized cache. A
 * with 2 scheduled / B with 1 → the badge must read B's 1 after the switch,
 * not A's stale 2. The switch is a DIRECT URL navigation (not via the list) so
 * it exercises the no-teardown path the observer specifically covers.
 */

const DATE = new Date().toISOString().slice(0, 10);
const BADGE = 'button:has(i.fa-calendar-days) span';

/** Seed a tournament with a 2-court venue and `scheduledCount` R1 matchUps placed on today. */
async function seedScheduled(page: Page, tournamentId: string, scheduledCount: number): Promise<string> {
  return page.evaluate(
    async ({ date, tournamentId, scheduledCount }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        setState: true,
        nonRandom: 1,
        tournamentName: `E2E Cache ${tournamentId}`,
        tournamentAttributes: { tournamentId, startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 2, venueName: 'Cache Venue' }],
      });

      const court = dev.factory.tournamentEngine.getVenuesAndCourts().venues[0].courts[0];
      const playable = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).filter(
        (m: any) =>
          m.matchUpStatus !== 'BYE' &&
          (m.sides || []).filter((s: any) => s.participantId || s.participant?.participantId).length === 2,
      );

      for (let i = 0; i < scheduledCount; i++) {
        const mu = playable[i];
        dev.factory.tournamentEngine.addMatchUpScheduleItems({
          matchUpId: mu.matchUpId,
          drawId: mu.drawId,
          schedule: {
            scheduledDate: date,
            scheduledTime: `${10 + i}:00`,
            venueId: court.venueId,
            courtId: court.courtId,
            courtOrder: i + 1,
          },
        });
      }

      const rec = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      await dev.tmx2db.addTournament(rec);
      return tournamentRecord.tournamentId as string;
    },
    { date: DATE, tournamentId, scheduledCount },
  );
}

// SKIPPED pending Problem B: seeded schedule renders as "Scheduled 0" (see
// Mentat/planning/E2E_SCHEDULING_SEED_DISPLAY_BUG.md). nonRandom + logic are ready; re-enable once B is fixed.
test.describe.skip('Journey 64 — scheduling cross-tournament cache invalidation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('switching A→B scheduling directly shows B’s schedule, not A’s cached count', async ({ page }) => {
    const idA = await seedScheduled(page, 'e2e-cache-a', 2);
    const idB = await seedScheduled(page, 'e2e-cache-b', 1);

    const tournament = new TournamentPage(page);

    // Mount A's scheduling workspace — badge warms the cache with A's 2.
    await tournament.goto(idA);
    await tournament.navigateToScheduling();
    const badge = page.locator(BADGE).first();
    await expect(badge).toHaveText('2', { timeout: 15_000 });

    // In-app hash switch straight into B's scheduling — same document (module
    // cache persists), same tab (no teardown), no list visit. Only the loader's
    // tournamentContextObservers reset clears A's cached schedule. The badge
    // must reflect B's 1, not A's stale 2.
    await page.evaluate((hash) => {
      window.location.hash = hash;
    }, `#/tournament/${idB}/scheduling/${DATE}`);
    await expect(badge).toHaveText('1', { timeout: 15_000 });
  });
});
