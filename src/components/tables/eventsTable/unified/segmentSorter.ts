/**
 * Grouped sort for unified entries table.
 * Entries are sorted first by segment rank (entryStage + entryStatus),
 * then by a user-selected secondary column within each segment.
 */
import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';

const { QUALIFYING } = drawDefinitionConstants;
const { DIRECT_ACCEPTANCE, ORGANISER_ACCEPTANCE, SPECIAL_EXEMPT, JUNIOR_EXEMPT, WILDCARD, ALTERNATE, UNGROUPED, WITHDRAWN } =
  entryStatusConstants;

const ACCEPTED_STATUSES = new Set([DIRECT_ACCEPTANCE, ORGANISER_ACCEPTANCE, SPECIAL_EXEMPT, JUNIOR_EXEMPT, WILDCARD]);

export function segmentRank(entryStage: string, entryStatus: string): number {
  if (entryStage === QUALIFYING && ACCEPTED_STATUSES.has(entryStatus)) return 1;
  if (ACCEPTED_STATUSES.has(entryStatus)) return 0; // MAIN accepted
  if (entryStatus === ALTERNATE) return 2;
  if (entryStatus === UNGROUPED) return 3;
  if (entryStatus === WITHDRAWN) return 4;
  return 5; // unknown
}

export const SEGMENT_LABELS: Record<number, string> = {
  0: 'Accepted',
  1: 'Qualifying',
  2: 'Alternates',
  3: 'Ungrouped',
  4: 'Withdrawn',
};

export type SortState = {
  secondaryField: string;
  secondaryDir: 'asc' | 'desc';
};

export function createGroupedSorter(sortState: SortState) {
  return (_a: any, _b: any, aRow: any, bRow: any) => {
    const dataA = aRow.getData();
    const dataB = bRow.getData();

    const rankA = dataA._segmentRank ?? 5;
    const rankB = dataB._segmentRank ?? 5;
    if (rankA !== rankB) return rankA - rankB;

    if (!sortState.secondaryField) return 0;

    let valA = dataA[sortState.secondaryField];
    let valB = dataB[sortState.secondaryField];

    // Support nested fields like 'ratings.wtn'
    if (sortState.secondaryField.includes('.')) {
      const parts = sortState.secondaryField.split('.');
      valA = parts.reduce((obj: any, key: string) => obj?.[key], dataA);
      valB = parts.reduce((obj: any, key: string) => obj?.[key], dataB);
    }

    if (valA == null && valB == null) return 0;
    if (valA == null) return 1;
    if (valB == null) return -1;

    let cmp: number;
    if (typeof valA === 'number' && typeof valB === 'number') {
      cmp = valA - valB;
    } else {
      cmp = String(valA).localeCompare(String(valB));
    }
    return sortState.secondaryDir === 'desc' ? -cmp : cmp;
  };
}

export function handleHeaderClick(sortState: SortState, field: string, applySort: () => void): void {
  if (!field || field === '_segmentRank') return;

  if (field === 'segment') {
    sortState.secondaryField = '';
    sortState.secondaryDir = 'asc';
  } else if (sortState.secondaryField === field) {
    sortState.secondaryDir = sortState.secondaryDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.secondaryField = field;
    sortState.secondaryDir = 'asc';
  }
  applySort();
}
