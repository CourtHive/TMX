import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { todayLocal } from '../helpers/dates';

/**
 * Journey 102 — a BYE that holds a court is SHOWN, not hidden
 *
 * A tournament director may schedule an entire event and then swap participants
 * around, placing byes temporarily or permanently. Assigning a BYE therefore
 * PRESERVES scheduling — the engine never discards operator work to keep a
 * detector quiet.
 *
 * That only holds together if the retained placement is visible. It used not to
 * be: `getStructureMatchUps` buckets BYEs into `byeMatchUps`, which never reached
 * `dateMatchUps` / `courtsData`, so a byed matchUp kept its court and vanished
 * from every schedule surface at once. Production 2026-08-22 (Battle of Boca):
 * Court 12 read as free, the operator dropped another match onto it, and
 * `proConflicts` reported a `courtDoubleBooking` naming a partner that had no
 * cell to click through to.
 *
 * This journey locks the four properties that replaced that behaviour:
 *   1. the BYE keeps its court/time
 *   2. it is drawn as a grid cell (`courtByeMatchUps` in schedule2DataCache)
 *   3. the cell is visually distinct but as interactive as any other
 *   4. it raises `byeScheduledOnCourt` at WARN — and NOT a courtDoubleBooking
 *
 * Engine-side coverage lives in factory `byeSchedulingPreservation.test.ts`;
 * the ambiguity predicate has unit coverage in `isSchedulingAmbiguity.test.ts`.
 * This is the wiring in between, which neither of those can see.
 */

const DATE = todayLocal();
const STRIP_SELECTOR = '.spl-active-strip';
const ISSUES_BUTTON = 'button:has(i.fa-triangle-exclamation)';
const PLACED_TIME = '07:45';

type Seed = {
  tournamentId: string;
  byeMatchUpId: string;
  peerMatchUpId: string;
  courtId: string;
};

/**
 * Place three round-1 matchUps on three courts, then bye the opponent of the
 * first while explicitly preserving its placement.
 *
 * Persists via `tmx2db.addTournament` rather than `dev.load`: the engine holds
 * its OWN record under `setState: true`, so the object returned by
 * `generateTournamentRecord` does not carry the mutations made after it — read
 * `getTournament().tournamentRecord` instead. (Loading the stale object yields a
 * grid with no cells at all, which reads as "the feature is broken".)
 */
async function seedCourtHoldingBye(page: Page): Promise<Seed> {
  return page.evaluate(async (date) => {
    await dev.tmx2db.initDB();
    const engine = dev.factory.tournamentEngine;

    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'E2E BYE Holds Court',
      tournamentAttributes: { tournamentId: 'e2e-bye-holds-court', startDate: date, endDate: date },
      drawProfiles: [{ eventName: 'BYE Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION', drawId: 'e2eByeDraw' }],
      venueProfiles: [{ courtsCount: 4, venueName: 'BYE Venue' }],
    });

    const drawId = 'e2eByeDraw';
    const courts = engine.getVenuesAndCourts().venues[0].courts;
    const playable = (engine.allTournamentMatchUps({ matchUpFilters: { roundNumbers: [1] } }).matchUps || []).filter(
      (m: any) => (m.sides || []).every((s: any) => s.participant),
    );

    playable.slice(0, 3).forEach((matchUp: any, index: number) => {
      engine.addMatchUpScheduleItems({
        schedule: {
          courtId: courts[index].courtId,
          venueId: courts[index].venueId,
          courtOrder: 1,
          scheduledDate: date,
          scheduledTime: '07:45',
        },
        removePriorValues: true,
        matchUpId: matchUp.matchUpId,
        drawId,
      });
    });

    // Bye the first matchUp's opponent, keeping the Court 1 placement.
    const target = playable[0];
    const structureId = target.structureId;
    const byedPosition = target.drawPositions[1];
    engine.removeDrawPositionAssignment({ drawPosition: byedPosition, structureId, drawId });
    engine.assignDrawPositionBye({ drawPosition: byedPosition, preserveScheduling: true, structureId, drawId });

    const record = engine.getTournament().tournamentRecord;
    await dev.tmx2db.addTournament(record);

    return {
      tournamentId: tournamentRecord.tournamentId as string,
      byeMatchUpId: target.matchUpId as string,
      peerMatchUpId: playable[1].matchUpId as string,
      courtId: courts[0].courtId as string,
    };
  }, DATE);
}

async function openGrid(page: Page, tournamentId: string): Promise<void> {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToScheduling();
  await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });
}

test.describe('Journey 102 — a BYE that holds a court is shown, not hidden', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('the byed matchUp keeps its court and is drawn as a grid cell', async ({ page }) => {
    const seed = await seedCourtHoldingBye(page);
    await openGrid(page, seed.tournamentId);

    const byeCell = page.locator(`.spl-grid-cell[data-matchup-id="${seed.byeMatchUpId}"]`);
    await expect(byeCell).toBeVisible({ timeout: 10_000 });
    await expect(byeCell).toContainText('BYE');
    await expect(byeCell).toContainText(PLACED_TIME);

    // It occupies the slot it was given, rather than drifting somewhere generic.
    // Court/order live on the wrapper div that gridView builds around the
    // component's `.spl-grid-cell`; only matchUp/draw ids appear on both.
    await expect(
      page.locator(
        `[data-court-id="${seed.courtId}"][data-court-order="1"] .spl-grid-cell[data-matchup-id="${seed.byeMatchUpId}"]`,
      ),
    ).toBeVisible();

    // CONTROL: the neighbouring real matchUp is drawn too, so a passing
    // assertion above cannot be "the grid renders everything regardless".
    await expect(page.locator(`.spl-grid-cell[data-matchup-id="${seed.peerMatchUpId}"]`)).toBeVisible();
  });

  test('the cell is visually distinct but as interactive as an ordinary one', async ({ page }) => {
    const seed = await seedCourtHoldingBye(page);
    await openGrid(page, seed.tournamentId);

    const byeCell = page.locator(`.spl-grid-cell[data-matchup-id="${seed.byeMatchUpId}"]`);
    const peerCell = page.locator(`.spl-grid-cell[data-matchup-id="${seed.peerMatchUpId}"]`);
    await expect(byeCell).toBeVisible({ timeout: 10_000 });

    // Distinct: the BYE carries the warning modifier, the peer does not.
    await expect(byeCell).toHaveClass(/spl-cell--warning/);
    await expect(peerCell).not.toHaveClass(/spl-cell--warning/);

    // Interactive: same drag affordance and identifying attributes as the peer,
    // so it can be moved or unscheduled exactly like a real matchUp. Asserted
    // against the peer rather than a hard-coded value, so a grid-wide change to
    // how cells are made draggable does not silently pass this test.
    const affordance = (selector: string) =>
      page.evaluate((s) => {
        const el = document.querySelector(s) as HTMLElement | null;
        if (!el) return null;
        return {
          cursor: getComputedStyle(el).cursor,
          hasDrawId: el.dataset.drawId !== undefined,
        };
      }, selector);

    const byeAffordance = await affordance(`.spl-grid-cell[data-matchup-id="${seed.byeMatchUpId}"]`);
    const peerAffordance = await affordance(`.spl-grid-cell[data-matchup-id="${seed.peerMatchUpId}"]`);
    expect(byeAffordance).toEqual(peerAffordance);
    expect(byeAffordance?.hasDrawId).toBe(true);
  });

  test('it raises a byeScheduledOnCourt WARN and no phantom double booking', async ({ page }) => {
    const seed = await seedCourtHoldingBye(page);
    await openGrid(page, seed.tournamentId);

    const issuesBtn = page.locator(ISSUES_BUTTON);
    await expect(issuesBtn).toBeVisible({ timeout: 10_000 });
    await issuesBtn.click();

    await expect(page.getByText('Scheduling Issues (1)')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/byeScheduledOnCourt/)).toBeVisible();
    await expect(page.getByText('WARN').first()).toBeVisible();

    // The whole point: the slot is visibly taken, so nothing is reported as a
    // double booking against a cell the operator cannot see.
    await expect(page.getByText(/courtDoubleBooking/)).toHaveCount(0);
  });

  test('CONTROL: a BYE with no court stays out of the grid and raises nothing', async ({ page }) => {
    // Falsifies the three tests above. If the grid had simply started rendering
    // every BYE, or the annotation fired on BYE status alone, this would fail —
    // the feature is specifically about COURT occupancy.
    const seed = await page.evaluate(async (date) => {
      await dev.tmx2db.initDB();
      const engine = dev.factory.tournamentEngine;
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E BYE No Court',
        tournamentAttributes: { tournamentId: 'e2e-bye-no-court', startDate: date, endDate: date },
        drawProfiles: [{ eventName: 'BYE Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION', drawId: 'e2eNoCourt' }],
        venueProfiles: [{ courtsCount: 4, venueName: 'BYE Venue' }],
      });

      const drawId = 'e2eNoCourt';
      const courts = engine.getVenuesAndCourts().venues[0].courts;
      const playable = (engine.allTournamentMatchUps({ matchUpFilters: { roundNumbers: [1] } }).matchUps || []).filter(
        (m: any) => (m.sides || []).every((s: any) => s.participant),
      );

      // One real matchUp on court so the grid has something to draw.
      engine.addMatchUpScheduleItems({
        schedule: {
          courtId: courts[0].courtId,
          venueId: courts[0].venueId,
          courtOrder: 1,
          scheduledDate: date,
          scheduledTime: '07:45',
        },
        removePriorValues: true,
        matchUpId: playable[1].matchUpId,
        drawId,
      });

      // The BYE gets a date and time but NO court.
      const target = playable[0];
      engine.addMatchUpScheduleItems({
        schedule: { scheduledDate: date, scheduledTime: '09:00' },
        removePriorValues: true,
        matchUpId: target.matchUpId,
        drawId,
      });
      const structureId = target.structureId;
      const byedPosition = target.drawPositions[1];
      engine.removeDrawPositionAssignment({ drawPosition: byedPosition, structureId, drawId });
      engine.assignDrawPositionBye({ drawPosition: byedPosition, preserveScheduling: true, structureId, drawId });

      await dev.tmx2db.addTournament(engine.getTournament().tournamentRecord);
      return { tournamentId: tournamentRecord.tournamentId as string, byeMatchUpId: target.matchUpId as string };
    }, DATE);

    await openGrid(page, seed.tournamentId);

    // The court-holding peer is drawn, proving the grid rendered at all.
    await expect(page.locator('.spl-grid-cell[data-matchup-id]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(`.spl-grid-cell[data-matchup-id="${seed.byeMatchUpId}"]`)).toHaveCount(0);
    await expect(page.locator(ISSUES_BUTTON)).toHaveCount(0);
  });
});
