import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 49 — Schedule2 grid swap + Now-strip occupancy guard
 *
 * Exercises the real drag-and-drop handlers in gridView.ts (via synthetic
 * DnD events dispatched against the rendered cells — the same dragstart/drop
 * listeners production uses):
 *
 *   1. Dropping a grid matchUp onto an occupied grid cell SWAPS the two —
 *      they trade court, courtOrder AND scheduledTime. Neither falls off the
 *      grid (the original schedule2 bug left the displaced matchUp unscheduled).
 *
 *   2. A grid matchUp may only land on an EMPTY Now-strip cell. Dropping onto
 *      a court whose Now slot is occupied is rejected (no mutation); dropping
 *      onto a free Now cell is accepted (matchUp relocates + is "called").
 *
 * The pure mutation builders are unit-tested in gridDropMethods.test.ts; this
 * journey covers the live DOM → handler → engine path.
 */

const DATE = new Date().toISOString().slice(0, 10);
const STRIP_SELECTOR = '.spl-active-strip';
const STRIP_CELL = '.spl-active-strip-cell';

/** Dispatch a native HTML5 drag/drop using one shared DataTransfer so the
 *  source cell's dragstart payload is readable by the drop target. */
async function dispatchDnD(page: Page, sourceSelector: string, targetSelector: string): Promise<void> {
  await page.evaluate(
    ({ s, t }) => {
      const source = document.querySelector(s);
      const target = document.querySelector(t);
      if (!source || !target) {
        throw new Error(`DnD selectors not found (source=${!!source}, target=${!!target}): ${s} -> ${t}`);
      }
      const dt = new DataTransfer();
      const fire = (el: Element, type: string) =>
        el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
      fire(source, 'dragstart');
      fire(target, 'dragover');
      fire(target, 'drop');
      fire(source, 'dragend');
    },
    { s: sourceSelector, t: targetSelector },
  );
}

async function readSchedule(page: Page, matchUpId: string): Promise<any> {
  return page.evaluate((id) => {
    const { matchUp } = dev.factory.tournamentEngine.findMatchUp({ matchUpId: id });
    return matchUp?.schedule ?? null;
  }, matchUpId);
}

/** Seed a tournament and schedule N first-round matchUps onto explicit court
 *  slots in a single persist (avoids racing the fire-and-forget save). */
async function seedScheduled(
  page: Page,
  assignments: { court: number; courtOrder: number; scheduledTime?: string }[],
): Promise<{ tournamentId: string; courtIds: string[]; matchUpIds: string[] }> {
  return page.evaluate(
    async ({ date, assigns }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        setState: true,
        tournamentName: 'E2E Grid Swap',
        tournamentAttributes: { tournamentId: 'e2e-grid-swap', startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'Swap Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 4, venueName: 'Swap Venue' }],
      });

      const courts = dev.factory.tournamentEngine.getVenuesAndCourts().venues[0].courts;
      const playable = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).filter(
        (m: any) =>
          m.matchUpStatus !== 'BYE' &&
          (m.sides || []).filter((s: any) => s.participantId || s.participant?.participantId).length === 2,
      );
      if (playable.length < assigns.length)
        throw new Error(`Need ${assigns.length} playable matchUps, got ${playable.length}`);

      const matchUpIds: string[] = [];
      assigns.forEach((a, i) => {
        const mu = playable[i];
        const court = courts[a.court];
        dev.factory.tournamentEngine.addMatchUpScheduleItems({
          matchUpId: mu.matchUpId,
          drawId: mu.drawId,
          schedule: {
            scheduledDate: date,
            courtId: court.courtId,
            venueId: court.venueId,
            courtOrder: a.courtOrder,
            ...(a.scheduledTime ? { scheduledTime: a.scheduledTime } : {}),
          },
        });
        matchUpIds.push(mu.matchUpId);
      });

      const rec = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      await dev.tmx2db.addTournament(rec);
      return {
        tournamentId: tournamentRecord.tournamentId as string,
        courtIds: courts.map((c: any) => c.courtId as string),
        matchUpIds,
      };
    },
    { date: DATE, assigns: assignments },
  );
}

test.describe('Journey 49 — Schedule2 grid swap + Now-strip guard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('dropping a grid matchUp onto an occupied cell swaps court/order; time travels with each', async ({ page }) => {
    // A → court0, order 1, 08:00   |   B → court0, order 2, 09:00
    const seed = await seedScheduled(page, [
      { court: 0, courtOrder: 1, scheduledTime: '08:00' },
      { court: 0, courtOrder: 2, scheduledTime: '09:00' },
    ]);
    const [a, b] = seed.matchUpIds;
    const court = seed.courtIds[0];

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToSchedule2();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    // Both cells must be present before the drag.
    await page.waitForSelector(`[data-court-id="${court}"][data-court-order="1"][data-matchup-id="${a}"]`);
    await page.waitForSelector(`[data-court-id="${court}"][data-court-order="2"][data-matchup-id="${b}"]`);

    // Drag B (order 2) onto A (order 1).
    await dispatchDnD(
      page,
      `[data-court-id="${court}"][data-court-order="2"]`,
      `[data-court-id="${court}"][data-court-order="1"]`,
    );

    // Court orders swap, but each matchUp keeps its own time: B → order 1 / 09:00,
    // A → order 2 / 08:00 (time travels with the matchUp).
    await expect
      .poll(async () => readSchedule(page, b), { timeout: 8_000 })
      .toMatchObject({ courtId: court, courtOrder: 1, scheduledTime: '09:00' });
    await expect
      .poll(async () => readSchedule(page, a), { timeout: 8_000 })
      .toMatchObject({ courtId: court, courtOrder: 2, scheduledTime: '08:00' });

    // Neither matchUp fell off the grid — the original bug unscheduled the
    // displaced one (no courtId).
    expect((await readSchedule(page, a)).courtId).toBe(court);
    expect((await readSchedule(page, b)).courtId).toBe(court);
  });

  test('moving a grid matchUp to an empty cell preserves its scheduledTime', async ({ page }) => {
    // B → court0, order 2, 09:00 — drag it to an empty cell on court1.
    const seed = await seedScheduled(page, [{ court: 0, courtOrder: 2, scheduledTime: '09:00' }]);
    const [b] = seed.matchUpIds;
    const [court0, court1] = seed.courtIds;

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToSchedule2();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });
    await page.waitForSelector(`[data-court-id="${court0}"][data-court-order="2"][data-matchup-id="${b}"]`);

    // Drop onto an empty court1 / order 1 cell (no occupant).
    await dispatchDnD(
      page,
      `[data-court-id="${court0}"][data-court-order="2"]`,
      `[data-court-id="${court1}"][data-court-order="1"]:not([data-matchup-id])`,
    );

    // B relocates to court1 but keeps 09:00 (previously the move cleared it).
    await expect
      .poll(async () => readSchedule(page, b), { timeout: 8_000 })
      .toMatchObject({ courtId: court1, courtOrder: 1, scheduledTime: '09:00' });
  });

  test('a grid matchUp is rejected from an occupied Now cell but accepted on a free one', async ({ page }) => {
    // X → court1 order1 (occupies court1's Now slot as NEXT).
    // Y → court0 order1 (the grid matchUp we drag).
    const seed = await seedScheduled(page, [
      { court: 1, courtOrder: 1 }, // X
      { court: 0, courtOrder: 1 }, // Y
    ]);
    const [x, y] = seed.matchUpIds;
    const [court0, court1, court2] = seed.courtIds;

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToSchedule2();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    // court1's Now cell is occupied (NEXT), court2's is free.
    await expect(page.locator(`${STRIP_CELL}[data-court-id="${court1}"]`)).toHaveClass(/state-next/);
    await expect(page.locator(`${STRIP_CELL}[data-court-id="${court2}"]`)).toHaveClass(/state-free/);

    const gridY = `[data-court-id="${court0}"][data-court-order="1"][data-matchup-id="${y}"]`;
    await page.waitForSelector(gridY);

    // Reject: drop Y onto court1's occupied Now cell — Y stays on court0.
    await dispatchDnD(page, gridY, `${STRIP_CELL}[data-court-id="${court1}"]`);
    await expect(page.getByText("That court's Now slot is occupied")).toBeVisible({ timeout: 5_000 });
    expect((await readSchedule(page, y)).courtId).toBe(court0);
    // The occupant X was not disturbed.
    expect((await readSchedule(page, x)).courtId).toBe(court1);

    // Accept: drop Y onto court2's free Now cell — Y relocates and is "called".
    await dispatchDnD(page, gridY, `${STRIP_CELL}[data-court-id="${court2}"]`);
    await expect.poll(async () => (await readSchedule(page, y))?.courtId, { timeout: 8_000 }).toBe(court2);
    expect((await readSchedule(page, y)).calledAt).toBeTruthy();
  });

  test('dragover marks an occupied Now cell as blocked but leaves a free cell droppable', async ({ page }) => {
    // X → court1 (occupies its Now slot)   |   Y → court0 (the grid matchUp)
    const seed = await seedScheduled(page, [
      { court: 1, courtOrder: 1 },
      { court: 0, courtOrder: 1 },
    ]);
    const [, y] = seed.matchUpIds;
    const [court0, court1, court2] = seed.courtIds;

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToSchedule2();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });
    await expect(page.locator(`${STRIP_CELL}[data-court-id="${court1}"]`)).toHaveClass(/state-next/);

    const gridY = `[data-court-id="${court0}"][data-court-order="1"][data-matchup-id="${y}"]`;
    await page.waitForSelector(gridY);

    // Start a grid drag, hover the occupied + the free Now cell, report the
    // blocked class + dropEffect the affordance produced for each.
    const result = await page.evaluate(
      ({ src, occupiedSel, freeSel }) => {
        const source = document.querySelector(src);
        const occupied = document.querySelector(occupiedSel) as HTMLElement;
        const free = document.querySelector(freeSel) as HTMLElement;
        const dt = new DataTransfer();
        source!.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));

        const overOccupied = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt });
        occupied.dispatchEvent(overOccupied);
        const blockedOnOccupied = occupied.classList.contains('tmx-strip-drop-blocked');
        const effectOnOccupied = overOccupied.dataTransfer!.dropEffect;

        const overFree = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt });
        free.dispatchEvent(overFree);
        const blockedOnFree = free.classList.contains('tmx-strip-drop-blocked');

        return { blockedOnOccupied, effectOnOccupied, blockedOnFree };
      },
      {
        src: gridY,
        occupiedSel: `${STRIP_CELL}[data-court-id="${court1}"]`,
        freeSel: `${STRIP_CELL}[data-court-id="${court2}"]`,
      },
    );

    expect(result.blockedOnOccupied).toBe(true);
    expect(result.effectOnOccupied).toBe('none');
    expect(result.blockedOnFree).toBe(false);
  });
});
