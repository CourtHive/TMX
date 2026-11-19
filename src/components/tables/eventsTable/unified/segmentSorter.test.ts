import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';
import { createGroupedSorter, handleHeaderClick, segmentRank, SEGMENT_LABELS, type SortState } from './segmentSorter';
import { describe, expect, it } from 'vitest';

const { QUALIFYING, MAIN } = drawDefinitionConstants;
const { STRUCTURE_SELECTED_STATUSES, DIRECT_ACCEPTANCE, CONFIRMED, ALTERNATE, UNGROUPED, WITHDRAWN, REGISTERED } =
  entryStatusConstants;

describe('segmentRank', () => {
  it('ranks every STRUCTURE_SELECTED_STATUS as accepted', () => {
    for (const status of STRUCTURE_SELECTED_STATUSES) {
      expect(segmentRank(MAIN, status)).toBe(0);
      expect(segmentRank(QUALIFYING, status)).toBe(1);
    }
  });

  it('ranks CONFIRMED entries as accepted, keeping them seedable', () => {
    // regression: CONFIRMED previously fell through to rank 5 ("?"),
    // which disabled the manual seeding editor for those rows
    expect(segmentRank(MAIN, CONFIRMED)).toBe(0);
    expect(SEGMENT_LABELS[segmentRank(MAIN, CONFIRMED)]).toBe('Accepted');
  });

  it('ranks non-accepted statuses in display order', () => {
    expect(segmentRank(MAIN, ALTERNATE)).toBe(2);
    expect(segmentRank(MAIN, UNGROUPED)).toBe(3);
    expect(segmentRank(MAIN, WITHDRAWN)).toBe(4);
  });

  it('ranks unknown statuses last', () => {
    // 5 is Grouped — assigned to virtual rotating-partners rows, never derived from an entry status
    expect(segmentRank(MAIN, REGISTERED)).toBe(6);
    expect(segmentRank(MAIN, 'NOT_A_STATUS')).toBe(6);
  });

  it('does not treat non-accepted statuses as qualifying at QUALIFYING stage', () => {
    expect(segmentRank(QUALIFYING, ALTERNATE)).toBe(2);
    expect(segmentRank(QUALIFYING, DIRECT_ACCEPTANCE)).toBe(1);
  });
});

describe('the grouped sort within a segment (CA, 2026-11-19: Name and Path did not sort)', () => {
  const row = (data: any) => ({ getData: () => data });
  const named = (participantName: string, entryIndex: number) =>
    row({ _segmentRank: 0, _entryIndex: entryIndex, participant: { participantName } });
  const nameColumn = {
    getDefinition: () => ({
      field: 'participant',
      sorter: (a: any, b: any) => (a?.participantName ?? '').localeCompare(b?.participantName ?? ''),
    }),
  };

  it("sorts by the clicked column's own sorter, in both directions", () => {
    const sortState: SortState = { secondaryField: '', secondaryDir: 'asc' };
    let sorts = 0;
    handleHeaderClick(sortState, 'participant', () => (sorts += 1), nameColumn);
    const rows = [named('Cy', 0), named('Al', 1), named('Bo', 2)];
    const sorter = createGroupedSorter(sortState);
    const names = () =>
      [...rows].sort((a, b) => sorter(null, null, a, b)).map((r) => r.getData().participant.participantName);
    expect(names()).toEqual(['Al', 'Bo', 'Cy']);
    handleHeaderClick(sortState, 'participant', () => (sorts += 1), nameColumn);
    expect(names()).toEqual(['Cy', 'Bo', 'Al']);
    expect(sorts).toBe(2);
  });

  it('keeps segments first, whatever the column', () => {
    const sortState: SortState = { secondaryField: '', secondaryDir: 'asc' };
    handleHeaderClick(sortState, 'participant', () => undefined, nameColumn);
    const qualifier = row({ _segmentRank: 1, participant: { participantName: 'Aa' } });
    const accepted = named('Zz', 0);
    expect(createGroupedSorter(sortState)(null, null, accepted, qualifier)).toBeLessThan(0);
  });
});
