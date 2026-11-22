/**
 * When a Time Warp's clock starts (CA 2026-11-22).
 *
 * A warp is often a look back: a snapshot taken during a tournament that is now over. Its clock then starts at the
 * record's last change, where the snapshot left off, rather than today, a day the tournament never saw. During the
 * tournament both are useful, so the operator chooses. Before it starts, or with no change recorded, it starts now.
 *
 * Pure: the caller hands in the record, the venue's today and the moment.
 */

export type WarpStartChoice =
  | { kind: 'start'; startAt: number; reason: 'ended' | 'notStarted' | 'noChanges' }
  | { kind: 'ask'; lastChange: number; now: number };

const STAMP_KEYS = new Set(['updatedAt', 'createdAt']);

/**
 * The latest change the record carries: its newest `updatedAt` or `createdAt`, wherever it sits (the factory stamps
 * matchUps, draws, structures, time items and extensions as it writes them). A stamp after `now` is a clock's error
 * and is not believed. `undefined` when the record carries none.
 */
export function lastChangeTime(record: unknown, now: number): number | undefined {
  let latest: number | undefined;
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (STAMP_KEYS.has(key) && typeof child === 'string') {
        const ms = Date.parse(child);
        if (Number.isFinite(ms) && ms <= now && (latest === undefined || ms > latest)) latest = ms;
      } else if (child && typeof child === 'object') {
        visit(child);
      }
    }
  };
  visit(record);
  return latest;
}

export function warpStartChoice({
  record,
  today,
  now,
}: {
  record: { startDate?: string; endDate?: string } | undefined;
  /** the venue's calendar day, `YYYY-MM-DD` */
  today: string;
  now: number;
}): WarpStartChoice {
  const lastChange = lastChangeTime(record, now);
  if (lastChange === undefined) return { kind: 'start', startAt: now, reason: 'noChanges' };
  const startDate = record?.startDate?.slice(0, 10);
  const endDate = record?.endDate?.slice(0, 10);
  if (endDate && today > endDate) return { kind: 'start', startAt: lastChange, reason: 'ended' };
  if (startDate && today < startDate) return { kind: 'start', startAt: now, reason: 'notStarted' };
  return { kind: 'ask', lastChange, now };
}
