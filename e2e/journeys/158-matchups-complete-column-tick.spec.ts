import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';
import { S } from '../helpers/selectors';

/**
 * Journey 158 — the matchUps table marks every finished matchUp with a green tick, and nothing else.
 *
 * CA, 2026-10-12: "we only want to have completed rows show a mark", with a green check for "all statuses
 * where no further play will occur" — retirements, cancellations and abandonment included.
 *
 * Tabulator 6.5.0 moved the tickCross colours out of the SVG and into its own stylesheet, which TMX replaces
 * with `src/styles/tabulator.css`. From 2026-06-19 every tick rendered black beside an equally black cross, so
 * no finished row stood out. TMX vitest runs in node with no stylesheet, so only a browser can see a fill.
 *
 * The statuses come from the factory's `completedMatchUpStatuses`, and the seed must produce a row for each
 * (asserted), so a status the factory adds later fails here until it is seeded.
 *
 * DEAD_RUBBER is scoped (factory, CA 2026-10-13): it marks a rubber of a decided team tie, or a DOUBLE_ELIMINATION
 * Decider that is not needed, and is refused anywhere else. Seeding it as a singles outcome made the whole mock
 * generation fail, so it is set on a rubber of a small TEAM tie instead.
 */

const MATCHUPS = S.TOURNAMENT_MATCHUPS;
const BLACK = 'rgb(0, 0, 0)';

const OUTCOMES = [
  { roundNumber: 1, roundPosition: 1, scoreString: '6-1 6-1', winningSide: 1 },
  { roundNumber: 1, roundPosition: 2, scoreString: '6-1 2-1', matchUpStatus: 'RETIRED', winningSide: 1 },
  { roundNumber: 1, roundPosition: 3, matchUpStatus: 'WALKOVER', winningSide: 1 },
  { roundNumber: 1, roundPosition: 4, matchUpStatus: 'DEFAULTED', winningSide: 2 },
  { roundNumber: 1, roundPosition: 5, matchUpStatus: 'DOUBLE_WALKOVER' },
  { roundNumber: 1, roundPosition: 7, matchUpStatus: 'DOUBLE_DEFAULT' },
  { roundNumber: 1, roundPosition: 9, matchUpStatus: 'CANCELLED' },
  { roundNumber: 1, roundPosition: 10, matchUpStatus: 'ABANDONED' },
];

type CellReading = { status: string; ticks: number; svgs: number; fill?: string };

test.describe('Journey 158 — the complete column', () => {
  test.beforeEach(async ({ page }) => {
    // Tall enough that the table's virtual renderer draws every row at once (31 singles + the TEAM tie's).
    await page.setViewportSize({ width: 1440, height: 3600 });
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('every finished status shows a green tick; an unfinished matchUp shows no mark', async ({ page }) => {
    const { tournamentId, completedStatuses, rowCount } = await page.evaluate(async (outcomes) => {
      const engine = dev.factory.tournamentEngine;
      dev.factory.mocksEngine.generateTournamentRecord({
        drawProfiles: [
          { drawSize: 32, outcomes },
          { drawSize: 2, eventType: 'TEAM', tieFormatName: 'COLLEGE_D3' },
        ],
        policyDefinitions: { scoring: { requireParticipantsForScoring: false } },
        tournamentAttributes: { tournamentId: 'e2e-complete-tick' },
        nonRandom: 1,
        setState: true,
      });
      const rubber = engine
        .allTournamentMatchUps({ matchUpFilters: { matchUpTypes: ['SINGLES'] } })
        .matchUps.find((m: any) => m.collectionId);
      const deadRubber = engine.setMatchUpStatus({
        outcome: { matchUpStatus: 'DEAD_RUBBER' },
        matchUpId: rubber.matchUpId,
        drawId: rubber.drawId,
      });
      if (!deadRubber.success) throw new Error(`DEAD_RUBBER refused: ${JSON.stringify(deadRubber.error)}`);
      const { tournamentRecord } = engine.getTournament();
      await dev.load(tournamentRecord);
      const { matchUps } = dev.factory.tournamentEngine.allTournamentMatchUps();
      return {
        tournamentId: tournamentRecord.tournamentId as string,
        completedStatuses: dev.factory.factoryConstants.completedMatchUpStatuses as string[],
        rowCount: matchUps.filter((m: any) => m.matchUpStatus !== 'BYE').length,
      };
    }, OUTCOMES);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToMatchUps();

    const rows = page.locator(`${MATCHUPS} .tabulator-row`);
    await expect(rows).toHaveCount(rowCount, { timeout: 10_000 });

    // The green the theme defines, resolved in the page, so the assertion follows the theme rather than a hex.
    const green = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.color = 'var(--tmx-accent-green)';
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    expect(green).not.toBe(BLACK);

    const readings: CellReading[] = await rows.evaluateAll((elements) =>
      elements.map((row) => {
        const status = row.querySelector('[tabulator-field="matchUp.matchUpStatus"]')?.textContent?.trim() ?? '';
        const cell = row.querySelector('[tabulator-field="complete"]');
        const tick = cell?.querySelector('.tabulator-tick');
        return {
          status,
          ticks: cell?.querySelectorAll('.tabulator-tick').length ?? 0,
          svgs: cell?.querySelectorAll('svg').length ?? 0,
          fill: tick ? getComputedStyle(tick).fill : undefined,
        };
      }),
    );

    // Every finished status the factory knows was seeded, so none is checked by its absence.
    const seen = new Set(readings.map(({ status }) => status));
    for (const status of completedStatuses) expect(seen, `no ${status} row was seeded`).toContain(status);

    for (const reading of readings) {
      if (completedStatuses.includes(reading.status)) {
        expect(reading.ticks, `${reading.status} has a tick`).toBe(1);
        expect(reading.fill, `${reading.status} tick is green`).toBe(green);
      } else {
        // No cross, no tick: an unfinished matchUp leaves the cell empty.
        expect(reading.svgs, `${reading.status} shows no mark`).toBe(0);
      }
    }

    // The control exists: the draw still has matchUps to play.
    expect(readings.some(({ status }) => status === 'TO_BE_PLAYED')).toBe(true);
  });
});
