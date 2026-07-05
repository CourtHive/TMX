import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 47 — Schedule2 completed-orphan visibility, funnel hide, and BYE
 * exclusion from the date selector.
 *
 * Three behaviors get locked down here, all from the same Battle-of-Boca
 * incident that surfaced them:
 *
 *  1. Completed matchUps that still carry a `scheduledDate`/`scheduledTime`
 *     but had their court coordinates cleared (operator unschedule, or an
 *     upstream sync wiping `courtId`/`venueId`/`courtOrder`) are orphans —
 *     they don't render on the grid (no court column to live in) and they
 *     used to be filtered out of the Scheduled-tab catalog unconditionally,
 *     leaving them invisible. The Scheduled tab now carries a "Show
 *     completed" toggle in its filter popover; ticking it reveals the
 *     orphans so they can be re-assigned to a court.
 *
 *  2. The Scheduled tab's funnel button is now hidden entirely when there
 *     are zero orphans for the selected date (even counting completed
 *     ones). Without this, opening the funnel surfaced an empty popover
 *     consisting of just the Clear All / × header — a dead UI.
 *
 *  3. BYE matchUps must not contribute to the date selector's "N matchUps"
 *     badge. The badge is meant to read as scheduled-work-on-this-date,
 *     and BYEs by definition don't get played. The Scheduled-tab counter
 *     already excluded BYEs; the date selector now matches.
 */

const SCHEDULE_DATE = new Date().toISOString().slice(0, 10);

const SCHEDULED_PANEL = '[data-sidebar-panel="scheduled"]';
const SCHEDULED_TAB = 'button[data-sidebar-tab="scheduled"]';
const CARD_SELECTOR = `${SCHEDULED_PANEL} .spl-matchup-card`;
const FILTER_BTN = `${SCHEDULED_PANEL} .spl-catalog-filter-btn`;
const FILTER_POPOVER = '.spl-filter-popover';
const FILTER_TOGGLE = `${FILTER_POPOVER} .spl-filter-toggle input[type="checkbox"]`;
// The visible date selector is a button in the schedule2 header whose
// innerHTML is `<i class="fa-calendar-days"></i><label><span>{count}</span>`.
// Inside its tippy popover are date chips with `data-date` — that's where
// we read the exact per-date count.
const DATE_BTN = 'button:has(i.fa-calendar-days)';
const DATE_POPOVER_CHIP = (date: string) => `.tippy-content [data-date="${date}"]`;

interface OrphanSeed {
  tournamentId: string;
  matchUpIds: string[];
}

/**
 * Seed an 8-draw SE event, stamp `scheduledDate`+`scheduledTime` on the four
 * first-round non-BYE matchUps (no `courtId`, so they are orphans), then
 * complete the first two by setting an outcome with `winningSide: 1`. The
 * resulting state is the exact shape Battle-of-Boca was in after the
 * upstream sync wiped court coordinates while preserving date/time.
 */
async function seedOrphansWithCompletedMix(
  page: import('@playwright/test').Page,
): Promise<OrphanSeed> {
  return page.evaluate(
    async ({ date }) => {
      try {
        await dev.tmx2db.initDB();

        const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
          setState: true,
          tournamentName: 'E2E Completed Orphans',
          tournamentAttributes: {
            tournamentId: 'e2e-completed-orphans',
            startDate: date,
            endDate: date,
          },
          participantsProfile: { scaledParticipantsCount: 16 },
          drawProfiles: [
            {
              eventName: 'Singles',
              drawSize: 8,
              seedsCount: 2,
              drawType: 'SINGLE_ELIMINATION',
            },
          ],
          venueProfiles: [{ courtsCount: 2, venueName: 'Orphans Venue' }],
        });

        const round1: any[] = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).filter(
          (m: any) => m.matchUpStatus !== 'BYE' && m.roundNumber === 1,
        );

        const matchUpIds: string[] = [];
        const timeSlots = ['10:00', '10:30', '11:00', '11:30'];
        for (let i = 0; i < 4 && i < round1.length; i++) {
          const m = round1[i];
          dev.factory.tournamentEngine.addMatchUpScheduleItems({
            matchUpId: m.matchUpId,
            drawId: m.drawId,
            schedule: { scheduledDate: date, scheduledTime: timeSlots[i] },
          });
          matchUpIds.push(m.matchUpId);
        }

        // Mark the first two as COMPLETED — same surface state the sync
        // produces: completed status + scheduledDate + scheduledTime + no
        // court. Without `winningSide` the outcome is invalid and the
        // matchUp doesn't transition into a completed status.
        for (let i = 0; i < 2 && i < round1.length; i++) {
          const m = round1[i];
          dev.factory.tournamentEngine.setMatchUpStatus({
            matchUpId: m.matchUpId,
            drawId: m.drawId,
            outcome: { matchUpStatus: 'COMPLETED', winningSide: 1, score: { sets: [] } },
          });
        }

        const mutated = dev.factory.tournamentEngine.getTournament().tournamentRecord;
        await dev.tmx2db.addTournament(mutated);

        return { tournamentId: tournamentRecord.tournamentId as string, matchUpIds };
      } catch (err: any) {
        throw new Error(
          `${err?.name || 'Error'}: ${err?.message || String(err)} | stack: ${err?.stack?.split('\n').slice(0, 3).join(' || ')}`,
        );
      }
    },
    { date: SCHEDULE_DATE },
  );
}

/**
 * Seed a tournament with NO scheduled-date stamps on any matchUp. The
 * Scheduled tab badge will read 0 and the funnel must be hidden — there
 * is nothing for the popover to filter, completed or otherwise.
 */
async function seedNoOrphans(page: import('@playwright/test').Page): Promise<{ tournamentId: string }> {
  return page.evaluate(
    async ({ date }) => {
      try {
        await dev.tmx2db.initDB();
        const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
          setState: true,
          tournamentName: 'E2E No Orphans',
          tournamentAttributes: {
            tournamentId: 'e2e-no-orphans',
            startDate: date,
            endDate: date,
          },
          participantsProfile: { scaledParticipantsCount: 16 },
          drawProfiles: [
            { eventName: 'Singles', drawSize: 8, seedsCount: 2, drawType: 'SINGLE_ELIMINATION' },
          ],
          venueProfiles: [{ courtsCount: 2, venueName: 'Empty Venue' }],
        });
        await dev.tmx2db.addTournament(tournamentRecord);
        return { tournamentId: tournamentRecord.tournamentId as string };
      } catch (err: any) {
        throw new Error(
          `${err?.name || 'Error'}: ${err?.message || String(err)} | stack: ${err?.stack?.split('\n').slice(0, 3).join(' || ')}`,
        );
      }
    },
    { date: SCHEDULE_DATE },
  );
}

/**
 * Seed a 4-draw SE event with only 3 participants — mocksEngine emits one
 * R1 BYE matchUp. Stamp `scheduledDate` on the BYE plus one non-BYE R1
 * matchUp so the date selector has two scheduled matchUps to consider;
 * the badge must read "1 matchUps" because the BYE is excluded.
 */
async function seedByeOnDate(page: import('@playwright/test').Page): Promise<{ tournamentId: string }> {
  return page.evaluate(
    async ({ date }) => {
      try {
        await dev.tmx2db.initDB();
        const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
          setState: true,
          tournamentName: 'E2E BYE Date Count',
          tournamentAttributes: {
            tournamentId: 'e2e-bye-date',
            startDate: date,
            endDate: date,
          },
          drawProfiles: [
            {
              eventName: 'Singles',
              drawSize: 8,
              participantsCount: 5,
              drawType: 'SINGLE_ELIMINATION',
            },
          ],
          venueProfiles: [{ courtsCount: 2, venueName: 'BYE Venue' }],
        });

        const round1: any[] = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).filter(
          (m: any) => m.roundNumber === 1,
        );
        const bye = round1.find((m: any) => m.matchUpStatus === 'BYE');
        const real = round1.find((m: any) => m.matchUpStatus !== 'BYE');
        if (!bye || !real) throw new Error('seedByeOnDate: could not find a BYE + non-BYE R1 pair');

        for (const m of [bye, real]) {
          dev.factory.tournamentEngine.addMatchUpScheduleItems({
            matchUpId: m.matchUpId,
            drawId: m.drawId,
            schedule: { scheduledDate: date, scheduledTime: '10:00' },
          });
        }

        const mutated = dev.factory.tournamentEngine.getTournament().tournamentRecord;
        await dev.tmx2db.addTournament(mutated);
        return { tournamentId: tournamentRecord.tournamentId as string };
      } catch (err: any) {
        throw new Error(
          `${err?.name || 'Error'}: ${err?.message || String(err)} | stack: ${err?.stack?.split('\n').slice(0, 3).join(' || ')}`,
        );
      }
    },
    { date: SCHEDULE_DATE },
  );
}

async function openScheduledTab(page: import('@playwright/test').Page): Promise<void> {
  await page.locator(SCHEDULED_TAB).click();
  await page.locator(SCHEDULED_PANEL).waitFor({ state: 'visible', timeout: 10_000 });
}

test.describe('Journey 47 — Schedule2 completed-orphan visibility + BYE date count', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('completed orphans hidden by default; "Show completed" reveals them', async ({ page }) => {
    const { tournamentId } = await seedOrphansWithCompletedMix(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();
    await openScheduledTab(page);

    // 4 orphans seeded, 2 completed → toggle off shows only the 2 non-completed.
    await expect(page.locator(CARD_SELECTOR)).toHaveCount(2);

    // Open the popover and tick "Show completed".
    await page.locator(FILTER_BTN).click();
    const toggle = page.locator(FILTER_TOGGLE);
    await toggle.waitFor({ state: 'visible', timeout: 5_000 });
    await toggle.check();

    // Store flips → existing store-subscription re-runs updateScheduledPanel.
    // All 4 orphans are now visible (the two completed ones plus the two
    // that were never completed).
    await expect(page.locator(CARD_SELECTOR)).toHaveCount(4);

    // Unchecking restores the default hidden state.
    await toggle.uncheck();
    await expect(page.locator(CARD_SELECTOR)).toHaveCount(2);
  });

  test('funnel button hides when there are zero orphans on the selected date', async ({ page }) => {
    const { tournamentId } = await seedNoOrphans(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();
    await openScheduledTab(page);

    // Funnel button must not be visible — there is nothing for the popover
    // to act on. Without this, the popover renders an empty Clear All / ×
    // husk that confuses operators ("the filter is broken").
    await expect(page.locator(FILTER_BTN)).toBeHidden();

    // And of course no cards render.
    await expect(page.locator(CARD_SELECTOR)).toHaveCount(0);
  });

  test('BYE matchUps are excluded from the date selector count', async ({ page }) => {
    const { tournamentId } = await seedByeOnDate(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();

    // Open the date popover and read the chip badge for the seeded date.
    // Two matchUps carry the scheduledDate (one BYE + one real); the chip
    // must show "1" because BYE matchUps are never scheduled-work and the
    // badge would mislead operators about how much there is to schedule.
    await page.locator(DATE_BTN).first().click();
    const chip = page.locator(DATE_POPOVER_CHIP(SCHEDULE_DATE));
    await chip.waitFor({ state: 'visible', timeout: 10_000 });
    // The badge `<span>` is the LAST span in the chip's right-side badges
    // container — its textContent is just the numeric count.
    await expect(chip.locator('span').last()).toHaveText('1');
  });
});
