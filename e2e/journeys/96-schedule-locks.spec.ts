import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { todayLocal } from '../helpers/dates';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 96 — Schedule locks: the operator surface
 *
 * A director pins a marquee matchUp so bulk operations cannot move it. The
 * factory enforces the lock and is unit-tested there; TMX's helpers are
 * unit-tested in `scheduleLocks.test.ts`. What neither can reach is the live
 * DOM → handler → engine path, which is where this feature actually lives:
 *
 *   1. Locking from the grid cell popover marks the cell.
 *   2. **Clear-menu coherence** — the count EXCLUDES a locked matchUp, the
 *      confirm says how many it will preserve, and the locked placement is
 *      still there afterwards. This is the promise-vs-reality property: the
 *      original hazard was a menu offering "will clear 12" and then clearing 9.
 *   3. Dragging a locked matchUp asks first. Cancelling leaves it put;
 *      confirming moves it AND the lock survives the move (CA's decision 1 —
 *      warn, then allow).
 *   4. "Lock this day" pins every placement on the date in one action.
 *
 * Drag/drop is dispatched as synthetic DragEvents sharing one DataTransfer, so
 * the production dragstart/drop listeners in gridView run for real — the same
 * technique as journey 49.
 */

const DATE = todayLocal();
const STRIP_SELECTOR = '.spl-active-strip';
const LOCKED_CELL = '.tmx-schedule-locked-cell';

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

/** Place N first-round matchUps on explicit court slots, optionally locking some. */
async function seedScheduled(
  page: Page,
  assignments: { court: number; courtOrder: number; scheduledTime?: string; locked?: boolean }[],
): Promise<{ tournamentId: string; courtIds: string[]; matchUpIds: string[] }> {
  return page.evaluate(
    async ({ date, assigns }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Schedule Locks',
        tournamentAttributes: { tournamentId: 'e2e-schedule-locks', startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'Locks Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 4, venueName: 'Locks Venue' }],
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
        if (a.locked) {
          dev.factory.tournamentEngine.setMatchUpScheduleLock({
            matchUpId: mu.matchUpId,
            drawId: mu.drawId,
            lock: { reason: 'featured', lockedAt: new Date().toISOString() },
          });
        }
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

async function openGrid(page: Page, tournamentId: string): Promise<void> {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToScheduling();
  await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });
}

const isLocked = (page: Page, matchUpId: string) =>
  page.evaluate((id) => {
    const { matchUp } = dev.factory.tournamentEngine.findMatchUp({ matchUpId: id });
    return !!matchUp?.schedule?.lock;
  }, matchUpId);

test.describe('Journey 96 — schedule locks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('a locked placement is marked in the grid, an unlocked one is not', async ({ page }) => {
    const seed = await seedScheduled(page, [
      { court: 0, courtOrder: 1, scheduledTime: '19:00', locked: true },
      { court: 1, courtOrder: 1, scheduledTime: '10:00' },
    ]);
    const [pinned, free] = seed.matchUpIds;
    await openGrid(page, seed.tournamentId);

    const pinnedCell = `[data-court-id="${seed.courtIds[0]}"][data-court-order="1"]`;
    const freeCell = `[data-court-id="${seed.courtIds[1]}"][data-court-order="1"]`;
    await page.waitForSelector(`${pinnedCell}[data-matchup-id="${pinned}"]`);

    // The affordance is on the cell CONTENT, so query within the cell.
    await expect(page.locator(`${pinnedCell} ${LOCKED_CELL}`)).toHaveCount(1);
    await expect(page.locator(`${freeCell} ${LOCKED_CELL}`)).toHaveCount(0);
    expect(await isLocked(page, free)).toBe(false);
  });

  test('dragging a locked matchUp asks first — cancelling leaves the placement untouched', async ({ page }) => {
    const seed = await seedScheduled(page, [{ court: 0, courtOrder: 1, scheduledTime: '19:00', locked: true }]);
    const [pinned] = seed.matchUpIds;
    const [court0, court1] = seed.courtIds;
    await openGrid(page, seed.tournamentId);
    await page.waitForSelector(`[data-court-id="${court0}"][data-court-order="1"][data-matchup-id="${pinned}"]`);

    const before = await readSchedule(page, pinned);
    await dispatchDnD(
      page,
      `[data-court-id="${court0}"][data-court-order="1"]`,
      `[data-court-id="${court1}"][data-court-order="1"]`,
    );

    // A confirmation appears rather than the move applying silently.
    const cancel = page.getByRole('button', { name: /cancel/i }).first();
    await expect(cancel).toBeVisible({ timeout: 8_000 });
    await cancel.click();

    // Placement unchanged, and the lock is intact.
    await expect.poll(async () => (await readSchedule(page, pinned)).courtId, { timeout: 6_000 }).toBe(before.courtId);
    expect((await readSchedule(page, pinned)).courtOrder).toBe(before.courtOrder);
    expect(await isLocked(page, pinned)).toBe(true);
  });

  test('confirming the move relocates the matchUp AND keeps it locked', async ({ page }) => {
    const seed = await seedScheduled(page, [{ court: 0, courtOrder: 1, scheduledTime: '19:00', locked: true }]);
    const [pinned] = seed.matchUpIds;
    const [court0, court1] = seed.courtIds;
    await openGrid(page, seed.tournamentId);
    await page.waitForSelector(`[data-court-id="${court0}"][data-court-order="1"][data-matchup-id="${pinned}"]`);

    await dispatchDnD(
      page,
      `[data-court-id="${court0}"][data-court-order="1"]`,
      `[data-court-id="${court1}"][data-court-order="1"]`,
    );

    const confirm = page.getByRole('button', { name: /^(ok|confirm|yes)$/i }).first();
    await expect(confirm).toBeVisible({ timeout: 8_000 });
    await confirm.click();

    // Moved — the override was passed, so the factory allowed the write…
    await expect.poll(async () => (await readSchedule(page, pinned)).courtId, { timeout: 8_000 }).toBe(court1);
    // …and the lock travelled with it rather than being consumed by the move.
    expect(await isLocked(page, pinned)).toBe(true);
  });

  test('Clear counts EXCLUDE a locked matchUp, and clearing preserves it', async ({ page }) => {
    // The promise-vs-reality property: the menu must not offer to clear a
    // matchUp the engine will skip.
    const seed = await seedScheduled(page, [
      { court: 0, courtOrder: 1, scheduledTime: '19:00', locked: true },
      { court: 1, courtOrder: 1, scheduledTime: '10:00' },
      { court: 2, courtOrder: 1, scheduledTime: '11:00' },
    ]);
    const [pinned, freeA, freeB] = seed.matchUpIds;
    await openGrid(page, seed.tournamentId);
    await page.waitForSelector(`[data-court-id="${seed.courtIds[0]}"][data-court-order="1"]`);

    await page.getByRole('button', { name: /clear/i }).first().click();

    // Three placements exist; one is pinned, so the day option offers TWO.
    const dayOption = page.getByText(/Clear this day \(keep completed\)/i).first();
    await expect(dayOption).toBeVisible({ timeout: 8_000 });
    await expect(dayOption).toContainText('2');
    await dayOption.click();

    // The confirm states what it will preserve rather than staying silent.
    await expect(page.getByText(/locked matchUp/i).first()).toBeVisible({ timeout: 8_000 });
    await page
      .getByRole('button', { name: /^(ok|confirm|yes|clear)$/i })
      .first()
      .click();

    // The two unlocked placements are gone; the pinned one is untouched.
    await expect.poll(async () => (await readSchedule(page, freeA))?.courtId, { timeout: 8_000 }).toBeFalsy();
    expect((await readSchedule(page, freeB))?.courtId).toBeFalsy();
    expect((await readSchedule(page, pinned)).courtId).toBe(seed.courtIds[0]);
    expect(await isLocked(page, pinned)).toBe(true);
  });

  test('Lock this day pins every placement on the date in one action', async ({ page }) => {
    const seed = await seedScheduled(page, [
      { court: 0, courtOrder: 1, scheduledTime: '09:00' },
      { court: 1, courtOrder: 1, scheduledTime: '10:00' },
    ]);
    const [a, b] = seed.matchUpIds;
    await openGrid(page, seed.tournamentId);
    await page.waitForSelector(`[data-court-id="${seed.courtIds[0]}"][data-court-order="1"]`);

    expect(await isLocked(page, a)).toBe(false);
    expect(await isLocked(page, b)).toBe(false);

    // NOT anchored: the action-bar button renders an icon before its label, so
    // its accessible name is " Lock " — a /^lock/ anchor never matches.
    await page.getByRole('button', { name: /lock/i }).first().click();
    const lockDay = page.getByText(/Lock this day/i).first();
    await expect(lockDay).toBeVisible({ timeout: 8_000 });
    await expect(lockDay).toContainText('2');
    await lockDay.click();

    await page
      .getByRole('button', { name: /^(ok|confirm|yes|lock)$/i })
      .first()
      .click();

    await expect.poll(async () => isLocked(page, a), { timeout: 8_000 }).toBe(true);
    expect(await isLocked(page, b)).toBe(true);
    await expect(page.locator(LOCKED_CELL)).toHaveCount(2);
  });
});
