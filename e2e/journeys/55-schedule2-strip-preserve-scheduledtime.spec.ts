import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 55 — Schedule2 Now-strip drop preserves scheduledTime + stamps calledAt
 *
 * Exercises the real active-strip drop handler in gridView.ts
 * (commitActiveStripDrop) via synthetic HTML5 DnD against the rendered cells.
 *
 * The fix under test: dragging a GRID matchUp onto a free Now-strip cell used to
 * emit a schedule-clear that wiped `scheduledTime`. Calling a match to court is
 * not a re-plan — the planned time must survive the move. The clear step now
 * omits `scheduledTime` (removePriorValues acts per-attribute), so:
 *   - the matchUp relocates to the strip's court,
 *   - `calledAt` is stamped (the deliberate "called to court" signal),
 *   - `scheduledTime` is preserved untouched.
 *
 * The grid→grid time-travel behaviour is covered by journey 49; this journey is
 * specifically about the Now-strip path preserving the planned time.
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

/** Seed a tournament with a single matchUp placed on court0/order1 (with an
 *  optional scheduledTime) in one persist (avoids racing the fire-and-forget
 *  save). Returns the courtIds and the matchUpId. */
async function seedOnePlacement(
  page: Page,
  scheduledTime?: string,
): Promise<{ tournamentId: string; courtIds: string[]; matchUpId: string }> {
  return page.evaluate(
    async ({ date, scheduledTime }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        setState: true,
        tournamentName: 'E2E Strip Preserve',
        tournamentAttributes: { tournamentId: 'e2e-strip-preserve', startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'Preserve Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 4, venueName: 'Preserve Venue' }],
      });

      const courts = dev.factory.tournamentEngine.getVenuesAndCourts().venues[0].courts;
      const mu = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
        (m: any) =>
          m.matchUpStatus !== 'BYE' &&
          (m.sides || []).filter((s: any) => s.participantId || s.participant?.participantId).length === 2,
      );
      if (!mu) throw new Error('No playable matchUp in seeded draw');

      dev.factory.tournamentEngine.addMatchUpScheduleItems({
        matchUpId: mu.matchUpId,
        drawId: mu.drawId,
        schedule: {
          scheduledDate: date,
          courtId: courts[0].courtId,
          venueId: courts[0].venueId,
          courtOrder: 1,
          ...(scheduledTime ? { scheduledTime } : {}),
        },
      });

      const rec = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      await dev.tmx2db.addTournament(rec);
      return {
        tournamentId: tournamentRecord.tournamentId as string,
        courtIds: courts.map((c: any) => c.courtId as string),
        matchUpId: mu.matchUpId as string,
      };
    },
    { date: DATE, scheduledTime },
  );
}

test.describe('Journey 55 — Now-strip drop preserves scheduledTime', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('dragging a timed grid matchUp onto a free Now cell keeps its time and stamps calledAt', async ({ page }) => {
    const seed = await seedOnePlacement(page, '09:00');
    const mu = seed.matchUpId;
    const [court0, court1] = seed.courtIds;

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    // The grid source cell (court0/order1) and a free Now cell (court1).
    const gridCell = `[data-court-id="${court0}"][data-court-order="1"][data-matchup-id="${mu}"]`;
    await page.waitForSelector(gridCell);
    await expect(page.locator(`${STRIP_CELL}[data-court-id="${court1}"]`)).toHaveClass(/state-free/);

    const beforeIso = new Date().toISOString();
    await dispatchDnD(page, gridCell, `${STRIP_CELL}[data-court-id="${court1}"]`);

    // Relocates to court1, keeps 09:00 (the fix), and is "called".
    await expect
      .poll(async () => readSchedule(page, mu), { timeout: 8_000 })
      .toMatchObject({ courtId: court1, scheduledTime: '09:00' });

    const schedule = await readSchedule(page, mu);
    expect(schedule.calledAt).toBeTruthy();
    expect(typeof schedule.calledAt).toBe('string');
    expect(schedule.calledAt >= beforeIso).toBe(true);
  });

  test('dragging a timeless grid matchUp onto a free Now cell stamps calledAt without fabricating a time', async ({
    page,
  }) => {
    const seed = await seedOnePlacement(page); // no scheduledTime
    const mu = seed.matchUpId;
    const [court0, court1] = seed.courtIds;

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    const gridCell = `[data-court-id="${court0}"][data-court-order="1"][data-matchup-id="${mu}"]`;
    await page.waitForSelector(gridCell);
    await expect(page.locator(`${STRIP_CELL}[data-court-id="${court1}"]`)).toHaveClass(/state-free/);

    await dispatchDnD(page, gridCell, `${STRIP_CELL}[data-court-id="${court1}"]`);

    await expect.poll(async () => (await readSchedule(page, mu))?.courtId, { timeout: 8_000 }).toBe(court1);
    const schedule = await readSchedule(page, mu);
    expect(schedule.calledAt).toBeTruthy();
    // No scheduledTime was planned; the strip drop must not invent one.
    expect(schedule.scheduledTime).toBeFalsy();
  });
});
