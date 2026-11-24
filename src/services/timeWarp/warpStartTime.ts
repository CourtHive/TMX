/**
 * When a Time Warp's clock starts (CA 2026-11-22).
 *
 * A warp is often a look back: a snapshot taken during a tournament that is now over. Its clock then starts at the
 * record's last change, where the snapshot left off, rather than today, a day the tournament never saw. During the
 * tournament both are useful, so the operator chooses. Before it starts, or with no change recorded, it starts now.
 *
 * Pure: the caller hands in the record, the venue's today and the moment.
 */
import { extensionConstants, tools } from 'tods-competition-factory';

export type WarpStartChoice =
  | { kind: 'start'; startAt: number; reason: 'ended' | 'notStarted' | 'noChanges' }
  | { kind: 'ask'; lastChange: number; now: number };

const STAMP_KEYS = new Set(['updatedAt', 'createdAt']);

/**
 * The newest tournament or draw factory stamp, or any nested updatedAt/createdAt.
 * With modified stamp scope a draw can carry a later write than its tournament. Ignore future stamps.
 */
export function lastChangeTime(record: unknown, now: number): number | undefined {
  let latest: number | undefined;
  const consider = (ms: number) => {
    if (Number.isFinite(ms) && ms <= now && (latest === undefined || ms > latest)) latest = ms;
  };
  const considerFactoryStamp = (element: unknown) => {
    const stamp = tools.firstClassOrExtension({ element, attribute: 'factory', name: extensionConstants.FACTORY });
    if (typeof stamp?.timeStamp === 'number') consider(stamp.timeStamp);
  };
  if (record && typeof record === 'object') {
    considerFactoryStamp(record);
    if ('events' in record && Array.isArray(record.events)) {
      for (const event of record.events) {
        if (Array.isArray(event?.drawDefinitions)) event.drawDefinitions.forEach(considerFactoryStamp);
      }
    }
  }
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (STAMP_KEYS.has(key) && typeof child === 'string') {
        consider(Date.parse(child));
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
