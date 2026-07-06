import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 63 — Clear schedule: "this day (keep completed)" scope.
 *
 * openClearScheduleMenu's DAY_PENDING scope clears only pending matchUps on the
 * active date and preserves completed results — via a single bulkScheduleMatchUps
 * (scheduleCompletedMatchUps stays false, so the factory skips completed). Maps
 * to the BOBOCA completed-orphan class: a regression that re-clears completed
 * results, or misses a pending one, would ship silently. Asserts the exact
 * matchUpIds carried by the dispatched mutation + the resulting schedule state.
 */

const DATE = new Date().toISOString().slice(0, 10);
const STRIP = '.spl-active-strip';
const CLEAR_BTN = 'button:has(i.fa-eraser)';

interface Seed {
  tournamentId: string;
  pendingIds: string[];
  completedId: string;
}

async function seed(page: Page): Promise<Seed> {
  return page.evaluate(
    async ({ date }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Clear Day',
        tournamentAttributes: { tournamentId: 'e2e-clear-day', startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [
          {
            eventName: 'Singles',
            drawSize: 8,
            drawType: 'SINGLE_ELIMINATION',
            // Let the factory complete one R1 matchUp reliably (COMPLETED bucket).
            outcomes: [{ roundNumber: 1, roundPosition: 1, scoreString: '6-2 6-3', winningSide: 1 }],
          },
        ],
        venueProfiles: [{ courtsCount: 4, venueName: 'Clear Venue' }],
      });

      const court = dev.factory.tournamentEngine.getVenuesAndCourts().venues[0].courts[0];
      const all = dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || [];
      const twoSides = (m: any) =>
        (m.sides || []).filter((s: any) => s.participantId || s.participant?.participantId).length === 2;
      const completed = all.find((m: any) => m.matchUpStatus === 'COMPLETED' && twoSides(m));
      const pending = all
        .filter((m: any) => m.roundNumber === 1 && m.matchUpStatus !== 'BYE' && !m.winningSide && twoSides(m))
        .slice(0, 2);

      const place = (mu: any, order: number) =>
        dev.factory.tournamentEngine.addMatchUpScheduleItems({
          matchUpId: mu.matchUpId,
          drawId: mu.drawId,
          schedule: { scheduledDate: date, venueId: court.venueId, courtId: court.courtId, courtOrder: order },
        });
      place(completed, 1);
      place(pending[0], 2);
      place(pending[1], 3);

      const rec = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      await dev.tmx2db.addTournament(rec);
      return {
        tournamentId: tournamentRecord.tournamentId as string,
        pendingIds: [pending[0].matchUpId as string, pending[1].matchUpId as string],
        completedId: completed.matchUpId as string,
      } as Seed;
    },
    { date: DATE },
  );
}

async function scheduledDateOf(page: Page, matchUpId: string): Promise<string | undefined> {
  return page.evaluate((id) => {
    const { matchUp } = dev.factory.tournamentEngine.findMatchUp({ matchUpId: id });
    return matchUp?.schedule?.scheduledDate || undefined;
  }, matchUpId);
}

test.describe('Journey 63 — clear this day (keep completed)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('clears only the pending matchUps and preserves the completed one', async ({ page }) => {
    const s = await seed(page);
    const collector = createMutationCollector(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(s.tournamentId);
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP, { timeout: 10_000 });

    await page.locator(CLEAR_BTN).first().click();
    await page.getByText(/Clear this day \(keep completed\)/).click();
    await page.getByRole('button', { name: 'Ok' }).click();

    const entry = await collector.waitForMethod('bulkScheduleMatchUps', 10_000);
    const ids: string[] = (entry.methods[0].params as any).matchUpIds ?? [];
    expect([...ids].sort()).toEqual([...s.pendingIds].sort());

    // Pending matchUps are unscheduled; the completed one keeps its date.
    await expect.poll(() => scheduledDateOf(page, s.pendingIds[0]), { timeout: 8_000 }).toBeUndefined();
    expect(await scheduledDateOf(page, s.pendingIds[1])).toBeUndefined();
    expect(await scheduledDateOf(page, s.completedId)).toBe(DATE);

    collector.detach();
  });
});
