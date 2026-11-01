/**
 * The entries table's "#" column and its within-segment order.
 *
 * The column shows each entry's `entryPosition` exactly as the record holds it: the factory owns the
 * numbering (one list per stage for the accepted statuses, one per status otherwise), so nothing here
 * renumbers. Alternates sort by position by default because that order decides who is promoted next;
 * every other segment keeps the entries' array order unless the TD picks a column.
 */

import { entryStatusConstants } from 'tods-competition-factory';
import { t } from 'i18n';

export const ALTERNATES_RANK = 2;
export const ENTRY_POSITION_FIELD = 'entryPosition';

const isPosition = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** The text the "#" cell shows: the entry's position, or blank when it has none (virtual rows never do). */
export function entryPositionLabel(row: any): string {
  if (!row || row._isSeparator || row._grouped || row._eventOnly) return '';
  return isPosition(row.entryPosition) ? String(row.entryPosition) : '';
}

/** True when any real entry carries a position; otherwise the "#" column falls back to the row number. */
export function hasEntryPositions(rows: any[]): boolean {
  return rows.some((row) => entryPositionLabel(row) !== '');
}

/** Stamps each row with its index in the entries array, the tiebreak that keeps unpositioned rows in order. */
export function withEntryIndex<T extends Record<string, any>>(rows: T[]): (T & { _entryIndex: number })[] {
  return rows.map((row, index) => Object.assign(row, { _entryIndex: index }));
}

export const compareEntryIndex = (a: any, b: any): number =>
  (a?._entryIndex ?? Number.MAX_SAFE_INTEGER) - (b?._entryIndex ?? Number.MAX_SAFE_INTEGER);

/** Ascending by position, entries without one after, each group in array order. */
export function compareEntryPosition(a: any, b: any): number {
  const posA = isPosition(a?.entryPosition) ? a.entryPosition : undefined;
  const posB = isPosition(b?.entryPosition) ? b.entryPosition : undefined;
  if (posA !== undefined && posB !== undefined && posA !== posB) return posA - posB;
  if (posA !== undefined && posB === undefined) return -1;
  if (posA === undefined && posB !== undefined) return 1;
  return compareEntryIndex(a, b);
}

/** Order within one segment when the TD has not picked a sort column. */
export function defaultSegmentCompare(a: any, b: any): number {
  if (a?._segmentRank === ALTERNATES_RANK && b?._segmentRank === ALTERNATES_RANK) return compareEntryPosition(a, b);
  return compareEntryIndex(a, b);
}

const ACCEPTED_RANKS = new Set([0, 1]); // Accepted (MAIN) and Qualifying: the stages' accepted lists

/**
 * Each accepted entry's place within its own status (WILDCARD #1, #2, ...), derived from the stage's one
 * accepted list: filter by stage and status, order by entryPosition, number 1..n. A factory helper that
 * derives the same ordinals is coming; once it is published it replaces this, so the rule lives in one place.
 */
export function withStatusOrdinals<T extends Record<string, any>>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    if (!ACCEPTED_RANKS.has(row._segmentRank) || row._grouped || row._eventOnly) continue;
    const key = `${row._segmentRank}|${row.entryStatus}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(row);
  }
  for (const group of groups.values()) {
    group.sort(compareEntryPosition).forEach((row, index) => Object.assign(row, { _statusOrdinal: index + 1 }));
  }
  return rows;
}

const { WILDCARD, SPECIAL_EXEMPT, JUNIOR_EXEMPT, ORGANISER_ACCEPTANCE, UNGROUPED } = entryStatusConstants;

/**
 * The "#" badge's tint names the entry's group, so "#5 accepted" and "#5 alternate" read apart in the one
 * table. The tint never stands alone: the badge's tooltip and accessible label say the group in words.
 */
export type EntryPositionGroup = 'accepted' | 'qualifying' | 'alternate' | 'withdrawn' | 'other';

// keyed by _segmentRank (segmentSorter.segmentRank); Ungrouped and unknown statuses are 'other'
const GROUP_BY_RANK: Record<number, EntryPositionGroup> = {
  0: 'accepted',
  1: 'qualifying',
  [ALTERNATES_RANK]: 'alternate',
  4: 'withdrawn',
};

export function entryPositionGroup(row: any): EntryPositionGroup {
  return GROUP_BY_RANK[row?._segmentRank] ?? 'other';
}

const GROUP_LABEL_KEYS: Record<EntryPositionGroup, string> = {
  accepted: 'entries.positionBadge.accepted',
  qualifying: 'entries.positionBadge.qualifying',
  alternate: 'entries.positionBadge.alternate',
  withdrawn: 'entries.positionBadge.withdrawn',
  other: 'entries.positionBadge.other',
};

// The special acceptance statuses that carry a status chip ("WC 2"); their ordinal joins the tooltip.
const STATUS_NAME_KEYS: Record<string, string> = {
  [WILDCARD]: 'entries.positionBadge.status.wildcard',
  [SPECIAL_EXEMPT]: 'entries.positionBadge.status.specialExempt',
  [JUNIOR_EXEMPT]: 'entries.positionBadge.status.juniorExempt',
  [ORGANISER_ACCEPTANCE]: 'entries.positionBadge.status.organiserAcceptance',
};

/** Everything the "#" badge shows: the number, the group its tint names, and the same in words. */
export interface EntryPositionBadge {
  group: EntryPositionGroup;
  /** The group position only; the status chip keeps the status ordinal, so no number shows twice. */
  text: string;
  /** e.g. "Alternate #3" or "Accepted #12 · Wildcard 2"; also the accessible label. */
  tooltip: string;
}

/** The badge for one row, or null when the row has no position to show (virtual rows never do). */
export function entryPositionBadge(row: any): EntryPositionBadge | null {
  const text = entryPositionLabel(row);
  if (!text) return null;
  const group = entryPositionGroup(row);
  const labelKey =
    group === 'other' && row.entryStatus === UNGROUPED ? 'entries.positionBadge.ungrouped' : GROUP_LABEL_KEYS[group];
  const label = t(labelKey, { position: text });
  const statusKey = STATUS_NAME_KEYS[row.entryStatus];
  const tooltip =
    statusKey && row._statusOrdinal
      ? t('entries.positionBadge.withStatus', { label, status: t(statusKey), ordinal: row._statusOrdinal })
      : label;
  return { group, text, tooltip };
}
