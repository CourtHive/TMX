import { initDevBridge } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';

/**
 * Journey 144 — the offline queue's IndexedDB store, in a real browser.
 *
 * A durable message (one the client has already acted on: a local-first mutation, a preserved
 * edit's replay) that is waiting for a connection is written to IndexedDB, so a reload does not
 * lose it. The replay protocol is unit-tested in socketIo.test.ts against a fake store; this pins
 * the store itself, which node cannot run: the Dexie `outbox` table, rows keyed to their user and
 * returned oldest first, the lease two tabs race on, and that the rows outlive the page.
 *
 * A claim is a LEASE, not a delete (durable outbox, #1656): a tab owns a row for OUTBOX_LEASE_MS, the
 * row stays until a server receipt forgets it, and an expired lease can be taken by another tab.
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

  test('a claim is a lease: one tab at a time, the row stays, and an expired lease passes on', async ({ page }) => {
    const claims = await page.evaluate(
      async (r) => {
        const store = dev.outboxStore;
        const now = 1_000_000;
        await store.persistMessage(r);
        const first = await store.claimMessage(r.id, r.userId, 'tab-a', now);
        const second = await store.claimMessage(r.id, r.userId, 'tab-b', now + 1);
        const renewed = await store.claimMessage(r.id, r.userId, 'tab-a', now + 2);
        const otherUser = await store.claimMessage(r.id, 'other@x.com', 'tab-c', now + 3);
        const left = await dev.tmx2db.dex.outbox.count();
        const afterExpiry = await store.claimMessage(r.id, r.userId, 'tab-b', now + 2 + store.OUTBOX_LEASE_MS + 1);
        // tab-a's lease has passed to tab-b, so tab-a releasing it must not free tab-b's row.
        await store.releaseMessage(r.id, 'tab-a');
        const stillHeld = await store.claimMessage(r.id, r.userId, 'tab-a', now + 2 + store.OUTBOX_LEASE_MS + 2);
        const missing = await store.claimMessage('no-such-row', r.userId, 'tab-a', now);
        return { first, second, renewed, otherUser, left, afterExpiry, stillHeld, missing };
      },
      row('a', 'td@x.com', 1),
    );
    expect(claims.first, 'the first tab takes the lease').toBe('claimed');
    expect(claims.second, 'a second tab is refused while the lease runs').toBe('busy');
    expect(claims.renewed, 'the owner can renew its own lease').toBe('claimed');
    expect(claims.otherUser, "another user's tab never claims the row").toBe('busy');
    expect(claims.left, 'a lease is not an acknowledgement: the row stays').toBe(1);
    expect(claims.afterExpiry, 'an expired lease passes to another tab').toBe('claimed');
    expect(claims.stillHeld, "a stale owner's release does not free the new owner's lease").toBe('busy');
    expect(claims.missing).toBe('missing');
  });

  test('a row released as blocked is not claimed again', async ({ page }) => {
    const result = await page.evaluate(
      async (r) => {
        const store = dev.outboxStore;
        await store.persistMessage(r);
        await store.claimMessage(r.id, r.userId, 'tab-a', 1);
        await store.releaseMessage(r.id, 'tab-a', 'rejected');
        return {
          claim: await store.claimMessage(r.id, r.userId, 'tab-b', 2),
          left: await dev.tmx2db.dex.outbox.count(),
        };
      },
      row('b', 'td@x.com', 1),
    );
    expect(result).toEqual({ claim: 'blocked', left: 1 });
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
