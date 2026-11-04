import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';
import { daysFromTodayLocal } from '../helpers/dates';
import { S } from '../helpers/selectors';

/**
 * Journey 189 — events whose dates lie outside the tournament's are flagged, and each can be fixed.
 *
 * Event active-dates ruling 3 (CA 2026-11-01, confirmed 2026-11-03): a disjoint event range is ignored by scheduling
 * and flagged; TMX calls the factory's getEventInconsistencies and offers "Set event dates to tournament dates".
 * A range that only crosses the tournament's edge is flagged too and offered a trim.
 *
 * The engine refuses such ranges, so the seed writes them into the record before loading it, as an old record
 * carries them. Dates are relative to today: TMX asks before changing a tournament outside its date range.
 */

const TOURNAMENT_START = daysFromTodayLocal(0);
const TOURNAMENT_END = daysFromTodayLocal(4);
const EDGE_START = daysFromTodayLocal(2);
const EDGE_END = daysFromTodayLocal(6);
const STALE_START = daysFromTodayLocal(10);
const STALE_ACTIVE = daysFromTodayLocal(11);
const STALE_END = daysFromTodayLocal(12);
const DISJOINT_EVENT = 'Stale Range Singles';
const EDGE_EVENT = 'Edge Range Doubles';

test.describe('Journey 189 — event dates outside the tournament', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('flags both events and fixes each one', async ({ page }) => {
    const tournamentId = await page.evaluate(
      async ({ start, end, edgeStart, edgeEnd, staleStart, staleActive, staleEnd, disjointEvent, edgeEvent }) => {
        const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
          nonRandom: 1,
          setState: true,
          tournamentAttributes: { tournamentId: 'e2e-event-dates-outside', startDate: start, endDate: end },
          eventProfiles: [{ eventName: disjointEvent }, { eventName: edgeEvent, eventType: 'DOUBLES' }],
        });
        const [disjoint, edge] = tournamentRecord.events;
        Object.assign(disjoint, { startDate: staleStart, endDate: staleEnd, activeDates: [staleActive] });
        Object.assign(edge, { startDate: edgeStart, endDate: edgeEnd });
        await dev.load(tournamentRecord);
        return tournamentRecord.tournamentId as string;
      },
      {
        start: TOURNAMENT_START,
        end: TOURNAMENT_END,
        edgeStart: EDGE_START,
        edgeEnd: EDGE_END,
        staleStart: STALE_START,
        staleActive: STALE_ACTIVE,
        staleEnd: STALE_END,
        disjointEvent: DISJOINT_EVENT,
        edgeEvent: EDGE_EVENT,
      },
    );

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToEvents();

    const flag = page.locator(S.EVENTS_CONTROL).getByRole('button', { name: '2 events outside tournament dates' });
    await expect(flag).toBeVisible();
    await flag.click();

    const dialog = page.locator('.chc-modal-dialog');
    await expect(dialog).toContainText(DISJOINT_EVENT);
    await expect(dialog).toContainText(EDGE_EVENT);
    await expect(dialog).toContainText('lie entirely outside the tournament');
    await expect(dialog).toContainText('extend outside the tournament');

    await dialog
      .getByRole('button', { name: `Set event dates to tournament dates (${TOURNAMENT_START} – ${TOURNAMENT_END})` })
      .click();
    await expect(dialog).not.toContainText(DISJOINT_EVENT);
    await dialog.getByRole('button', { name: `Trim event dates to ${EDGE_START} – ${TOURNAMENT_END}` }).click();
    await expect(dialog).toBeHidden();

    await expect(page.locator(S.EVENTS_CONTROL).getByRole('button', { name: /outside tournament dates/ })).toHaveCount(
      0,
    );

    const stored = await page.evaluate(() =>
      dev.factory.tournamentEngine.getEvents().events.map(({ eventName, startDate, endDate, activeDates }: any) => ({
        eventName,
        startDate,
        endDate,
        activeDates,
      })),
    );
    expect(stored).toEqual([
      { eventName: DISJOINT_EVENT, startDate: TOURNAMENT_START, endDate: TOURNAMENT_END, activeDates: [] },
      { eventName: EDGE_EVENT, startDate: EDGE_START, endDate: TOURNAMENT_END, activeDates: [] },
    ]);
  });
});
