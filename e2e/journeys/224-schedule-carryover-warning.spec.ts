import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { daysFromTodayLocal, todayLocal } from '../helpers/dates';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 224 — a day that ran out of time (CA 2026-11-22, Battle of Boca).
 *
 * Saturday's R32 match was never played and never moved, so it was still dated Saturday on Sunday morning. The
 * factory orders a draw by its plan: nothing may be dated after a match it feeds. So every R64 match feeding that
 * R32 had no day it could take, and the date picker silently greyed out Sunday. The schedule page now raises a red
 * WARNING beside its date selector, and its modal clears the stale match's day. The date picker names the match
 * that limits it. Two catalog refinements ride along: one search across the Unscheduled and Scheduled tabs, focused
 * on every tab switch, and a docked (horizontal) catalog that no longer changes height with what it shows.
 *
 * Only the analysis has unit coverage (`carryoverAnalysis.test.ts`, `scheduleDateBoundsNote.test.ts`). This journey
 * is the evidence for the wiring: the header slot, the modal, the clear, the two search fields, the dock.
 */

const YESTERDAY = daysFromTodayLocal(-1);
const TODAY = todayLocal();
const TOMORROW = daysFromTodayLocal(1);

const WARNING = '.tmx-carryover-warning';
const DOCK = '[data-panel="catalog-region"]';

type Seed = { tournamentId: string; staleId: string; feederId: string; drawId: string };

async function seed(page: Page, eventType = 'SINGLES'): Promise<Seed> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  return page.evaluate(
    async ({ start, end, stale, today, eventType }) => {
      localStorage.clear();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'Carryover',
        tournamentAttributes: { tournamentId: 'carryover-journey', startDate: start, endDate: end },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'Singles', drawSize: 16, drawType: 'SINGLE_ELIMINATION', eventType }],
        venueProfiles: [{ venueName: 'Main', courtsCount: 8 }],
      });
      const matchUps = dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps;
      const find = (roundNumber: number, roundPosition: number) =>
        matchUps.find((m: any) => m.roundNumber === roundNumber && m.roundPosition === roundPosition);
      const staleMatchUp = find(2, 1);
      const feeder = find(1, 1);
      if (!staleMatchUp || !feeder) throw new Error('Missing seeded matchUps');
      // the R2 match left on yesterday's schedule, unplayed
      const result = dev.factory.tournamentEngine.addMatchUpScheduleItems({
        schedule: { scheduledDate: stale, scheduledTime: '14:30' },
        matchUpId: staleMatchUp.matchUpId,
        drawId: staleMatchUp.drawId,
      });
      if (result.error) throw new Error(JSON.stringify(result.error));
      // a few of today's matches with a time and no court: the Scheduled tab's cards, which carry the most lines
      for (const roundPosition of [5, 6, 7]) {
        const timed = find(1, roundPosition);
        dev.factory.tournamentEngine.addMatchUpScheduleItems({
          schedule: { scheduledDate: today, scheduledTime: '11:00' },
          matchUpId: timed.matchUpId,
          drawId: timed.drawId,
        });
      }
      await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord ?? tournamentRecord);
      return {
        tournamentId: tournamentRecord.tournamentId,
        staleId: staleMatchUp.matchUpId,
        feederId: feeder.matchUpId,
        drawId: feeder.drawId,
      };
    },
    { start: YESTERDAY, end: TOMORROW, stale: YESTERDAY, today: TODAY, eventType },
  );
}

test('a past day holding an unplayed match warns, explains the date picker, and clears on request', async ({
  page,
}) => {
  const { tournamentId, staleId, feederId, drawId } = await seed(page);
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToScheduling();

  const warning = page.locator(WARNING);
  await expect(warning).toBeVisible();
  await expect(warning.locator('.tmx-carryover-count')).toHaveText('1');
  // beside the date selector, to its left
  const selectorBox = (await page.locator('.sch2-header button').nth(1).boundingBox())!;
  expect((await warning.boundingBox())!.x).toBeLessThan(selectorBox.x);

  // The date picker for a feeder says why today is not offered
  await page.evaluate(
    async ({ matchUpId, drawId }) => {
      // the dev server serves the source module; a variable keeps tsc from resolving a path only Vite knows
      const modulePath = '/src/components/popovers/scheduleDatePicker.ts';
      const { openScheduleDatePicker } = await import(/* @vite-ignore */ modulePath);
      openScheduleDatePicker({ matchUpId, drawId, onPicked: () => undefined });
    },
    { matchUpId: feederId, drawId },
  );
  const note = page.locator('.tmx-date-picker-note');
  await expect(note).toHaveCount(1);
  await expect(note).toContainText('Days after');
  await expect(note).toContainText('which this match feeds into');
  await page.getByRole('button', { name: 'Cancel' }).click();

  // The modal lists the stale match, selected, and clears it
  await warning.click();
  const row = page.locator('.tmx-carryover-row');
  await expect(row).toHaveCount(1);
  await expect(row.locator('input[type="checkbox"]')).toBeChecked();
  await expect(row).toContainText('holds back');
  await page.getByRole('button', { name: 'Clear 1 match' }).click();

  await expect(warning).toBeHidden();
  const schedule = await page.evaluate(
    ({ matchUpId }) =>
      dev.factory.tournamentEngine.findMatchUp({ matchUpId, inContext: false }).matchUp?.schedule ?? {},
    { matchUpId: staleId },
  );
  expect(schedule.scheduledDate ?? '').toBe('');

  // Today is now open to the feeder, and nothing needs explaining
  const bounds = await page.evaluate(
    ({ matchUpId, drawId }) => dev.factory.tournamentEngine.getMatchUpScheduleBounds({ matchUpId, drawId }).bounds,
    { matchUpId: feederId, drawId },
  );
  expect(bounds.latestDate).toBe(TOMORROW);
  expect(TODAY < bounds.latestDate).toBe(true);
});

test('the catalog search is one query across both tabs, focused on every switch', async ({ page }) => {
  const { tournamentId } = await seed(page);
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToScheduling();

  const unscheduledTab = page.locator('button[data-sidebar-tab="unscheduled"]');
  const scheduledTab = page.locator('button[data-sidebar-tab="scheduled"]');
  const unscheduledSearch = page.locator('[data-panel="catalog"] .sp-catalog-toolbar input[type="text"]');
  const scheduledSearch = page.locator('[data-sidebar-panel="scheduled"] .sp-catalog-toolbar input[type="text"]');

  await unscheduledTab.click();
  await expect(unscheduledSearch).toBeFocused();
  await page.keyboard.type('Singles');

  await scheduledTab.click();
  await expect(scheduledSearch).toBeFocused();
  await expect(scheduledSearch).toHaveValue('Singles');
  await page.keyboard.type(' R');

  await unscheduledTab.click();
  await expect(unscheduledSearch).toBeFocused();
  await expect(unscheduledSearch).toHaveValue('Singles R');
});

test('the docked catalog keeps one height whatever it shows', async ({ page }) => {
  // doubles: two names a side make a card taller than the dock's minimum, which is when the height followed content
  const { tournamentId } = await seed(page, 'DOUBLES');
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToScheduling();

  await page.getByRole('button', { name: 'Scheduling layout' }).click();
  await page.getByRole('combobox', { name: 'Catalog placement', exact: true }).selectOption('bottom');
  await expect(page.locator('.spl-layout')).toHaveAttribute('data-catalog-placement', 'bottom');
  await page.keyboard.press('Escape');

  // Stand-in for a card with more to say than these seeded ones (ratings, rest, readiness lines at a live event):
  // taller than the dock's 180px minimum, which is when the dock's height started following its content.
  await page.addStyleTag({ content: '.spl-matchup-card { min-height: 200px; }' });
  const dock = page.locator(DOCK);
  const height = async () => Math.round((await dock.boundingBox())!.height);

  await page.locator('button[data-sidebar-tab="unscheduled"]').click();
  await expect(page.locator('[data-panel="catalog"] .spl-matchup-card').first()).toBeVisible();
  const withCards = await height();

  await page.locator('.tmx-catalog-collapse-all').click();
  await expect(page.locator('[data-panel="catalog"] .spl-matchup-card')).toHaveCount(0);
  const collapsed = await height();

  await page.locator('button[data-sidebar-tab="scheduled"]').click();
  await expect(page.locator('[data-sidebar-panel="scheduled"] .spl-matchup-card').first()).toBeVisible();
  const scheduledWithCards = await height();
  await page.locator('.tmx-catalog-collapse-all').click();
  const scheduledEmpty = await height();

  // taller than the 180px floor, so the dock really is holding a height its content set
  expect(withCards).toBeGreaterThan(180);
  expect(collapsed).toBe(withCards);
  expect(scheduledWithCards).toBe(withCards);
  expect(scheduledEmpty).toBe(withCards);
});
