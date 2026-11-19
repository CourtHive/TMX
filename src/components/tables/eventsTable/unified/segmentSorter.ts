/**
 * Grouped sort for unified entries table.
 * Entries are sorted first by segment rank (entryStage + entryStatus),
 * then by a user-selected secondary column within each segment.
 */
import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';
import { compareEntryIndex, defaultSegmentCompare } from './entryPosition';
import { acceptedStatusSet } from 'constants/acceptedEntryStatuses';

const { MAIN, QUALIFYING } = drawDefinitionConstants;
const { ALTERNATE, UNGROUPED, WITHDRAWN } = entryStatusConstants;

export function segmentRank(entryStage: string, entryStatus: string): number {
  if (entryStage === QUALIFYING && acceptedStatusSet.has(entryStatus)) return 1;
  if (acceptedStatusSet.has(entryStatus)) return 0; // MAIN accepted
  if (entryStatus === ALTERNATE) return 2;
  if (entryStatus === UNGROUPED) return 3;
  if (entryStatus === WITHDRAWN) return 4;
  return 6; // unknown (5 is Grouped, which is assigned to virtual rows rather than derived from an entry)
}

/** Stamps each entry row with its segment rank (MAIN when the entry names no stage). */
export function withSegmentRanks<T extends Record<string, any>>(entries: T[]): (T & { _segmentRank: number })[] {
  return entries.map((entry) =>
    Object.assign(entry, { _segmentRank: segmentRank(entry.entryStage || MAIN, entry.entryStatus) }),
  );
}

export const SEGMENT_LABELS: Record<number, string> = {
  0: 'Accepted',
  1: 'Qualifying',
  2: 'Alternates',
  3: 'Ungrouped',
  4: 'Withdrawn',
  5: 'Grouped',
};

export type SortState = {
  secondaryField: string;
  secondaryDir: 'asc' | 'desc';
  /**
   * The clicked column's own sorter, when it has one. A column whose field holds an object (Name's participant, a
   * rating) or no value at all (Path's label) compares only by it: its field's value would tie every row.
   */
  secondarySorter?: (aRow: any, bRow: any) => number;
};

export function createGroupedSorter(sortState: SortState) {
  return (_a: any, _b: any, aRow: any, bRow: any) =>
    compareSegmentRows(aRow.getData(), bRow.getData(), sortState, aRow, bRow);
}

/**
 * Segment rank first; within a segment the TD's chosen column, otherwise the segment's default order
 * (alternates by entryPosition, the rest in array order). Ties keep array order.
 */
export function compareSegmentRows(dataA: any, dataB: any, sortState: SortState, rowA?: any, rowB?: any): number {
  const rankA = dataA._segmentRank ?? 6;
  const rankB = dataB._segmentRank ?? 6;
  if (rankA !== rankB) return rankA - rankB;

  if (!sortState.secondaryField) return defaultSegmentCompare(dataA, dataB);

  if (sortState.secondarySorter && rowA && rowB) {
    const cmp = sortState.secondarySorter(rowA, rowB) || 0;
    if (cmp === 0) return compareEntryIndex(dataA, dataB);
    return sortState.secondaryDir === 'desc' ? -cmp : cmp;
  }

  let valA = dataA[sortState.secondaryField];
  let valB = dataB[sortState.secondaryField];

  // Support nested fields like 'ratings.wtn'
  if (sortState.secondaryField.includes('.')) {
    const parts = sortState.secondaryField.split('.');
    valA = parts.reduce((obj: any, key: string) => obj?.[key], dataA);
    valB = parts.reduce((obj: any, key: string) => obj?.[key], dataB);
  }

  if (valA == null && valB == null) return compareEntryIndex(dataA, dataB);
  if (valA == null) return 1;
  if (valB == null) return -1;

  let cmp: number;
  if (typeof valA === 'number' && typeof valB === 'number') {
    cmp = valA - valB;
  } else {
    cmp = String(valA).localeCompare(String(valB));
  }
  if (cmp === 0) return compareEntryIndex(dataA, dataB);
  return sortState.secondaryDir === 'desc' ? -cmp : cmp;
}

export function handleHeaderClick(sortState: SortState, field: string, applySort: () => void, column?: any): void {
  if (!field || field === '_segmentRank') return;

  if (field === 'segment') {
    sortState.secondaryField = '';
    sortState.secondaryDir = 'asc';
    sortState.secondarySorter = undefined;
  } else if (sortState.secondaryField === field) {
    sortState.secondaryDir = sortState.secondaryDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.secondaryField = field;
    sortState.secondaryDir = 'asc';
    sortState.secondarySorter = columnSorter(column);
  }
  applySort();
}

/**
 * A column's own sorter function, asked in its ascending order (the grouped sort applies the direction). A named
 * sorter ('number', 'string') compares the field's value, as the grouped sort already does, so it needs none.
 */
export function columnSorter(column?: any): SortState['secondarySorter'] {
  const definition = column?.getDefinition?.();
  const sorter = definition?.sorter;
  if (typeof sorter !== 'function') return undefined;
  const field = definition.field;
  const valueOf = (row: any) => field?.split('.').reduce((obj: any, key: string) => obj?.[key], row.getData());
  return (aRow, bRow) => sorter(valueOf(aRow), valueOf(bRow), aRow, bRow, column, 'asc', definition.sorterParams ?? {});
}
