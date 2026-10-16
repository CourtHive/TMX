import { initDevBridge, resetState, waitForAppReady, seedSuperAdminTokenInitScript } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { todayLocal } from '../helpers/dates';

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

const DATE = todayLocal();
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
        schedule: {
          scheduledDate: date,
          scheduledTime: '10:00',
          venueId: court.venueId,
          courtId: court.courtId,
          courtOrder: 1,
        },
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

test('mode navigation preserves the shared-facility cache within one scheduling tab', async ({ page }) => {
  await seedSuperAdminTokenInitScript(page);
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await seedPrimary(page);
  let fetches = 0;
  await page.route('**/factory/schedule-projection', async (route) => {
    fetches++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ scheduleCells: [] }) });
  });
  const tournament = new TournamentPage(page);
  await tournament.goto(ID);
  const go = (mode: string) =>
    page.evaluate(
      ({ id, date, mode }) => dev.tournamentContext.router?.navigate(`/tournament/${id}/scheduling/${date}/${mode}`),
      { id: ID, date: DATE, mode },
    );
  await go('grid');
  await expect.poll(() => fetches).toBe(1);
  await go('profile');
  await expect(page).toHaveURL(/\/profile$/);
  await go('grid');
  await page.waitForSelector('.spl-active-strip');
  expect(fetches).toBe(1);
});
