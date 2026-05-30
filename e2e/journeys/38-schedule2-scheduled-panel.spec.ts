import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 38 — Schedule2 Scheduled panel.
 *
 * The schedule2 sidebar has two tabs — Unscheduled (the catalog of matchUps
 * waiting for a court) and Scheduled (matchUps that already have a
 * `scheduledTime` but are not yet placed on a specific court). This journey
 * exercises the Scheduled tab's contract:
 *
 *  - Switching to the tab renders cards inside the panel with the
 *    prominent-time header (the time is the primary signal on this side).
 *  - The panel meta line reads "N scheduled" with the correct count.
 *  - Search input filters the visible cards via the same
 *    `filterMatchUpCatalog` pipeline the Unscheduled side runs.
 *  - Group-by select changes the `.sp-group` partitioning (event / draw /
 *    round / structure).
 *  - The pure adapters in `gridViewStorage.ts` (13 unit tests) persist the
 *    tab + search + groupBy across page reloads.
 *
 * The unscheduled-side panel uses the same class names (`.sp-panel-meta`,
 * `.sp-input`, `.sp-select`, `.sp-catalog`) — both panels live in the
 * sidebar DOM simultaneously and toggle via `display: none/flex`. To avoid
 * the wrong panel matching first(), every selector here is scoped to
 * `[data-sidebar-panel="scheduled"]`.
 */

const SCHEDULE_DATE = new Date().toISOString().slice(0, 10);

const SCHEDULED_PANEL = '[data-sidebar-panel="scheduled"]';
const SCHEDULED_TAB = 'button[data-sidebar-tab="scheduled"]';
const CARD_SELECTOR = `${SCHEDULED_PANEL} .spl-matchup-card`;
const GROUP_HEADER_SELECTOR = `${SCHEDULED_PANEL} .sp-group-header`;
const SEARCH_INPUT_SELECTOR = `${SCHEDULED_PANEL} .sp-input`;
const GROUP_SELECT_SELECTOR = `${SCHEDULED_PANEL} .sp-select`;
const PANEL_META_SELECTOR = `${SCHEDULED_PANEL} .sp-panel-meta`;

interface ScheduledSeed {
  tournamentId: string;
  scheduledMatchUpIds: string[];
}

/**
 * Seed an 8-draw SE event and stamp `scheduledTime` on four R1 matchUps.
 * We do NOT place the matchUps on the court grid — only the time is set,
 * so the Scheduled panel (which lists "scheduled-but-not-placed") shows
 * the four cards. Different time slots give the search test a stable
 * discriminator.
 *
 * Bundled into a single page.evaluate so the IDB write doesn't race the
 * seed helper's fire-and-forget `dev.load` (same gotcha Journey 29's
 * `seedAndScheduleFirstMatchUp` documents).
 */
async function seedScheduledMatchUps(
  page: import('@playwright/test').Page,
  count: number,
): Promise<ScheduledSeed> {
  return page.evaluate(
    async ({ date, count }) => {
      try {
        await dev.tmx2db.initDB();

        const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
          setState: true,
          tournamentName: 'E2E Scheduled Panel',
          tournamentAttributes: {
            tournamentId: 'e2e-scheduled-panel',
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
          venueProfiles: [{ courtsCount: 2, venueName: 'Scheduled Panel Venue' }],
        });

        const matchUps = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).filter(
          (m: any) => m.matchUpStatus !== 'BYE' && m.roundNumber === 1,
        );

        const scheduledMatchUpIds: string[] = [];
        const timeSlots = ['10:00', '10:30', '11:00', '11:30'];
        for (let i = 0; i < count && i < matchUps.length; i++) {
          const m = matchUps[i];
          dev.factory.tournamentEngine.addMatchUpScheduleItems({
            matchUpId: m.matchUpId,
            drawId: m.drawId,
            schedule: { scheduledDate: date, scheduledTime: timeSlots[i] },
          });
          scheduledMatchUpIds.push(m.matchUpId);
        }

        const mutated = dev.factory.tournamentEngine.getTournament().tournamentRecord;
        await dev.tmx2db.addTournament(mutated);

        return { tournamentId: tournamentRecord.tournamentId as string, scheduledMatchUpIds };
      } catch (err: any) {
        throw new Error(
          `${err?.name || 'Error'}: ${err?.message || String(err)} | stack: ${err?.stack?.split('\n').slice(0, 3).join(' || ')}`,
        );
      }
    },
    { date: SCHEDULE_DATE, count },
  );
}

async function openScheduledTab(page: import('@playwright/test').Page): Promise<void> {
  await page.locator(SCHEDULED_TAB).click();
  // Panel flips from display:none to display:flex on tab activation.
  await page.locator(SCHEDULED_PANEL).waitFor({ state: 'visible', timeout: 10_000 });
}

test.describe('Journey 38 — Schedule2 Scheduled panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('Scheduled tab lists every scheduled-but-not-placed matchUp', async ({ page }) => {
    const { tournamentId } = await seedScheduledMatchUps(page, 4);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToSchedule2();
    await openScheduledTab(page);

    await expect(page.locator(PANEL_META_SELECTOR)).toHaveText(/4 scheduled/);

    await expect(page.locator(CARD_SELECTOR)).toHaveCount(4);

    // Every card carries the prominent-time header — `.spl-card-time-header`
    // is the span buildMatchUpCard appends when `{ prominentTime: true }`.
    await expect(page.locator(`${SCHEDULED_PANEL} .spl-card-time-header`)).toHaveCount(4);
  });

  test('typing in the Scheduled-panel search filters the cards', async ({ page }) => {
    const { tournamentId, scheduledMatchUpIds } = await seedScheduledMatchUps(page, 4);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToSchedule2();
    await openScheduledTab(page);

    await expect(page.locator(CARD_SELECTOR)).toHaveCount(4);

    // matchUpSearchKey concatenates eventName + drawName + roundName +
    // every participantName. Pull the participantName from side 1 of the
    // FIRST scheduled matchUp via the factory; that token is guaranteed
    // to be in only one card (mocksEngine emits unique participant names).
    const nameToken: string = await page.evaluate((mid: string) => {
      const matchUps = dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps ?? [];
      const m = matchUps.find((x: any) => x.matchUpId === mid);
      // Resolve participantId → participantName via the participant store.
      const participantId = m?.sides?.find((s: any) => s?.participantId)?.participantId;
      if (!participantId) return '';
      const all = dev.factory.tournamentEngine.q.participants() ?? [];
      const p = all.find((x: any) => x.participantId === participantId);
      const participantName = p?.participantName ?? '';
      // Family name (last whitespace-separated token).
      return participantName.split(/\s+/).filter(Boolean).pop() ?? '';
    }, scheduledMatchUpIds[0]);
    expect(nameToken.length).toBeGreaterThan(0);

    const search = page.locator(SEARCH_INPUT_SELECTOR);
    await search.fill(nameToken);

    // Filter narrows to the single card whose side carries that name token.
    await expect(page.locator(CARD_SELECTOR)).toHaveCount(1);
    await expect(page.locator(PANEL_META_SELECTOR)).toHaveText(/1 scheduled/);

    // Clear the search → all 4 cards return.
    await search.fill('');
    await expect(page.locator(CARD_SELECTOR)).toHaveCount(4);
    await expect(page.locator(PANEL_META_SELECTOR)).toHaveText(/4 scheduled/);
  });

  test('group-by select re-partitions cards (event -> round -> structure)', async ({ page }) => {
    const { tournamentId } = await seedScheduledMatchUps(page, 4);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToSchedule2();
    await openScheduledTab(page);

    const groupSelect = page.locator(GROUP_SELECT_SELECTOR);
    await expect(groupSelect).toHaveCount(1);

    // Default group-by is `event` — single 'Singles' event → exactly one group.
    await expect(page.locator(GROUP_HEADER_SELECTOR)).toHaveCount(1);
    await expect(page.locator(GROUP_HEADER_SELECTOR).first()).toContainText('Singles');

    // Switch to round — all four matchUps are in R1, so still 1 group, but
    // the header label changes to the round name.
    await groupSelect.selectOption('round');
    await expect(page.locator(GROUP_HEADER_SELECTOR)).toHaveCount(1);

    // Switch to structure — still 1 group (single MAIN structure).
    await groupSelect.selectOption('structure');
    await expect(page.locator(GROUP_HEADER_SELECTOR)).toHaveCount(1);
  });

  test('tab choice + groupBy persist across page reload', async ({ page }) => {
    const { tournamentId } = await seedScheduledMatchUps(page, 4);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToSchedule2();
    await openScheduledTab(page);

    const groupSelect = page.locator(GROUP_SELECT_SELECTOR);
    await groupSelect.selectOption('round');

    // Reload: sidebar should come back on Scheduled tab + persisted groupBy.
    await page.reload();
    await waitForAppReady(page);
    await initDevBridge(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToSchedule2();

    await page.locator(SCHEDULED_PANEL).waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.locator(GROUP_SELECT_SELECTOR)).toHaveValue('round');
    await expect(page.locator(PANEL_META_SELECTOR)).toHaveText(/4 scheduled/);
  });
});
