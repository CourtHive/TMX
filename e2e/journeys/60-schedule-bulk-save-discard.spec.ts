import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 60 — Scheduling grid bulk mode: batch save + discard-no-clobber.
 *
 * In bulk mode the grid runs drops locally on competitionEngine and queues the
 * methods in `pendingMethods` — it does NOT call mutationRequest until Save. The
 * mutation collector (console capture of dev.context({internal:true})) therefore
 * shows ZERO dispatched methods while queued, which is exactly what makes the
 * discard-clobber invariant (CLAUDE.md "Save Model Invariant") assertable:
 *   - Save  → all queued batches flush as ONE mutationRequest.
 *   - Discard → nothing is dispatched; factory reloads from IndexedDB (no clobber).
 *
 * Uses cell→cell reschedule drags across three distinct courts so the selectors
 * stay stable across the grid's post-drop re-render.
 */

const DATE = new Date().toISOString().slice(0, 10);
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

test.describe('Journey 60 — scheduling grid bulk save / discard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('bulk drops queue locally (0 dispatched) and Save flushes them as one request', async ({ page }) => {
    const s = await seed(page);
    const [A, B, C] = s.courtIds;
    const collector = createMutationCollector(page);

    await openGridInBulkMode(page, s.tournamentId);

    // Reschedule A/1 → C/1, then B/1 → C/2 (distinct courts, stable selectors).
    // The status span counts queued DROPS (pendingMethods.length), stable at one
    // per drag; the Save button counts methods, which varies per drop.
    const status = page.getByText(/unsaved action/);
    await page.waitForSelector(cell(A, 1));
    await dispatchDnD(page, cell(A, 1), cell(C, 1));
    await expect(status).toContainText('1 unsaved action', { timeout: 8_000 });

    await page.waitForSelector(cell(B, 1));
    await dispatchDnD(page, cell(B, 1), cell(C, 2));
    await expect(status).toContainText('2 unsaved actions');

    // Queued, not dispatched: nothing hit mutationRequest yet.
    expect(collector.hasMethod('addMatchUpScheduleItems')).toBe(false);
    await expect(page.locator(DISCARD)).toBeVisible();

    // Save → exactly one batched mutationRequest carrying the queued method(s).
    collector.clear();
    await page.locator(SAVE).click();
    await collector.waitForMethod('addMatchUpScheduleItems', 10_000);
    expect(collector.getMutations().length).toBe(1);
    // Bar clears once saved.
    await expect(page.locator(SAVE)).toHaveCount(0, { timeout: 8_000 });

    collector.detach();
  });

  test('Discard dispatches nothing and reloads from IndexedDB (no clobber)', async ({ page }) => {
    const s = await seed(page);
    const [A, , C] = s.courtIds;
    const collector = createMutationCollector(page);

    await openGridInBulkMode(page, s.tournamentId);

    // Locally reschedule A/1 → C/1, then discard.
    await page.waitForSelector(cell(A, 1));
    await dispatchDnD(page, cell(A, 1), cell(C, 1));
    await expect(page.getByText(/unsaved action/)).toContainText('1 unsaved action', { timeout: 8_000 });

    await page.locator(DISCARD).click();

    // Nothing was ever dispatched, and the bar clears (state reloaded from IDB).
    expect(collector.hasMethod('addMatchUpScheduleItems')).toBe(false);
    await expect(page.locator(SAVE)).toHaveCount(0, { timeout: 8_000 });

    // The matchUp is back on its original court A (discard reloaded the record).
    const courtA = s.courtIds[0];
    const restoredCourtId = await page.evaluate((matchUpId) => {
      const matchUps = dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || [];
      return matchUps.find((m: any) => m.matchUpId === matchUpId)?.schedule?.courtId ?? null;
    }, s.matchUpIds[0]);
    expect(restoredCourtId).toBe(courtA);

    collector.detach();
  });
});
