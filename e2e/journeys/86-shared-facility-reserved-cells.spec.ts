import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady, seedSuperAdminTokenInitScript } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 86 — Shared-facility RESERVED cells.
 *
 * A court slot taken by another facility-sharing tournament the viewer can't author renders as a
 * read-only "reserved" cell — fed by a slim schedule projection, NOT by loading peer records. The
 * grid injects reserved cells into empty slots (`mergeReservedCellsIntoRows`) and courthive-components
 * renders the `isReserved` kind.
 *
 * The projection endpoint is stubbed here (the server-side coordination-view/access work that makes
 * it return other-tournament cells is separate). The primary owns court-order 1 on the shared court;
 * the stubbed peer occupies court-order 2 — which must show as a reserved, non-draggable cell.
 */

const DATE = new Date().toISOString().slice(0, 10);
const ID = 'e2e-reserved-primary';
const PEER = 'e2e-reserved-peer';

async function seedPrimary(page: Page): Promise<{ courtId: string; venueId: string; aMatchUpId: string }> {
  return page.evaluate(
    async ({ date, id, peer }) => {
      await dev.tmx2db.initDB();
      dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Reserved Primary',
        tournamentAttributes: { tournamentId: id, startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 2, venueName: 'Shared Venue' }],
      });
      const court = dev.factory.tournamentEngine.getVenuesAndCourts().venues[0].courts[0];
      const mu = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).filter(
        (m: any) =>
          m.matchUpStatus !== 'BYE' &&
          (m.sides || []).filter((s: any) => s.participantId || s.participant?.participantId).length === 2,
      )[0];
      dev.factory.tournamentEngine.addMatchUpScheduleItems({
        matchUpId: mu.matchUpId,
        drawId: mu.drawId,
        schedule: { scheduledDate: date, scheduledTime: '10:00', venueId: court.venueId, courtId: court.courtId, courtOrder: 1 },
      });
      const rec = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      rec.linkedTournamentIds = [id, peer]; // links drive which peers the projection is requested for
      dev.factory.tournamentEngine.setState(rec); // put the linked record back on the engine (goto may reuse it)
      await dev.tmx2db.addTournament(rec);
      return { courtId: court.courtId, venueId: court.venueId, aMatchUpId: mu.matchUpId as string };
    },
    { date: DATE, id: ID, peer: PEER },
  );
}

test.describe('Journey 86 — shared-facility reserved cells', () => {
  test.beforeEach(async ({ page }) => {
    await seedSuperAdminTokenInitScript(page);
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('a peer’s court occupancy renders as a read-only reserved cell on the shared court', async ({ page }) => {
    const { courtId, venueId, aMatchUpId } = await seedPrimary(page);

    // Stub the schedule projection: the peer occupies court-order 2 on the shared court at 14:00.
    await page.route('**/factory/schedule-projection', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scheduleCells: [
            {
              tournamentId: PEER,
              access: 'view', // coordination-view: a peer the viewer can't author → reserved
              matchUpId: 'peer-mu',
              courtId,
              venueId,
              courtOrder: 2,
              scheduledDate: DATE,
              scheduledTime: '14:00',
              labels: ['Should Not Render'], // opaque cell kind must never surface participant labels
            },
          ],
        }),
      });
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(ID);
    await page.waitForFunction(
      (id) => dev.factory.competitionEngine.getTournamentInfo()?.tournamentInfo?.tournamentId === id,
      ID,
      { timeout: 15_000 },
    );
    await page.evaluate((hash) => (globalThis.location.hash = hash), `#/tournament/${ID}/scheduling/${DATE}/grid`);

    // Own matchUp renders normally at court-order 1.
    await page.waitForSelector(`[data-court-id="${courtId}"][data-court-order="1"][data-matchup-id="${aMatchUpId}"]`, {
      state: 'visible',
      timeout: 15_000,
    });

    // The peer's slot renders as a reserved cell at court-order 2 (fetched async, then the grid refreshes).
    const reserved = page.locator(`[data-court-id="${courtId}"][data-court-order="2"] .spl-cell--reserved`);
    await reserved.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(reserved).toContainText('Reserved');
    await expect(reserved).toContainText('14:00');
    // Opaque + read-only: no participant labels, and the wrapper carries no matchUpId (so no drag).
    await expect(reserved).not.toContainText('Should Not Render');
    const wrapper = page.locator(`[data-court-id="${courtId}"][data-court-order="2"]`).first();
    expect(await wrapper.getAttribute('data-matchup-id')).toBeNull();
  });
});
