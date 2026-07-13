import { peerLinkedIds, primaryVenueIds, peerOccupancyForDate, conflictsForDate, cellLabel } from './facilityScheduleHelpers';
import { describe, it, expect } from 'vitest';

const DATE = '2025-01-01';
const cell = (over: any) => ({ venueId: 'v1', courtId: 'c1', scheduledDate: DATE, labels: [], ...over });

// grid keyed venue → court → date, as produced by factory mergeFacilitySchedule
const grid = {
  venues: {
    v1: {
      venueId: 'v1',
      courts: {
        c1: {
          venueId: 'v1',
          courtId: 'c1',
          dates: {
            [DATE]: [cell({ matchUpId: 'm1', tournamentId: 'P' }), cell({ matchUpId: 'm2', tournamentId: 'B' })],
          },
        },
        c2: {
          venueId: 'v1',
          courtId: 'c2',
          dates: { [DATE]: [cell({ courtId: 'c2', matchUpId: 'm3', tournamentId: 'P' })] },
        },
      },
    },
  },
  conflicts: [
    { venueId: 'v1', courtId: 'c1', scheduledDate: DATE, reason: 'SAME_SCHEDULED_TIME', scheduledTime: '09:00', matchUpIds: ['m1', 'm2'] },
    { venueId: 'v1', courtId: 'c9', scheduledDate: '2025-01-02', reason: 'SAME_COURT_ORDER', courtOrder: 1, matchUpIds: ['x', 'y'] },
  ],
};

describe('facilityScheduleHelpers', () => {
  it('peerLinkedIds excludes self', () => {
    expect(peerLinkedIds({ tournamentId: 'P', linkedTournamentIds: ['P', 'B', 'C'] })).toEqual(['B', 'C']);
    expect(peerLinkedIds({ tournamentId: 'P' })).toEqual([]);
  });

  it('primaryVenueIds returns distinct venue ids', () => {
    expect(primaryVenueIds({ venues: [{ venueId: 'v1' }, { venueId: 'v2' }, { venueId: 'v1' }] })).toEqual(['v1', 'v2']);
    expect(primaryVenueIds({})).toEqual([]);
  });

  it('peerOccupancyForDate returns only courts a peer uses, keeping all cells for context', () => {
    const rows = peerOccupancyForDate(grid, DATE, 'P');
    // c1 has a peer (B) → included with both cells; c2 is primary-only → excluded
    expect(rows).toHaveLength(1);
    expect(rows[0].courtId).toEqual('c1');
    expect(rows[0].cells.map((entry: any) => entry.matchUpId)).toEqual(['m1', 'm2']);
  });

  it('peerOccupancyForDate excludes a date with no peer usage', () => {
    expect(peerOccupancyForDate(grid, '2099-01-01', 'P')).toEqual([]);
  });

  it('conflictsForDate filters by date', () => {
    expect(conflictsForDate(grid, DATE).map((c: any) => c.courtId)).toEqual(['c1']);
    expect(conflictsForDate(grid, '2025-01-02').map((c: any) => c.courtId)).toEqual(['c9']);
    expect(conflictsForDate(grid, '2030-01-01')).toEqual([]);
  });

  it('cellLabel composes time, round and players with fallbacks', () => {
    expect(cellLabel({ scheduledTime: '09:00', roundName: 'R16', labels: ['A', 'B'] })).toEqual('09:00 R16 A v B');
    expect(cellLabel({ labels: [] , matchUpId: 'm9' })).toEqual('m9');
  });
});
