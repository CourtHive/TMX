import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';
import { todayLocal } from '../helpers/dates';

/**
 * Journey 157 — the schedule grid cell panel for a COMPLETED matchUp shows when it happened.
 *
 * CA, 2026-10-12: "given that the matchUp is completed, none of the annotations need to be shown, setting the
 * time does not need to be shown, and under time, if there is a calledAt time it should be shown and the
 * scoredAt time should be shown, if there is no endTime."
 *
 * "Completed" is every finished status (CA, 2026-10-11), so one matchUp is COMPLETED and one RETIRED. The
 * "scoredAt" is the factory's `schedule.scoredTime`, stamped by the engine when the result is recorded; the
 * seed reads the stamp back and refuses to run without it, so the Scored assertion cannot pass on an absence.
 *
 * The tournament is put in a zone that is NOT the device's (asserted), so a panel that read the instants on
 * the browser clock instead of the venue clock shows the wrong hour and fails here.
 *
 * The third matchUp is the control: not completed, so today's panel, annotations and Set time included.
 */

const SCHEDULE_DATE = todayLocal();
const VENUE_ZONE = 'Asia/Tokyo';
/** 05:02 UTC is 14:02 in Tokyo, with no DST to move it. */
const CALLED_AT = `${SCHEDULE_DATE}T05:02:00.000Z`;
const CALLED_CLOCK = '14:02';

const COMPLETED_PANEL = '[data-cell-panel="completed"]';
const MATCHUP_PANEL = '[data-cell-panel="matchUp"]';

type Seed = {
  tournamentId: string;
  completedId: string;
  retiredId: string;
  unscoredId: string;
  scoredTime: string;
};

async function seedThreeOnCourt(page: import('@playwright/test').Page): Promise<Seed> {
  return page.evaluate(
    async ({ date, zone, calledAt }) => {
      await dev.tmx2db.initDB();
      const engine = dev.factory.tournamentEngine;

      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Completed Cell Panel',
        tournamentAttributes: { tournamentId: 'e2e-completed-cell-panel', startDate: date, endDate: date },
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 3, venueName: 'Panel Venue' }],
      });
      engine.setTournamentLocalTimeZone({ localTimeZone: zone });

      const round1 = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).filter(
        (m: any) => m.roundNumber === 1 && m.matchUpStatus !== 'BYE',
      );
      if (round1.length < 3) throw new Error(`seed produced ${round1.length} playable round-1 matchUps, need 3`);
      const [completed, retired, unscored] = round1;
      const { drawId } = completed;

      const { venues } = engine.getVenuesAndCourts();
      const venue = venues?.[0];
      [completed, retired, unscored].forEach((matchUp: any, index: number) => {
        const result = engine.addMatchUpScheduleItems({
          matchUpId: matchUp.matchUpId,
          drawId,
          schedule: {
            scheduledDate: date,
            scheduledTime: '10:00',
            venueId: venue.venueId,
            courtId: venue.courts[index].courtId,
            courtOrder: 1,
          },
        });
        if (result.error) throw new Error(`schedule: ${JSON.stringify(result.error)}`);
      });

      // COMPLETED: called and started, no end time — so the panel shows the scored time.
      const called = engine.setMatchUpCalledAt({ matchUpId: completed.matchUpId, drawId, calledAt });
      if (called.error) throw new Error(`calledAt: ${JSON.stringify(called.error)}`);
      engine.addMatchUpScheduleItems({ matchUpId: completed.matchUpId, drawId, schedule: { startTime: '10:05' } });
      const completedSets = engine.parseScoreString({ scoreString: '6-2 6-3' });
      const scored = engine.setMatchUpStatus({
        matchUpId: completed.matchUpId,
        drawId,
        outcome: { matchUpStatus: 'COMPLETED', winningSide: 1, score: { sets: completedSets } },
      });
      if (scored.error) throw new Error(`score: ${JSON.stringify(scored.error)}`);

      // RETIRED: started and ended — an end time supersedes the scored time.
      engine.addMatchUpScheduleItems({
        matchUpId: retired.matchUpId,
        drawId,
        schedule: { startTime: '10:10', endTime: '11:20' },
      });
      const retiredSets = engine.parseScoreString({ scoreString: '6-2 3-1' });
      const retiredResult = engine.setMatchUpStatus({
        matchUpId: retired.matchUpId,
        drawId,
        outcome: { matchUpStatus: 'RETIRED', winningSide: 1, score: { sets: retiredSets } },
      });
      if (retiredResult.error) throw new Error(`retire: ${JSON.stringify(retiredResult.error)}`);

      const stored = engine.findMatchUp({ matchUpId: completed.matchUpId, drawId }).matchUp;
      const scoredTime = stored?.schedule?.scoredTime;
      if (!scoredTime)
        throw new Error('the engine stamped no schedule.scoredTime; the Scored assertion would be vacuous');

      await dev.tmx2db.addTournament(engine.getTournament().tournamentRecord);

      return {
        tournamentId: tournamentRecord.tournamentId as string,
        completedId: completed.matchUpId as string,
        retiredId: retired.matchUpId as string,
        unscoredId: unscored.matchUpId as string,
        scoredTime: scoredTime as string,
      };
    },
    { date: SCHEDULE_DATE, zone: VENUE_ZONE, calledAt: CALLED_AT },
  );
}

/** `HH:MM` of an instant in a named zone — computed here, independently of the code under test. */
function clockIn(zone: string, instant: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(instant))
    .replace('.', ':');
}

/** The court-grid copy of a matchUp's cell (the active strip draws its own copy first in document order). */
const gridCell = (matchUpId: string) => `[data-court-order][data-matchup-id="${matchUpId}"] .spl-grid-cell`;

test.describe('Journey 157 — the cell panel for a completed matchUp', () => {
  let seed: Seed;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    seed = await seedThreeOnCourt(page);

    const deviceZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(deviceZone, 'the venue zone must differ from the device zone, or a browser-clock read passes').not.toBe(
      VENUE_ZONE,
    );

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToScheduling();
    await page.locator(gridCell(seed.completedId)).waitFor({ state: 'visible', timeout: 15_000 });
  });

  test('a COMPLETED matchUp: no annotations, no Set time; called, started and scored times shown', async ({ page }) => {
    await page.locator(gridCell(seed.completedId)).click();
    const panel = page.locator(COMPLETED_PANEL);
    await expect(panel).toBeVisible();

    await expect(panel.getByText('Annotations', { exact: true })).toHaveCount(0);
    await expect(panel.getByText('Followed by', { exact: true })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Set time' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Call to court' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Start match' })).toHaveCount(0);
    // Corrections stay possible from here (CA, 2026-10-11).
    await expect(panel.getByRole('button', { name: 'Start time' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'End time' })).toBeVisible();

    await expect(panel.locator('[data-time-fact="calledAt"]')).toHaveText(CALLED_CLOCK);
    await expect(panel.locator('[data-time-fact="startTime"]')).toHaveText('10:05');
    await expect(panel.locator('[data-time-fact="endTime"]')).toHaveCount(0);
    await expect(panel.locator('[data-time-fact="scoredTime"]')).toHaveText(clockIn(VENUE_ZONE, seed.scoredTime));
    await expect(panel.getByText('Scored', { exact: true })).toBeVisible();
  });

  test('a RETIRED matchUp is completed too, and its end time supersedes the scored time', async ({ page }) => {
    await page.locator(gridCell(seed.retiredId)).click();
    const panel = page.locator(COMPLETED_PANEL);
    await expect(panel).toBeVisible();

    await expect(panel.getByText('Annotations', { exact: true })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Set time' })).toHaveCount(0);
    await expect(panel.locator('[data-time-fact="calledAt"]')).toHaveCount(0);
    await expect(panel.locator('[data-time-fact="startTime"]')).toHaveText('10:10');
    await expect(panel.locator('[data-time-fact="endTime"]')).toHaveText('11:20');
    await expect(panel.locator('[data-time-fact="scoredTime"]')).toHaveCount(0);
  });

  test('control: a matchUp still to play keeps today’s panel, annotations and Set time included', async ({ page }) => {
    await page.locator(gridCell(seed.unscoredId)).click();
    const panel = page.locator(MATCHUP_PANEL);
    await expect(panel).toBeVisible();

    await expect(panel.getByText('Annotations', { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Followed by' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Set time' })).toBeVisible();
    await expect(panel.locator('[data-time-fact]')).toHaveCount(0);
    await expect(page.locator(COMPLETED_PANEL)).toHaveCount(0);
  });
});
