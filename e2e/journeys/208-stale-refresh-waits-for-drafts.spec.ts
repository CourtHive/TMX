import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect, type Page } from '@playwright/test';
import { todayLocal } from '../helpers/dates';
import { S } from '../helpers/selectors';

/**
 * Journey 208 — the stale icon's refresh waits for a draft.
 *
 * Clicking the stale icon installs the server's record over this copy. Over a scheduling draft that install would
 * discard the entry, so the click is refused with a warning and nothing is fetched; a score being typed sits in a modal
 * dialog that keeps the icon out of reach. Once the draft is discarded or the dialog cancelled, the click loads the
 * record. Automatic recovery runs only on the Check-In desk, which cannot be entered while a scheduling draft is open,
 * so the click is the one path a draft has to survive.
 *
 * The stale state is driven by `dev.forceStaleness()` and `/factory/fetch` is served locally, as in journey 51.
 */

const DATE = todayLocal();
const STRIP = '.spl-active-strip';
const DISCARD = '.sp-btn--danger';
const BULK_TOGGLE = 'label:has-text("Bulk mode") input[type="checkbox"]';
const SCORE_DIALOG = '.chc-sec';
const SCORE_INPUT = (set: number, side: number) => `input.chc-sec-set-input[data-set="${set}"][data-side="${side}"]`;
const REFUSAL = /unsaved entry or pending change finishes/;

interface Seed {
  tournamentId: string;
  courtIds: string[];
  matchUpId: string;
}

/** Three courts on one day; one matchUp on court A, order 1. */
async function seed(page: Page): Promise<Seed> {
  return page.evaluate(
    async ({ date }) => {
      await dev.tmx2db.initDB();
      dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Stale Refresh Drafts',
        tournamentAttributes: { tournamentId: 'e2e-stale-refresh-drafts', startDate: date, endDate: date },
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 3, venueName: 'Draft Venue' }],
      });
      const courts = dev.factory.tournamentEngine.getVenuesAndCourts().venues[0].courts;
      const matchUp = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
        (m: any) => m.matchUpStatus !== 'BYE' && m.roundNumber === 1,
      );
      const result = dev.factory.tournamentEngine.addMatchUpScheduleItems({
        matchUpId: matchUp.matchUpId,
        drawId: matchUp.drawId,
        schedule: { scheduledDate: date, venueId: courts[0].venueId, courtId: courts[0].courtId, courtOrder: 1 },
      });
      if (result.error) throw new Error(JSON.stringify(result.error));
      const { tournamentRecord } = dev.factory.tournamentEngine.getTournament();
      await dev.tmx2db.addTournament(tournamentRecord);
      return {
        tournamentId: tournamentRecord.tournamentId as string,
        courtIds: courts.map((court: any) => court.courtId as string),
        matchUpId: matchUp.matchUpId as string,
      };
    },
    { date: DATE },
  );
}

/** Serve the full-record fetch from this copy and count the requests. */
async function serveFetch(page: Page, tournamentId: string): Promise<() => number> {
  let calls = 0;
  await page.route('**/factory/fetch', async (route) => {
    calls += 1;
    const record = await page.evaluate(() => dev.getTournament());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tournamentRecords: { [tournamentId]: record } }),
    });
  });
  return () => calls;
}

/** A native HTML5 drag and drop with one shared DataTransfer, as journey 60 drives the grid. */
async function dragAndDrop(page: Page, source: string, target: string): Promise<void> {
  await page.evaluate(
    ({ s, t }) => {
      const src = document.querySelector(s);
      const tgt = document.querySelector(t);
      if (!src || !tgt) throw new Error(`drag selectors not found (source=${!!src}, target=${!!tgt}): ${s} -> ${t}`);
      const dt = new DataTransfer();
      const fire = (el: Element, type: string) =>
        el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
      fire(src, 'dragstart');
      fire(tgt, 'dragover');
      fire(tgt, 'drop');
      fire(src, 'dragend');
    },
    { s: source, t: target },
  );
}

const cell = (courtId: string, order: number) => `[data-court-id="${courtId}"][data-court-order="${order}"]`;
const courtOf = (page: Page, matchUpId: string) =>
  page.evaluate(
    (id) =>
      (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find((m: any) => m.matchUpId === id)
        ?.schedule?.courtId ?? null,
    matchUpId,
  );

test.describe('Journey 208 — the stale refresh waits for a draft', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('a scheduling grid draft survives the click; once discarded, the click loads the record', async ({ page }) => {
    const s = await seed(page);
    const [A, , C] = s.courtIds;
    const fetches = await serveFetch(page, s.tournamentId);
    const icon = page.locator(S.SYNC_INDICATOR);
    const tournament = new TournamentPage(page);

    await tournament.goto(s.tournamentId);
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP, { timeout: 10_000 });
    await page.locator(BULK_TOGGLE).check();
    await page.waitForSelector(cell(A, 1));
    await dragAndDrop(page, cell(A, 1), cell(C, 1));
    const status = page.getByText(/unsaved action/);
    await expect(status).toContainText('1 unsaved action', { timeout: 8_000 });
    expect(await courtOf(page, s.matchUpId)).toBe(C);

    await page.evaluate(() => dev.forceStaleness());
    await expect(icon).toBeVisible();
    await icon.click();
    await expect(page.getByText(REFUSAL).first()).toBeVisible();
    await expect(icon).toHaveAttribute('title', REFUSAL);
    expect(fetches()).toBe(0);
    await expect(status).toContainText('1 unsaved action');
    expect(await courtOf(page, s.matchUpId)).toBe(C);
    expect(await page.evaluate(() => dev.isStale())).toBe(true);

    await page.locator(DISCARD).click();
    await expect(status).toHaveCount(0, { timeout: 8_000 });
    await icon.click();
    await expect.poll(fetches).toBe(1);
    await expect(icon).toBeHidden();
    expect(await page.evaluate(() => dev.isStale())).toBe(false);
  });

  // The score dialog is modal: its backdrop covers the navbar, so the icon cannot be clicked at all while a score is
  // typed (the refusal behind it, `isScoringActive` in authoritativeRecovery.ts, is a second line).
  test('a score being typed: the dialog covers the stale icon, and once cancelled the click loads the record', async ({
    page,
  }) => {
    const s = await seed(page);
    const fetches = await serveFetch(page, s.tournamentId);
    const icon = page.locator(S.SYNC_INDICATOR);
    const tournament = new TournamentPage(page);

    await tournament.goto(s.tournamentId);
    await page.evaluate((id) => (dev as any).enterMatchUpScore({ matchUpId: id }), s.matchUpId);
    const dialog = page.locator(SCORE_DIALOG);
    await expect(dialog).toBeVisible();
    await page.locator(SCORE_INPUT(1, 1)).fill('6');
    await page.locator(SCORE_INPUT(1, 2)).fill('3');

    await page.evaluate(() => dev.forceStaleness());
    await expect(icon).toBeVisible();
    await expect(icon.click({ trial: true, timeout: 2_000 })).rejects.toThrow(/intercepts pointer events/);
    expect(fetches()).toBe(0);
    expect(await page.evaluate(() => dev.isStale())).toBe(true);
    await expect(dialog).toBeVisible();
    await expect(page.locator(SCORE_INPUT(1, 1))).toHaveValue('6');
    await expect(page.locator(SCORE_INPUT(1, 2))).toHaveValue('3');

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await icon.click();
    await expect.poll(fetches).toBe(1);
    await expect(icon).toBeHidden();
    expect(await page.evaluate(() => dev.isStale())).toBe(false);
  });
});
