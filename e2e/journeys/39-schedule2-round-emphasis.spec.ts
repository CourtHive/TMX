import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 39 — Schedule2 catalog round-emphasis.
 *
 * The Unscheduled catalog assigns each card a `round-current / next /
 * later` class based on its distance from the lowest-unscheduled round
 * in its event:
 *
 *   spl-card-title--round-current   roundOffset === 0
 *   spl-card-title--round-next      roundOffset === 1
 *   spl-card-title--round-later     roundOffset >= 2
 *
 * The math is `computeBaseRoundByEvent` (extracted into
 * `courthive-components/src/components/schedule-page/domain/matchUpCatalogProjections.ts`
 * and unit-tested there). This journey wires the UI to the data: an
 * un-scheduled 8-draw SE event has R1 / R2 / R3 cards in the catalog, and
 * the offset classes should map R1 -> current, R2 -> next, R3 -> later.
 *
 * The Scheduled-panel variant (gridView.ts:761 — same helper) is
 * exercised through TMX's own scheduled-panel catalog in Journey 38; this
 * spec targets the unscheduled side of the catalog rendered by the
 * courthive-components catalog widget itself.
 */

const SCHEDULE_DATE = new Date().toISOString().slice(0, 10);
const TITLE_SELECTOR = '.spl-matchup-card .sp-card-title, .spl-matchup-card [class^="spl-card-title"]';
const CURRENT_TITLE = '.spl-card-title--round-current';
const NEXT_TITLE = '.spl-card-title--round-next';
const LATER_TITLE = '.spl-card-title--round-later';

interface Seed {
  tournamentId: string;
  drawId: string;
  r1MatchUpIds: string[];
}

/**
 * Seed an 8-draw SE event with NO scheduling and NO results — every
 * matchUp (R1/R2/R3 = 4+2+1 = 7 total) sits in the unscheduled catalog.
 *
 * One page.evaluate, one IDB write — same anti-race pattern Journey 29's
 * `seedAndScheduleFirstMatchUp` documents.
 */
async function seedUnscheduledEvent(page: import('@playwright/test').Page): Promise<Seed> {
  return page.evaluate(async (date) => {
    try {
      await dev.tmx2db.initDB();

      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Round Emphasis',
        tournamentAttributes: { tournamentId: 'e2e-round-emphasis', startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [
          {
            eventName: 'Singles',
            drawSize: 8,
            seedsCount: 2,
            drawType: 'SINGLE_ELIMINATION',
          },
        ],
      });

      const allMatchUps = dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps ?? [];
      const drawId = allMatchUps[0]?.drawId ?? '';
      const r1MatchUpIds = allMatchUps
        .filter((m: any) => m.roundNumber === 1 && m.matchUpStatus !== 'BYE')
        .map((m: any) => m.matchUpId);

      const mutated = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      await dev.tmx2db.addTournament(mutated);

      return { tournamentId: tournamentRecord.tournamentId as string, drawId, r1MatchUpIds };
    } catch (err: any) {
      throw new Error(
        `${err?.name || 'Error'}: ${err?.message || String(err)} | stack: ${err?.stack?.split('\n').slice(0, 3).join(' || ')}`,
      );
    }
  }, SCHEDULE_DATE);
}

/**
 * Returns the roundNumber painted into each card's title — derived from
 * the card's text "Singles — Round 1" / "Round 2" / "Round 3" rendered by
 * buildMatchUpCard.
 */
async function bucketCardsByRound(
  page: import('@playwright/test').Page,
): Promise<{ current: number; next: number; later: number }> {
  const [current, next, later] = await Promise.all([
    page.locator(CURRENT_TITLE).count(),
    page.locator(NEXT_TITLE).count(),
    page.locator(LATER_TITLE).count(),
  ]);
  return { current, next, later };
}

test.describe('Journey 39 — Schedule2 catalog round-emphasis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('R1 cards are round-current; R2 cards are round-next; R3 cards are round-later', async ({ page }) => {
    const { tournamentId } = await seedUnscheduledEvent(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();

    // Wait for the catalog to render at least one card.
    await page.locator(TITLE_SELECTOR).first().waitFor({ timeout: 10_000 });

    const buckets = await bucketCardsByRound(page);

    // Single event, no scheduling: base round = 1 (R1 is the lowest
    // unscheduled / non-completed round).
    //   R1 = 4 matchUps → offset 0 → round-current
    //   R2 = 2 matchUps → offset 1 → round-next
    //   R3 = 1 matchUp  → offset 2 → round-later
    expect(buckets.current).toBe(4);
    expect(buckets.next).toBe(2);
    expect(buckets.later).toBe(1);
  });

  test('scheduling all R1 matchUps advances the emphasis: R2 becomes current', async ({ page }) => {
    const { tournamentId, r1MatchUpIds } = await seedUnscheduledEvent(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();
    await page.locator(TITLE_SELECTOR).first().waitFor({ timeout: 10_000 });

    // Stamp `scheduledTime` (no courtId) on every R1 matchUp. The catalog
    // widget filters `isScheduled: true` items out by default (behavior:
    // 'hide' when showScheduled is false), so R1 disappears from the
    // catalog — leaving R2 / R3 visible, with the base round advancing
    // from 1 to 2.
    await page.evaluate(
      async ({ ids, date }) => {
        for (let i = 0; i < ids.length; i++) {
          const matchUps = dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps ?? [];
          const m = matchUps.find((x: any) => x.matchUpId === ids[i]);
          if (!m) continue;
          dev.factory.tournamentEngine.addMatchUpScheduleItems({
            matchUpId: m.matchUpId,
            drawId: m.drawId,
            schedule: { scheduledDate: date, scheduledTime: `${10 + i}:00` },
          });
        }
        const mutated = dev.factory.tournamentEngine.getTournament().tournamentRecord;
        await dev.tmx2db.addTournament(mutated);
      },
      { ids: r1MatchUpIds, date: SCHEDULE_DATE },
    );

    // Re-navigate to force the catalog to rebuild from the mutated record.
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();
    await page.locator(TITLE_SELECTOR).first().waitFor({ timeout: 10_000 });

    // All R1 are now placed (out of the unscheduled catalog). The lowest
    // unscheduled round in the event is now R2 → R2 cards become current.
    const buckets = await bucketCardsByRound(page);
    expect(buckets.current).toBe(2); // R2
    expect(buckets.next).toBe(1); // R3
    expect(buckets.later).toBe(0); // nothing further
  });
});
