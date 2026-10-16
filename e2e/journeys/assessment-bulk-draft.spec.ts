import { initDevBridge, resetState, waitForAppReady, loginAsProviderMember } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { todayLocal } from '../helpers/dates';

/**
 * Assessment regression — provider bulk drafts without an IndexedDB baseline.
 *
 * In bulk mode the grid runs drops locally on competitionEngine and queues the
 * methods in `pendingMethods` — it does NOT call mutationRequest until Save. The
 * mutation collector (console capture of dev.context({internal:true})) therefore
 * shows ZERO dispatched methods while queued, which is exactly what makes the
 * discard-clobber invariant (CLAUDE.md "Save Model Invariant") assertable:
 *   - Save  → all queued batches flush as ONE mutationRequest.
 *   - Discard → nothing is dispatched; preview-owned fields revert without relying on IndexedDB.
 *
 * Uses cell→cell reschedule drags across three distinct courts so the selectors
 * stay stable across the grid's post-drop re-render.
 */

const DATE = todayLocal();
const STRIP = '.spl-active-strip';
const SAVE = '.sp-btn--success';
const DISCARD = '.sp-btn--danger';
const BULK_TOGGLE = 'label:has-text("Bulk mode") input[type="checkbox"]';

interface Seed {
  tournamentId: string;
  courtIds: string[]; // [A, B, C]
  matchUpIds: string[]; // [m on A/1, m on B/1]
}

/** Dispatch a native HTML5 drag/drop using one shared DataTransfer. */
async function dispatchDnD(page: Page, source: string, target: string): Promise<void> {
  await page.evaluate(
    ({ s, t }) => {
      const src = document.querySelector(s);
      const tgt = document.querySelector(t);
      if (!src || !tgt) throw new Error(`DnD selectors not found (source=${!!src}, target=${!!tgt}): ${s} -> ${t}`);
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

/** Seed 3 courts; place one matchUp on court A order 1 and one on court B order 1. */
async function seed(page: Page): Promise<Seed> {
  return page.evaluate(
    async ({ date }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Bulk Save Discard',
        tournamentAttributes: { tournamentId: 'e2e-bulk-save-discard', startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 3, venueName: 'Bulk Venue' }],
      });

      const courts = dev.factory.tournamentEngine.getVenuesAndCourts().venues[0].courts;
      const [A, B] = courts;
      const playable = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).filter(
        (m: any) =>
          m.matchUpStatus !== 'BYE' &&
          (m.sides || []).filter((s: any) => s.participantId || s.participant?.participantId).length === 2,
      );

      const place = (mu: any, court: any, order: number) =>
        dev.factory.tournamentEngine.addMatchUpScheduleItems({
          matchUpId: mu.matchUpId,
          drawId: mu.drawId,
          schedule: { scheduledDate: date, venueId: court.venueId, courtId: court.courtId, courtOrder: order },
        });
      place(playable[0], A, 1);
      place(playable[1], B, 1);

      const rec = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      await dev.tmx2db.addTournament(rec);
      return {
        tournamentId: tournamentRecord.tournamentId as string,
        courtIds: courts.map((c: any) => c.courtId as string),
        matchUpIds: [playable[0].matchUpId as string, playable[1].matchUpId as string],
      } as Seed;
    },
    { date: DATE },
  );
}

function cell(courtId: string, order: number): string {
  return `[data-court-id="${courtId}"][data-court-order="${order}"]`;
}

async function openGridInBulkMode(page: Page, tournamentId: string): Promise<void> {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToScheduling();
  await page.waitForSelector(STRIP, { timeout: 10_000 });
  await page.locator(BULK_TOGGLE).check();
}

test.describe('assessment bulk draft integrity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  async function stageWithoutLocalRecord(page: Page) {
    const s = await seed(page);
    await openGridInBulkMode(page, s.tournamentId);
    await page.evaluate(async (id) => {
      const record = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      record.parentOrganisation = { organisationId: 'assessment-provider' };
      dev.factory.tournamentEngine.setState(record);
      await dev.tmx2db.deleteTournament(id);
    }, s.tournamentId);
    await dispatchDnD(page, cell(s.courtIds[0], 1), cell(s.courtIds[2], 1));
    await expect(page.getByText(/1 unsaved action/)).toBeVisible();
    return s;
  }

  test('discard restores a provider schedule without any local record and preserves a newer unrelated change', async ({
    page,
  }) => {
    const s = await stageWithoutLocalRecord(page);
    await page.evaluate(() => {
      const record = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      record.tournamentName = 'A concurrent update';
      dev.factory.tournamentEngine.setState(record);
    });
    await page.locator(DISCARD).click();
    await expect(page.locator(SAVE)).toHaveCount(0);
    const actual = await page.evaluate(
      (matchUpId) => ({
        courtId: dev.factory.tournamentEngine.findMatchUp({ matchUpId, inContext: true }).matchUp?.schedule?.courtId,
        name: dev.factory.tournamentEngine.getTournament().tournamentRecord?.tournamentName,
      }),
      s.matchUpIds[0],
    );
    expect(actual.courtId).toBe(s.courtIds[0]);
    expect(actual.name).toBe('A concurrent update');
  });

  test('a failed save retains pending changes for retry or discard', async ({ page }) => {
    await stageWithoutLocalRecord(page);
    await loginAsProviderMember(page, 'assessment-provider');
    await page.locator(SAVE).click();
    await expect(page.getByText('Failed to save scheduling changes to server', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator(SAVE)).toBeEnabled();
    await expect(page.getByText(/1 unsaved action/)).toBeVisible();
    await page.locator(DISCARD).click();
    await expect(page.locator(SAVE)).toHaveCount(0);
  });

  test('tab navigation asks before discarding pending schedule changes', async ({ page }) => {
    const s = await stageWithoutLocalRecord(page);
    await page.evaluate((id) => dev.tournamentContext.router?.navigate(`/tournament/${id}/events`), s.tournamentId);
    await expect(page.getByText(/Discard.*scheduling changes.*leave/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByText(/1 unsaved action/)).toBeVisible();
  });
  test('click-away cancels a navigation prompt and permits the next attempt', async ({ page }) => {
    const s = await stageWithoutLocalRecord(page);
    const navigate = () =>
      page.evaluate((id) => dev.tournamentContext.router?.navigate(`/tournament/${id}/events`), s.tournamentId);
    await navigate();
    await expect(page.getByText(/Discard.*scheduling changes.*leave/)).toBeVisible();
    await page
      .locator('section[id^="cmdl-"]')
      .last()
      .locator(':scope > div')
      .click({ position: { x: 2, y: 2 } });
    await expect(page.getByText(/Discard.*scheduling changes.*leave/)).toHaveCount(0);
    await expect(page.getByText(/1 unsaved action/)).toBeVisible();
    await navigate();
    await expect(page.getByText(/Discard.*scheduling changes.*leave/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  });
  test('cancelled back navigation restores the scheduling URL and keeps the draft', async ({ page }) => {
    await stageWithoutLocalRecord(page);
    const before = page.url();
    await page.goBack();
    await expect(page.getByText(/Discard.*scheduling changes.*leave/)).toBeVisible();
    const destination = page.url();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page).toHaveURL(before);
    await expect(page.getByText(/1 unsaved action/)).toBeVisible();
    await page.goBack();
    await expect(page.getByText(/Discard.*scheduling changes.*leave/)).toBeVisible();
    await expect(page).toHaveURL(destination);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page).toHaveURL(before);
  });
});
