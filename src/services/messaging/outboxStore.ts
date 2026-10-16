/** IndexedDB durable commands. A lease is temporary ownership, never acknowledgement.
 * Rows survive online sends, crashes and expired leases. Only a confirmed server receipt deletes
 * an accepted command; rejected/unsupported commands remain blocked for explicit reconciliation.
 * Nonindexed lease fields need no schema/index upgrade from version 8.
 */
import { tmx2db } from 'services/storage/tmx2db';

export interface PersistedMessage {
  id: string;
  event: string;
  data: any;
  userId: string;
  queuedAt: number;
  leaseOwner?: string;
  leaseUntil?: number;
  blocked?: string;
}
const DATABASE_NOT_OPEN = 'IndexedDB is not open';
const outboxTable = () => tmx2db.dex?.outbox;
export const OUTBOX_LEASE_MS = 30_000;
export type ClaimResult = 'claimed' | 'busy' | 'missing' | 'blocked';

export async function persistMessage(message: PersistedMessage): Promise<void> {
  const table = outboxTable();
  if (!table) throw new Error(DATABASE_NOT_OPEN);
  // Never overwrite another tab's lease/rejection if an existing command is encountered.
  await tmx2db.dex.transaction('rw', table, async () => {
    if (!(await table.get(message.id))) await table.add(message);
  });
}
export async function forgetMessage(id: string): Promise<void> {
  const table = outboxTable();
  if (!table) throw new Error(DATABASE_NOT_OPEN);
  await table.delete(id);
}
export async function loadMessages(userId: string): Promise<PersistedMessage[]> {
  const table = outboxTable();
  if (!table) throw new Error(DATABASE_NOT_OPEN);
  const rows: PersistedMessage[] = await table.where('userId').equals(userId).toArray();
  return rows.sort((a, b) => a.queuedAt - b.queuedAt || a.id.localeCompare(b.id));
}
export async function claimMessage(id: string, userId: string, owner: string, now = Date.now()): Promise<ClaimResult> {
  const table = outboxTable();
  if (!table) throw new Error(DATABASE_NOT_OPEN);
  return tmx2db.dex.transaction('rw', table, async () => {
    const row: PersistedMessage | undefined = await table.get(id);
    if (!row) return 'missing';
    if (row.userId !== userId) return 'busy';
    if (row.blocked) return 'blocked';
    if ((row.leaseUntil ?? 0) > now && row.leaseOwner !== owner) return 'busy';
    await table.update(id, { leaseOwner: owner, leaseUntil: now + OUTBOX_LEASE_MS });
    return 'claimed';
  });
}
export async function releaseMessage(id: string, owner: string, blocked?: string): Promise<void> {
  const table = outboxTable();
  if (!table) throw new Error(DATABASE_NOT_OPEN);
  await tmx2db.dex.transaction('rw', table, async () => {
    const row: PersistedMessage | undefined = await table.get(id);
    if (row?.leaseOwner === owner)
      await table.update(id, { leaseOwner: undefined, leaseUntil: 0, ...(blocked && { blocked }) });
  });
}
