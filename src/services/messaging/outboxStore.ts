/**
 * IndexedDB backing for the offline outbox in socketIo.ts, so a durable message
 * survives a reload.
 *
 * Durable means the client has already acted on the message: a local-first
 * mutation that is applied locally before it is sent, or the replay of an edit
 * preserved across a lost session. Losing one of those after a reload loses the
 * edit. Everything else in the outbox (chat sends, server-first mutations, which
 * withdraw themselves after `serverTimeout`) stays in memory only.
 *
 * Rows are keyed to the user who wrote them and replayed only for that user.
 * A row is claimed (deleted in a transaction) before it is sent, so two tabs of
 * the same user cannot both send it.
 */
import { tmx2db } from 'services/storage/tmx2db';

export interface PersistedMessage {
  id: string;
  event: string;
  data: any;
  userId: string;
  queuedAt: number;
}

const outboxTable = () => tmx2db.dex?.outbox;

export async function persistMessage(message: PersistedMessage): Promise<void> {
  const table = outboxTable();
  if (!table) throw new Error('IndexedDB is not open');
  await table.put(message);
}

export async function forgetMessage(id: string): Promise<void> {
  await outboxTable()?.delete(id);
}

/** The user's persisted messages, oldest first. */
export async function loadMessages(userId: string): Promise<PersistedMessage[]> {
  const table = outboxTable();
  if (!table) return [];
  const rows: PersistedMessage[] = await table.where('userId').equals(userId).toArray();
  return rows.sort((a, b) => a.queuedAt - b.queuedAt);
}

/** Take a row before sending it. False when it is already gone: another tab sent it. */
export async function claimMessage(id: string): Promise<boolean> {
  const table = outboxTable();
  if (!table) return false;
  const removed: number = await tmx2db.dex.transaction('rw', table, () => table.where('id').equals(id).delete());
  return removed > 0;
}
