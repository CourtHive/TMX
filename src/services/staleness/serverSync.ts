/**
 * How current this tab's copy of each tournament is, in the server's own terms (P49 in
 * Mentat/planning/DESIGN_FLAWS_PUNCH_LIST.md).
 *
 * The server reports `serverUpdatedAt`: when the tournament's row was last written (`NOW()` on every
 * save, whatever made it). This module keeps, per tournament, the write this tab is known to be current
 * at, its sync point. The staleness probe compares the server's value with it. A server ahead of the
 * sync point means a write this tab never applied.
 *
 * - A full load (`/factory/fetch`) or this tab's own whole-record save (`/factory/save`) sets the sync
 *   point outright: the copy IS the server's at that write.
 * - A mutation (this tab's own ack, or another's broadcast) carries `previousServerUpdatedAt` and
 *   `serverUpdatedAt`. It moves the sync point from the one to the other only if the tab was current at
 *   the previous write. A tab that missed something stays behind, and the probe says so.
 * - Acks arrive over HTTP and broadcasts over the socket, so two steps can arrive out of order. A step
 *   that starts ahead of the sync point waits until the sync point reaches it.
 *
 * No sync point (a copy loaded offline, or a server that does not report the field yet) means the probe
 * cannot judge, and it does not guess.
 */

interface SyncPoint {
  at: number;
  /** Steps that start ahead of `at`, keyed by where they start: previous write → its write. */
  pending: Map<number, number>;
}

/** Enough for any burst of reordering; past this the oldest pending step is dropped. */
const MAX_PENDING = 50;

const syncPoints = new Map<string, SyncPoint>();

const toMs = (iso?: string): number | undefined => {
  if (typeof iso !== 'string') return undefined;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : ms;
};

/** The copy is the server's as of `serverUpdatedAt` (a full load, or this tab's whole-record save). */
export function setServerSync(tournamentId: string, serverUpdatedAt?: string): void {
  const at = toMs(serverUpdatedAt);
  if (!tournamentId) return;
  if (at === undefined) {
    syncPoints.delete(tournamentId);
  } else {
    syncPoints.set(tournamentId, { at, pending: new Map() });
  }
}

/** Set the sync point of every tournament an HTTP answer reports (`{ [tournamentId]: iso }`). */
export function setServerSyncFrom(serverUpdatedAt?: Record<string, string>): void {
  for (const [tournamentId, iso] of Object.entries(serverUpdatedAt ?? {})) setServerSync(tournamentId, iso);
}

/** A mutation this tab applied (its own, acked; or another's, broadcast) moved the server from one write to the next. */
export function advanceServerSync(
  previousServerUpdatedAt?: Record<string, string>,
  serverUpdatedAt?: Record<string, string>,
): void {
  for (const [tournamentId, iso] of Object.entries(serverUpdatedAt ?? {})) {
    const point = syncPoints.get(tournamentId);
    const to = toMs(iso);
    const from = toMs(previousServerUpdatedAt?.[tournamentId]);
    if (!point || to === undefined || from === undefined) continue;

    if (from <= point.at) {
      point.at = Math.max(point.at, to);
    } else {
      point.pending.set(from, Math.max(point.pending.get(from) ?? to, to));
      if (point.pending.size > MAX_PENDING) point.pending.delete(Math.min(...point.pending.keys()));
    }
    settlePending(point);
  }
}

function settlePending(point: SyncPoint): void {
  let moved = true;
  while (moved) {
    moved = false;
    for (const [from, to] of point.pending) {
      if (from > point.at) continue;
      point.at = Math.max(point.at, to);
      point.pending.delete(from);
      moved = true;
    }
  }
}

/**
 * Whether the server has a write this tab has not applied. `undefined` when it cannot say: no sync
 * point, or no server value.
 */
export function serverIsAhead(tournamentId: string, serverUpdatedAt?: string): boolean | undefined {
  const point = syncPoints.get(tournamentId);
  const server = toMs(serverUpdatedAt);
  if (!point || server === undefined) return undefined;
  return server > point.at;
}

/** Tests and diagnostics: the sync point, as ms. */
export function serverSyncAt(tournamentId: string): number | undefined {
  return syncPoints.get(tournamentId)?.at;
}
