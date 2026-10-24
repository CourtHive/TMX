import { initDevBridge, loginAsSuperAdmin, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';

/**
 * Journey 179 — a tournament held offline keeps its edits, through a reload and a logout.
 *
 * "Go offline" marks a provider-owned tournament with the director's email, and from then on its copy in
 * IndexedDB is the only copy of the director's work. Two defects lost that work:
 *
 * 1. Every offline edit is saved through `saveTournamentRecord`, which skipped provider-owned records
 *    unless "Save local copies" was on. So with the default setting, offline edits lived in memory
 *    alone and a reload discarded them.
 * 2. Logout (and login) wiped every provider-owned record from IndexedDB, including one held offline.
 *
 * Both are pinned here with no CFS: the offline marker makes every mutation `local-only`. The go-offline
 * step itself is a server-first mutation and out of scope, as in journey 163; the marker is planted.
 * Who may SEE a kept record (only its holder) is unit-tested in `src/services/storage/offlineCustody.test.ts`
 * and `localCalendar.test.ts`.
 */

const HOLDER = 'td@e2e';
const AVATAR = '#login';
const EDITED_NAME = 'Edited While Offline';

/** A held-offline tournament (loaded), plus an ordinary provider-owned cache copy as the wipe's control. */
async function seedHeldOffline(page: Page): Promise<{ tournamentId: string; cacheCopyId: string }> {
  return page.evaluate(async (email) => {
    await dev.tmx2db.initDB();
    const engine = dev.factory.tournamentEngine;
    dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentAttributes: { tournamentId: 'e2e-179-cache-copy' },
      tournamentName: 'Cache Copy',
    });
    const cacheCopy = engine.getTournament().tournamentRecord;
    cacheCopy.parentOrganisation = { organisationId: 'e2e-provider-1', organisationName: 'E2E Provider' };
    await dev.tmx2db.addTournament(cacheCopy);

    dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentAttributes: { tournamentId: 'e2e-179-held-offline' },
      tournamentName: 'Held Offline',
    });
    engine.addTournamentTimeItem({ timeItem: { itemType: 'TMX', itemValue: { offline: { email } } } });
    const record = engine.getTournament().tournamentRecord;
    record.parentOrganisation = { organisationId: 'e2e-provider-1', organisationName: 'E2E Provider' };
    await dev.tmx2db.addTournament(record);
    await dev.load(record);
    return { tournamentId: record.tournamentId as string, cacheCopyId: cacheCopy.tournamentId as string };
  }, HOLDER);
}

const storedName = (page: Page, tournamentId: string) =>
  page.evaluate(async (id) => (await dev.tmx2db.findTournament(id))?.tournamentName, tournamentId);

test.describe('Journey 179 — offline work is kept', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
    // Signed in as the holder, and booted that way, so the avatar menu (and its Log out) is live.
    await loginAsSuperAdmin(page, { email: HOLDER });
    await page.reload();
    await waitForAppReady(page);
    await initDevBridge(page);
  });

  test('an offline edit is saved to IndexedDB with "Save local copies" off, and survives logout', async ({ page }) => {
    // "Save local copies" is off: localStorage was cleared, and it is not a default.
    const { tournamentId, cacheCopyId } = await seedHeldOffline(page);
    expect(cacheCopyId).not.toBe(tournamentId);

    await page.evaluate(
      (tournamentName) =>
        new Promise<void>((resolve) =>
          dev.mutationRequest({
            methods: [{ method: 'setTournamentName', params: { tournamentName } }],
            callback: () => resolve(),
          }),
        ),
      EDITED_NAME,
    );
    // Defect 1: before the fix the edit never reached IndexedDB.
    await expect.poll(() => storedName(page, tournamentId)).toBe(EDITED_NAME);

    // Defect 2: logout wipes provider-owned cache copies; a record held offline must survive it.
    await page.locator(AVATAR).click();
    await page.getByText('Log out', { exact: true }).click();
    // The control: the wipe ran (the cache copy is gone), so what survived it survived on purpose.
    await expect.poll(() => storedName(page, cacheCopyId)).toBeUndefined();
    expect(await storedName(page, tournamentId)).toBe(EDITED_NAME);
  });
});
