import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { todayLocal } from '../helpers/dates';

/**
 * Journey 210 — a matchUp taken off the grid comes back to the catalog (production defect, CA 2026-11-17).
 *
 * A matchUp scheduled for 09:00 is dragged from the catalog's Scheduled tab onto a court, then from the grid back to
 * the catalog. Dropped on the Scheduled tab it keeps its time, so it must reappear there; dropped on the Unscheduled
 * catalog it is unscheduled entirely and reappears there.
 *
 * The defect: the Scheduled drop cleared the venue and court order but not the court — the factory applies `courtId`
 * only together with a `scheduledDate`, and the drop sent none — so the matchUp was on no grid cell (the grid places by
 * court AND order) and in neither list (Scheduled excluded it for its court, Unscheduled for its date). The third test
 * seeds that stranded state directly, as production holds it, and shows it is listed again and can be placed.
 */

const DATE = todayLocal();
const NINE = '09:00';
const SCHEDULED_PANEL = '[data-sidebar-panel="scheduled"]';
const UNSCHEDULED_PANEL = '[data-panel="catalog"]';
const SCHEDULED_TAB = 'button[data-sidebar-tab="scheduled"]';
const UNSCHEDULED_TAB = 'button[data-sidebar-tab="unscheduled"]';

/** A native HTML5 drag and drop sharing one DataTransfer, so the drop reads the source's dragstart payload. */
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

/**
 * One first-round matchUp scheduled for 09:00 today with no court; `strandedOnCourt` adds the court alone (no venue,
 * no order) — the record the defect left behind. Seeded and persisted in one evaluate so the save cannot race.
 */
async function seed(page: Page, { strandedOnCourt = false } = {}) {
  return page.evaluate(
    async ({ date, time, strandedOnCourt }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Return To Catalog',
        tournamentAttributes: { tournamentId: 'e2e-return-to-catalog', startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 2, venueName: 'Return Venue' }],
      });
      const matchUp = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
        (m: any) => m.matchUpStatus !== 'BYE' && m.roundNumber === 1,
      );
      const { courts } = dev.factory.tournamentEngine.getVenuesAndCourts();
      const courtId = courts[0].courtId;
      dev.factory.tournamentEngine.addMatchUpScheduleItems({
        matchUpId: matchUp.matchUpId,
        drawId: matchUp.drawId,
        schedule: { scheduledDate: date, scheduledTime: time, ...(strandedOnCourt && { courtId }) },
      });
      await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord);
      return { tournamentId: tournamentRecord.tournamentId as string, matchUpId: matchUp.matchUpId as string, courtId };
    },
    { date: DATE, time: NINE, strandedOnCourt },
  );
}

const readSchedule = (page: Page, matchUpId: string) =>
  page.evaluate((id) => dev.factory.tournamentEngine.findMatchUp({ matchUpId: id }).matchUp?.schedule ?? {}, matchUpId);

const card = (panel: string, matchUpId: string) => `${panel} .spl-matchup-card[data-matchup-id="${matchUpId}"]`;
const emptyCell = (courtId: string) => `[data-court-id="${courtId}"][data-court-order="1"]`;
const gridCell = (courtId: string, matchUpId: string) => `${emptyCell(courtId)}[data-matchup-id="${matchUpId}"]`;

async function openScheduling(page: Page, tournamentId: string): Promise<void> {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToScheduling();
  await page.locator(SCHEDULED_TAB).click();
  await page.locator(SCHEDULED_PANEL).waitFor({ state: 'visible', timeout: 10_000 });
}

/** From the Scheduled tab onto the first cell of the court: placed, with its 09:00 kept. */
async function placeOnCourt(page: Page, matchUpId: string, courtId: string): Promise<void> {
  await expect(page.locator(card(SCHEDULED_PANEL, matchUpId))).toBeVisible();
  await dispatchDnD(page, card(SCHEDULED_PANEL, matchUpId), emptyCell(courtId));
  await expect(page.locator(gridCell(courtId, matchUpId))).toBeVisible({ timeout: 8_000 });
  await expect(page.locator(card(SCHEDULED_PANEL, matchUpId))).toHaveCount(0);
  const schedule = await readSchedule(page, matchUpId);
  expect(schedule).toMatchObject({ courtId, courtOrder: 1, scheduledTime: NINE, scheduledDate: DATE });
}

test.describe('Journey 210 — a matchUp taken off the grid comes back to the catalog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('dropped back on the Scheduled tab it reappears there, its 09:00 kept and its court cleared', async ({
    page,
  }) => {
    const { tournamentId, matchUpId, courtId } = await seed(page);
    await openScheduling(page, tournamentId);
    await placeOnCourt(page, matchUpId, courtId);

    await dispatchDnD(page, gridCell(courtId, matchUpId), SCHEDULED_PANEL);

    await expect(page.locator(card(SCHEDULED_PANEL, matchUpId))).toBeVisible({ timeout: 8_000 });
    await expect(page.locator(`[data-court-id][data-court-order][data-matchup-id="${matchUpId}"]`)).toHaveCount(0);
    const schedule = await readSchedule(page, matchUpId);
    expect(schedule).toMatchObject({ scheduledDate: DATE, scheduledTime: NINE });
    expect(schedule.courtId).toBeUndefined();
    expect(schedule.venueId).toBeUndefined();
    expect(schedule.courtOrder).toBeUndefined();
  });

  test('dropped on the Unscheduled catalog it is unscheduled and reappears there', async ({ page }) => {
    const { tournamentId, matchUpId, courtId } = await seed(page);
    await openScheduling(page, tournamentId);
    await placeOnCourt(page, matchUpId, courtId);

    await page.locator(UNSCHEDULED_TAB).click();
    await dispatchDnD(page, gridCell(courtId, matchUpId), UNSCHEDULED_PANEL);

    await expect(page.locator(card(UNSCHEDULED_PANEL, matchUpId))).toBeVisible({ timeout: 8_000 });
    const schedule = await readSchedule(page, matchUpId);
    expect(schedule.scheduledDate).toBeUndefined();
    expect(schedule.scheduledTime).toBeUndefined();
    expect(schedule.courtId).toBeUndefined();
  });

  test('a matchUp left with a court but no place on the grid is listed on the Scheduled tab and can be placed', async ({
    page,
  }) => {
    const { tournamentId, matchUpId, courtId } = await seed(page, { strandedOnCourt: true });
    const stranded = await readSchedule(page, matchUpId);
    expect(stranded).toMatchObject({ courtId, scheduledTime: NINE });
    expect(stranded.courtOrder).toBeUndefined();

    await openScheduling(page, tournamentId);
    await placeOnCourt(page, matchUpId, courtId);
  });
});
