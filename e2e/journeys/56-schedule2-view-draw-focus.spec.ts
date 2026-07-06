import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 56 — Schedule2 "View draw" scrolls-to + highlights the matchUp
 *
 * The schedule cell popover's "View draw" icon (fa-sitemap) now passes the
 * matchUpId (+ structureId) into navigateToEvent, which stashes a pending focus
 * so renderDrawView scrolls the matchUp into view and pulses it — mirroring the
 * matchUps-page event-chip navigation. Previously it navigated to the draw with
 * no focus, dropping the user at the top of the structure.
 *
 * Contract asserted: after clicking "View draw", the draws view renders and the
 * target matchUp element receives the transient `matchup-highlight` class
 * (added by highlightMatchUp, removed after 4s).
 */

const DATE = new Date().toISOString().slice(0, 10);
const STRIP_SELECTOR = '.spl-active-strip';

/** Seed a tournament and place its first playable matchUp on court0/order1 in a
 *  single persist, so it renders as a schedule2 grid cell. */
async function seedScheduledMatchUp(page: Page): Promise<{ tournamentId: string; courtId: string; matchUpId: string }> {
  return page.evaluate(async (date) => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'E2E View Draw Focus',
      tournamentAttributes: { tournamentId: 'e2e-view-draw-focus', startDate: date, endDate: date },
      participantsProfile: { scaledParticipantsCount: 16 },
      drawProfiles: [{ eventName: 'Focus Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
      venueProfiles: [{ courtsCount: 2, venueName: 'Focus Venue' }],
    });

    const court = dev.factory.tournamentEngine.getVenuesAndCourts().venues[0].courts[0];
    const mu = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
      (m: any) =>
        m.matchUpStatus !== 'BYE' &&
        (m.sides || []).filter((s: any) => s.participantId || s.participant?.participantId).length === 2,
    );
    if (!mu) throw new Error('No playable matchUp in seeded draw');

    dev.factory.tournamentEngine.addMatchUpScheduleItems({
      matchUpId: mu.matchUpId,
      drawId: mu.drawId,
      schedule: { scheduledDate: date, courtId: court.courtId, venueId: court.venueId, courtOrder: 1 },
    });

    const rec = dev.factory.tournamentEngine.getTournament().tournamentRecord;
    await dev.tmx2db.addTournament(rec);
    return {
      tournamentId: tournamentRecord.tournamentId as string,
      courtId: court.courtId as string,
      matchUpId: mu.matchUpId as string,
    };
  }, DATE);
}

test.describe('Journey 56 — Schedule2 "View draw" focus', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('clicking "View draw" navigates to the draw and highlights the matchUp', async ({ page }) => {
    const seed = await seedScheduledMatchUp(page);
    const mu = seed.matchUpId;

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    // Open the schedule grid cell popover, then click its "View draw" icon.
    const gridCell = `[data-court-id="${seed.courtId}"][data-court-order="1"][data-matchup-id="${mu}"]`;
    await page.locator(gridCell).click();

    const viewDrawBtn = page.locator('button[title="View draw"]');
    await viewDrawBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await viewDrawBtn.click();

    // The draws view renders...
    await expect(page.locator(S.DRAWS_VIEW)).toBeVisible({ timeout: 10_000 });

    // ...and the target matchUp is pulsed via the transient highlight class.
    // The draw matchUp element carries id={matchUpId} (courthive-components), which
    // is what highlightMatchUp targets; it adds `matchup-highlight` then removes it
    // after 4s — poll so we catch it inside the window.
    const focusTarget = page.locator(`${S.DRAWS_VIEW} [id="${mu}"]`).first();
    await expect(focusTarget).toHaveClass(/matchup-highlight/, { timeout: 5_000 });
  });
});
