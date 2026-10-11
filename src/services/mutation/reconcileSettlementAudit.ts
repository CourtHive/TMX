import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { notifyMutationApplied } from 'services/mutation/mutationObservers';
import { markStaleNeedsRefresh } from 'services/messaging/remoteMutations';
import { tournamentEngine } from 'services/factory/engine';
import { tmx2db } from 'services/storage/tmx2db';

// types
import type { SettlementAuditReceipt, ServerAck } from 'types/services';

type AuditEntry = Pick<SettlementAuditReceipt, 'requestId' | 'matchUpId' | 'recordedBy' | 'recordedAt'>;
type AuditRecord = {
  tournamentId: string;
  events?: { drawDefinitions?: { drawId: string; competitionSettlements?: AuditEntry[] }[] }[];
};

/** Merge authenticated metadata into a copy; preserve every sporting field and later local edit. */
export function reconcileSettlementAuditRecord(record: AuditRecord, receipts: SettlementAuditReceipt[]) {
  const updated = structuredClone(record);
  let changed = false;
  let missing = false;
  for (const receipt of receipts) {
    if (receipt.tournamentId !== record.tournamentId) continue;
    const draw = updated.events
      ?.flatMap((event) => event.drawDefinitions ?? [])
      .find((candidate) => candidate.drawId === receipt.drawId);
    // A later local draw deletion makes an older receipt irrelevant.
    if (!draw) continue;
    const settlement = draw.competitionSettlements?.find((candidate) => candidate.requestId === receipt.requestId);
    if (!settlement || settlement.matchUpId !== receipt.matchUpId) {
      missing = true;
      continue;
    }
    if (settlement.recordedBy === receipt.recordedBy && settlement.recordedAt === receipt.recordedAt) continue;
    settlement.recordedBy = receipt.recordedBy;
    settlement.recordedAt = receipt.recordedAt;
    changed = true;
  }
  return { record: changed ? updated : record, changed, missing };
}

let pending: Promise<void> = Promise.resolve();
const unsaved = new Set<string>();

/** Every transport ack, including durable replay after reload, passes through this synchronization seam. */
export function reconcileSettlementAuditAck(ack: ServerAck): Promise<void> {
  const receipts = ack.success && Array.isArray(ack.settlementAudits) ? ack.settlementAudits : [];
  if (!receipts.length) return Promise.resolve();
  const job = pending.then(() => reconcileReceipts(receipts));
  // A failed storage operation must not prevent the next acknowledgement being reconciled.
  pending = job.catch(() => undefined);
  return job;
}

async function reconcileReceipts(receipts: SettlementAuditReceipt[]): Promise<void> {
  const tournamentIds = new Set(receipts.map((receipt) => receipt.tournamentId));
  for (const tournamentId of tournamentIds) {
    const loaded = () => tournamentEngine.getTournament({ tournamentId }).tournamentRecord as AuditRecord | undefined;
    const stored = loaded() ? undefined : await tmx2db.findTournament(tournamentId);
    // Read again after IndexedDB resolves: do not replace a tournament loaded or edited during that await.
    const liveRecord = loaded();
    const record = liveRecord ?? stored;
    if (!record) continue;
    const result = reconcileSettlementAuditRecord(record, receipts);
    if (result.missing && liveRecord) markStaleNeedsRefresh(tournamentId);
    if (!result.changed && !unsaved.has(tournamentId)) continue;
    if (liveRecord && result.changed) {
      const applied = tournamentEngine.setTournamentRecord(result.record);
      if (applied.error) throw new Error('Could not reconcile settlement audit metadata');
      notifyMutationApplied();
    }
    unsaved.add(tournamentId);
    await saveTournamentRecord({ tournamentRecord: result.record });
    unsaved.delete(tournamentId);
  }
}
