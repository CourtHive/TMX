import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 61 — Now-strip auto-call due-gating.
 *
 * When a court has no live/called match, its next pending match is auto-called
 * (setMatchUpCalledAt) on strip render — UNLESS its scheduledTime is strictly in
 * the future (computeAutoCalls, autoCallDueMatches.ts). runAutoCallPass fires on
 * the strip refresh (gridView.ts:2241, today-gated), so the decision is
 * observable at mount via the mutation collector. A regression here silently
 * calls matches to court at the wrong time — a participant-notification hazard.
 */

const DATE = new Date().toISOString().slice(0, 10);
const STRIP = '.spl-active-strip';

/** Seed a single-court venue and schedule one pending R1 matchUp on today with the given time. */
async function seedOnePlaced(page: Page, scheduledTime?: string): Promise<{ tournamentId: string; matchUpId: string }> {
  return page.evaluate(
    async ({ date, scheduledTime }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        setState: true,
        tournamentName: 'E2E Auto Call',
        tournamentAttributes: { tournamentId: 'e2e-auto-call', startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 1, venueName: 'Auto Venue' }],
      });

      const court = dev.factory.tournamentEngine.getVenuesAndCourts().venues[0].courts[0];
      const match = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
        (m: any) =>
          m.matchUpStatus !== 'BYE' &&
          (m.sides || []).filter((s: any) => s.participantId || s.participant?.participantId).length === 2,
      );

      dev.factory.tournamentEngine.addMatchUpScheduleItems({
        matchUpId: match.matchUpId,
        drawId: match.drawId,
        schedule: {
          scheduledDate: date,
          venueId: court.venueId,
          courtId: court.courtId,
          courtOrder: 1,
          ...(scheduledTime ? { scheduledTime } : {}),
        },
      });

      const rec = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      await dev.tmx2db.addTournament(rec);
      return { tournamentId: tournamentRecord.tournamentId as string, matchUpId: match.matchUpId as string };
    },
    { date: DATE, scheduledTime },
  );
}

test.describe('Journey 61 — now-strip auto-call due-gating', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('a due pending match on a free court is auto-called on strip render', async ({ page }) => {
    // No scheduledTime → due now → should be called.
    const seed = await seedOnePlaced(page);
    const collector = createMutationCollector(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP, { timeout: 10_000 });

    const entry = await collector.waitForMethod('setMatchUpCalledAt', 10_000);
    const calledId = (entry.methods.find((m) => m.method === 'setMatchUpCalledAt')?.params as any)?.matchUpId;
    expect(calledId).toBe(seed.matchUpId);

    collector.detach();
  });

  test('a match with a future scheduledTime is NOT auto-called', async ({ page }) => {
    // Strictly-future time → keep waiting → no call.
    await seedOnePlaced(page, '23:59');
    const collector = createMutationCollector(page);

    const tournament = new TournamentPage(page);
    await tournament.goto('e2e-auto-call');
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP, { timeout: 10_000 });

    // Let the mount-time auto-call pass settle (the 30s ticker won't fire in-window).
    await page.waitForTimeout(1500);
    expect(collector.hasMethod('setMatchUpCalledAt')).toBe(false);

    collector.detach();
  });
});
