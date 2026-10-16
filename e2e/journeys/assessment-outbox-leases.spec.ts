import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Real Dexie/IndexedDB across independent pages. No live CFS dependency.
test('a crashed tab leaves its command recoverable after lease expiry, scoped to its user', async ({
  page,
  context,
}) => {
  const id = randomUUID();
  const origin = '/#/tournaments';
  await page.goto(origin);
  const other = await context.newPage();
  await other.goto(origin);
  const input = {
    id,
    userId: 'outbox-lease-test@courthive.test',
    event: 'executionQueue',
    queuedAt: Date.now(),
    data: { payload: { commandId: id, methods: [] } },
  };
  try {
    expect(
      await page.evaluate(async (row) => {
        const path = '/src/services/messaging/outboxStore.ts';
        const store = await import(path);
        await store.persistMessage(row);
        return store.claimMessage(row.id, row.userId, 'tab-one');
      }, input),
    ).toBe('claimed');
    expect(
      await other.evaluate(async (row) => {
        const path = '/src/services/messaging/outboxStore.ts';
        const store = await import(path);
        return store.claimMessage(row.id, row.userId, 'tab-two');
      }, input),
    ).toBe('busy');
    await page.close(); // no cleanup/release: model a tab that died in flight
    const recovered = await other.evaluate(async (row) => {
      const path = '/src/services/messaging/outboxStore.ts';
      const store = await import(path);
      const wrongUser = await store.claimMessage(row.id, 'somebody-else', 'tab-two', Date.now() + 60_000);
      const claim = await store.claimMessage(row.id, row.userId, 'tab-two', Date.now() + 60_000);
      const rows = await store.loadMessages(row.userId);
      return { wrongUser, claim, ids: rows.map((item: any) => item.id) };
    }, input);
    expect(recovered.wrongUser).toBe('busy');
    expect(recovered.claim).toBe('claimed');
    expect(recovered.ids).toContain(id); // acquiring a lease never deletes the command
  } finally {
    await other.evaluate(async (key) => {
      const path = '/src/services/messaging/outboxStore.ts';
      const store = await import(path);
      await store.forgetMessage(key);
    }, id);
    await other.close();
  }
});
