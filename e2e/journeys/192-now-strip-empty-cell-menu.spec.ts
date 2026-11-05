import { initDevBridge, resetState } from '../helpers/dev-bridge';
import { expect, test, type Page } from '@playwright/test';
import { todayLocal } from '../helpers/dates';

const DATE = todayLocal();
const ID = 'e2e-now-strip-empty-cell-menu';

test.use({ timezoneId: 'America/New_York' });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${DATE}T15:50:00.000Z`));
});

async function seed(page: Page, pending = false, activeRow?: number) {
  await page.goto('/#/tournaments');
  await initDevBridge(page);
  await resetState(page);
  await page.evaluate(() => localStorage.clear());
  return page.evaluate(
    async ({ date, id, pending, activeRow }) => {
      dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        startDate: date,
        endDate: date,
        tournamentAttributes: { tournamentId: id, localTimeZone: 'America/New_York' },
        participantsProfile: { scaledParticipantsCount: 8 },
        drawProfiles: [{ eventName: 'Strip history', drawSize: 8 }],
        venueProfiles: [{ courtsCount: 4 }],
      });
      const engine = dev.factory.tournamentEngine;
      const court = engine.getVenuesAndCourts().venues[0].courts[3];
      const matches = engine.allTournamentMatchUps().matchUps.filter((m: any) => m.roundNumber === 1);
      const history = matches[0];
      function accepted(result: any) {
        if (!result.success) throw new Error(JSON.stringify(result));
      }
      accepted(
        engine.addMatchUpScheduleItems({
          matchUpId: history.matchUpId,
          drawId: history.drawId,
          schedule: {
            scheduledDate: date,
            scheduledTime: pending ? '23:59' : '10:00',
            courtId: court.courtId,
            venueId: court.venueId,
            courtOrder: activeRow === 1 ? 2 : 1,
          },
        }),
      );
      if (!pending) {
        accepted(
          engine.setMatchUpCalledAt({
            matchUpId: history.matchUpId,
            drawId: history.drawId,
            calledAt: `${date}T15:00:00.000Z`,
          }),
        );
        accepted(
          engine.addMatchUpScheduleItems({
            matchUpId: history.matchUpId,
            drawId: history.drawId,
            schedule: { startTime: '10:00' },
          }),
        );
        accepted(
          engine.setMatchUpStatus({
            matchUpId: history.matchUpId,
            drawId: history.drawId,
            outcome: {
              matchUpStatus: 'COMPLETED',
              winningSide: 1,
              score: {
                sets: [
                  { setNumber: 1, side1Score: 6, side2Score: 3, winningSide: 1 },
                  { setNumber: 2, side1Score: 6, side2Score: 3, winningSide: 1 },
                ],
              },
            },
          }),
        );
      }
      const active = matches[1];
      if (activeRow !== undefined) {
        accepted(
          engine.addMatchUpScheduleItems({
            matchUpId: active.matchUpId,
            drawId: active.drawId,
            schedule: { scheduledDate: date, courtId: court.courtId, venueId: court.venueId, courtOrder: activeRow },
          }),
        );
        accepted(
          engine.setMatchUpStatus({
            matchUpId: active.matchUpId,
            drawId: active.drawId,
            outcome: { matchUpStatus: 'IN_PROGRESS' },
          }),
        );
      }
      const record = engine.getTournament().tournamentRecord;
      await dev.tmx2db.addTournament(record);
      return { courtId: court.courtId, historyId: history.matchUpId, activeId: active.matchUpId };
    },
    { date: DATE, id: ID, pending, activeRow },
  );
}

for (const pending of [false, true]) {
  test(`a free Court 4 opens Assign and Block time when grid row 1 holds ${pending ? 'uncalled future work' : 'a completed match'}`, async ({
    page,
  }) => {
    const target = await seed(page, pending);
    await page.goto(`/#/tournament/${ID}/scheduling/${DATE}/grid`);
    await initDevBridge(page);
    const strip = page.locator(`.spl-active-strip-cell[data-court-id="${target.courtId}"]`);
    await expect(strip).toHaveClass(/state-free/);
    await expect(strip).not.toHaveAttribute('data-row-index');
    await expect(strip.locator('.spl-grid-cell')).toHaveCount(0);
    const grid = page.locator(`[data-court-order][data-matchup-id="${target.historyId}"]`);
    await expect(grid).toBeVisible();
    // Premise: the hidden row-1 occupant still belongs to the grid and its own menu.
    await grid.click();
    if (!pending) await expect(page.locator('.tippy-content [data-cell-panel="completed"]')).toBeVisible();
    await page.mouse.click(5, 5);
    await strip.click();
    const popover = page.locator('.tippy-box[data-state="visible"] .tippy-content');
    await expect(popover.getByRole('button', { name: /Assign matchUp$/ })).toBeVisible();
    await expect(popover.getByRole('button', { name: /Block time$/ })).toBeVisible();
    await expect(popover.locator('[data-cell-panel="completed"]')).toHaveCount(0);
    await expect(popover.getByRole('button', { name: 'Enter score', exact: true })).toHaveCount(0);
    await expect(popover.getByRole('button', { name: /Start match$/ })).toHaveCount(0);
  });
}

for (const activeRow of [1, 2]) {
  test(`an occupied strip still opens its live match from grid row ${activeRow}`, async ({ page }) => {
    const target = await seed(page, false, activeRow);
    await page.goto(`/#/tournament/${ID}/scheduling/${DATE}/grid`);
    await initDevBridge(page);
    const strip = page.locator(`.spl-active-strip-cell[data-court-id="${target.courtId}"]`);
    await expect(strip).toHaveClass(/state-in-progress/);
    await expect(strip).toHaveAttribute('data-row-index', String(activeRow - 1));
    await expect(strip.locator(`.spl-grid-cell[data-matchup-id="${target.activeId}"]`)).toBeVisible();
    await strip.click();
    const popover = page.locator('.tippy-box[data-state="visible"] .tippy-content');
    await expect(popover.locator('[data-cell-panel="matchUp"]')).toBeVisible();
    await expect(popover.getByRole('button', { name: /Start match$/ })).toHaveCount(0);
    await expect(popover.locator('[data-cell-panel="completed"]')).toHaveCount(0);
    await expect(popover.getByRole('button', { name: /Assign matchUp$/ })).toHaveCount(0);
  });
}
