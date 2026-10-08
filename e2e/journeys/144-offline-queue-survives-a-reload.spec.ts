import { initDevBridge } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';

/**
 * Journey 144 — the offline queue's IndexedDB store, in a real browser.
 *
 * A durable message (one the client has already acted on: a local-first mutation, a preserved
 * edit's replay) that is waiting for a connection is written to IndexedDB, so a reload does not
 * lose it. The replay protocol is unit-tested in socketIo.test.ts against a fake store; this pins
 * the store itself, which node cannot run: the Dexie `outbox` table, rows keyed to their user and
 * returned oldest first, the claim two tabs race on, and that the rows outlive the page.
 */

const row = (id: string, userId: string, queuedAt: number) => ({
  id,
  userId,
  queuedAt,
  event: 'executionQueue',
  data: { type: 'executionQueue', payload: { methods: [{ method: id }], tournamentIds: ['t1'] } },
});

test.describe('Journey 144 — offline queue survives a reload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await initDevBridge(page);
    await page.evaluate(async () => {
      await dev.tmx2db.dex.outbox.clear();
    });
  });

  test("returns a user's rows oldest first, and no one else's", async ({ page }) => {
    const ids = await page.evaluate(
      async (rows) => {
        for (const r of rows) await dev.outboxStore.persistMessage(r);
        return (await dev.outboxStore.loadMessages('td@x.com')).map((r: any) => r.id);
      },
      [row('later', 'td@x.com', 2), row('other-user', 'other@x.com', 0), row('earlier', 'td@x.com', 1)],
    );
    expect(ids).toEqual(['earlier', 'later']);
  });

  test('a row can be claimed once: the second tab to try gets nothing', async ({ page }) => {
    const claims = await page.evaluate(
      async (r) => {
        await dev.outboxStore.persistMessage(r);
        const first = await dev.outboxStore.claimMessage(r.id);
        const second = await dev.outboxStore.claimMessage(r.id);
        return { first, second, left: await dev.tmx2db.dex.outbox.count() };
      },
      row('a', 'td@x.com', 1),
    );
    expect(claims).toEqual({ first: true, second: false, left: 0 });
  });

  test('rows outlive the page; a forgotten row does not', async ({ page }) => {
    await page.evaluate(
      async (rows) => {
        for (const r of rows) await dev.outboxStore.persistMessage(r);
        await dev.outboxStore.forgetMessage('withdrawn');
      },
      [row('kept', 'td@x.com', 1), row('withdrawn', 'td@x.com', 2)],
    );

    await page.reload();
    await initDevBridge(page);

    const after = await page.evaluate(async () => {
      const rows = await dev.outboxStore.loadMessages('td@x.com');
      return rows.map((r: any) => ({ id: r.id, method: r.data.payload.methods[0].method }));
    });
    expect(after).toEqual([{ id: 'kept', method: 'kept' }]);
  });
});
