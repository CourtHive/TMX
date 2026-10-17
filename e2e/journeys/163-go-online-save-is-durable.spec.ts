import { initDevBridge, loginAsSuperAdmin, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page, type Request } from '@playwright/test';

/**
 * Journey 163 — going online is a durable, conditional save (C3).
 *
 * "Go online" sends the offline copy with `POST /factory/save` and, once the server has it, deletes
 * the copy from IndexedDB. Since C3 the save carries a `commandId` and the write the tournament went
 * offline at (`expectedServerUpdatedAt`). This pins, in a real browser and with `/factory/save`
 * mocked (no CFS needed):
 *
 * - a first send that gets no answer is resent under the SAME commandId with the same precondition,
 *   and the server's deduplicated answer counts as the save: the copy is deleted;
 * - a 409 (the server was written since) deletes nothing: the copy stays in IndexedDB, the director
 *   is told, and offered the server's copy.
 *
 * The protocol itself (retries, classification, per-flow preconditions) is unit-tested in
 * src/services/apis/durableSave.test.ts. This proves the wiring: the button, the transport and the
 * IndexedDB delete that a lost answer used to put at risk.
 *
 * The offline sync point is planted in localStorage, which is where going offline records it; the
 * go-offline step itself needs a server-first mutation and is out of scope here.
 */

const PROVIDER_ID = 'e2e-provider-1';
const WENT_OFFLINE_AT = '2026-10-17T10:00:00.000Z';
const SERVER_WROTE_AT = '2026-10-17T10:05:00.000Z';
const GO_ONLINE = 'button.dash-action-btn:has-text("Go online")';

/** An offline, provider-owned tournament: in IndexedDB, with the write it went offline at remembered. */
async function seedOfflineTournament(page: Page): Promise<string> {
  const tournamentId = await page.evaluate(
    async ({ providerId, wentOfflineAt }) => {
      await dev.tmx2db.initDB();
      const engine = dev.factory.tournamentEngine;
      dev.factory.mocksEngine.generateTournamentRecord({ nonRandom: 1, setState: true, tournamentName: 'C3 Offline' });
      engine.addTournamentTimeItem({ timeItem: { itemType: 'TMX', itemValue: { offline: { email: 'td@e2e' } } } });
      const record = engine.getTournament().tournamentRecord;
      record.parentOrganisation = { organisationId: providerId, organisationName: 'E2E Provider' };
      await dev.tmx2db.addTournament(record);
      localStorage.setItem(`tmxOfflineSync:${record.tournamentId}`, wentOfflineAt);
      await dev.load(record);
      return record.tournamentId as string;
    },
    { providerId: PROVIDER_ID, wentOfflineAt: WENT_OFFLINE_AT },
  );
  return tournamentId;
}

const storedLocally = (page: Page, tournamentId: string) =>
  page.evaluate(async (id) => !!(await dev.tmx2db.findTournament(id)), tournamentId);

test.describe('Journey 163 — go online is durable and conditional', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
    await loginAsSuperAdmin(page);
  });

  test('a lost answer is resent under the same commandId; the deduplicated answer deletes the copy', async ({
    page,
  }) => {
    const saves: Request[] = [];
    await page.route('**/factory/save', async (route) => {
      saves.push(route.request());
      if (saves.length === 1) return route.abort('failed');
      const { tournamentRecord, commandId } = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          deduplicated: true,
          durableReceipt: true,
          commandId,
          serverUpdatedAt: { [tournamentRecord.tournamentId]: SERVER_WROTE_AT },
        }),
      });
    });

    const tournamentId = await seedOfflineTournament(page);
    expect(await storedLocally(page, tournamentId)).toBe(true);

    await page.locator(GO_ONLINE).click();
    await expect.poll(() => saves.length, { timeout: 15_000 }).toBe(2);

    const [first, second] = saves.map((request) => request.postDataJSON());
    expect(first.commandId).toBeTruthy();
    expect(second.commandId).toBe(first.commandId);
    expect(first.expectedServerUpdatedAt).toEqual({ [tournamentId]: WENT_OFFLINE_AT });
    expect(second).toEqual(first);

    await expect.poll(() => storedLocally(page, tournamentId), { timeout: 10_000 }).toBe(false);
    expect(await page.evaluate((id) => localStorage.getItem(`tmxOfflineSync:${id}`), tournamentId)).toBeNull();
  });

  test('a 409 keeps the local copy and tells the director, offering the server copy', async ({ page }) => {
    const saves: Request[] = [];
    await page.route('**/factory/save', async (route) => {
      saves.push(route.request());
      const { tournamentRecord, expectedServerUpdatedAt } = route.request().postDataJSON();
      const tournamentId = tournamentRecord.tournamentId;
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Tournament changed since it was read',
          conflict: true,
          tournamentId,
          expectedServerUpdatedAt: expectedServerUpdatedAt?.[tournamentId] ?? null,
          serverUpdatedAt: SERVER_WROTE_AT,
        }),
      });
    });

    // Any mutation sent to the server after the refused save would be written over the newer record.
    const mutations: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/factory')) {
        mutations.push(request.postData() ?? '');
      }
    });

    const tournamentId = await seedOfflineTournament(page);
    await page.locator(GO_ONLINE).click();

    const notice = page.locator('.notification.is-warning').filter({ hasText: 'newer version' });
    await expect(notice).toBeVisible({ timeout: 10_000 });
    await expect(notice.getByRole('button', { name: 'Load server copy' })).toBeVisible();

    expect(saves).toHaveLength(1); // a conflict is an answer: never resent
    expect(await storedLocally(page, tournamentId)).toBe(true);
    // Back offline in this tab only: the flag is restored locally, and nothing reached the server.
    const offline = await page.evaluate(
      () => dev.factory.tournamentEngine.q.tournamentTimeItem({ itemType: 'TMX' })?.itemValue?.offline,
    );
    expect(offline, 'the tournament is offline again locally').toBeTruthy();
    expect(mutations, 'no mutation is sent to the server after the refused save').toEqual([]);
    // Still remembered: the next attempt is conditional on the same write.
    expect(await page.evaluate((id) => localStorage.getItem(`tmxOfflineSync:${id}`), tournamentId)).toBe(
      WENT_OFFLINE_AT,
    );
  });
});
