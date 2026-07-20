/**
 * reservedCells — coordination-view fetch + cache of other facility-sharing tournaments' court
 * occupancy. The request sends the loaded (authored) tournament as the context; the server returns
 * its linked peers' projections tagged access:'author'|'view'. Only `view` peers are reserved slots
 * (a different director/provider); `author` peers render normally. No tournamentRecords are loaded.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchScheduleProjectionMock } = vi.hoisted(() => ({ fetchScheduleProjectionMock: vi.fn() }));

vi.mock('services/apis/servicesApi', () => ({ fetchScheduleProjection: fetchScheduleProjectionMock }));

import {
  loadReservedCells,
  reloadReservedCells,
  getReservedCellsForDate,
  hasReservedCells,
  clearReservedCells,
} from './reservedCells';

const PRIMARY = 'primary';
const DATE = '2026-07-20';
const DATE_2 = '2026-07-21';
const primaryRecord = (peerIds: string[]) => ({
  tournamentId: PRIMARY,
  linkedTournamentIds: [PRIMARY, ...peerIds],
  venues: [{ venueId: 'v1' }],
});
const viewCell = (over: any) => ({ tournamentId: 'peer', access: 'view', courtId: 'c1', ...over });
const proj = (cells: any[]) => ({ data: { scheduleCells: cells } });

beforeEach(() => {
  fetchScheduleProjectionMock.mockReset();
  clearReservedCells();
});
afterEach(() => vi.clearAllMocks());

describe('loadReservedCells', () => {
  it('requests the coordination view for the context tournament and caches view cells per date', async () => {
    fetchScheduleProjectionMock.mockResolvedValue(
      proj([
        viewCell({ courtOrder: 2, scheduledDate: DATE, scheduledTime: '14:00' }),
        viewCell({ courtOrder: 1, scheduledDate: DATE_2 }),
      ]),
    );

    const count = await loadReservedCells(primaryRecord(['peer']));

    expect(count).toBe(2);
    expect(fetchScheduleProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ tournamentId: PRIMARY, venueIds: ['v1'] }),
    );
    expect(getReservedCellsForDate(DATE, PRIMARY).map((c) => c.courtOrder)).toEqual([2]);
    expect(getReservedCellsForDate(DATE_2, PRIMARY)).toHaveLength(1);
    expect(getReservedCellsForDate('2099-01-01', PRIMARY)).toEqual([]);
    expect(hasReservedCells(PRIMARY)).toBe(true);
  });

  it('keeps only view-access cells — author peers render normally, not as reserved', async () => {
    fetchScheduleProjectionMock.mockResolvedValue(
      proj([
        { tournamentId: 'own-linked', access: 'author', courtId: 'c1', courtOrder: 1, scheduledDate: DATE },
        viewCell({ courtOrder: 2, scheduledDate: DATE }),
      ]),
    );

    const count = await loadReservedCells(primaryRecord(['peer', 'own-linked']));

    expect(count).toBe(1);
    expect(getReservedCellsForDate(DATE, PRIMARY).map((c) => c.access)).toEqual(['view']);
  });

  it('does not fetch and caches an empty set when there are no linked peers', async () => {
    const count = await loadReservedCells(primaryRecord([]));
    expect(count).toBe(0);
    expect(fetchScheduleProjectionMock).not.toHaveBeenCalled();
    expect(getReservedCellsForDate(DATE, PRIMARY)).toEqual([]);
  });

  it('degrades to an empty cache on a failed projection', async () => {
    fetchScheduleProjectionMock.mockRejectedValue(new Error('403'));
    const count = await loadReservedCells(primaryRecord(['peer']));
    expect(count).toBe(0);
    expect(getReservedCellsForDate(DATE, PRIMARY)).toEqual([]);
  });
});

describe('getReservedCellsForDate / clearReservedCells', () => {
  it('returns nothing for a different tournament than the one cached', async () => {
    fetchScheduleProjectionMock.mockResolvedValue(proj([viewCell({ courtOrder: 1, scheduledDate: DATE })]));
    await loadReservedCells(primaryRecord(['peer']));
    expect(getReservedCellsForDate(DATE, 'other-tournament')).toEqual([]);
    expect(hasReservedCells('other-tournament')).toBe(false);
  });

  it('clearReservedCells empties the cache', async () => {
    fetchScheduleProjectionMock.mockResolvedValue(proj([viewCell({ courtOrder: 1, scheduledDate: DATE })]));
    await loadReservedCells(primaryRecord(['peer']));
    clearReservedCells();
    expect(getReservedCellsForDate(DATE, PRIMARY)).toEqual([]);
    expect(hasReservedCells(PRIMARY)).toBe(false);
  });
});

describe('reloadReservedCells (live-refresh change detection)', () => {
  it('reports no change when the projection is identical', async () => {
    fetchScheduleProjectionMock.mockResolvedValue(proj([viewCell({ courtOrder: 1, scheduledDate: DATE })]));
    await loadReservedCells(primaryRecord(['peer']));
    expect(await reloadReservedCells(primaryRecord(['peer']))).toBe(false);
  });

  it('reports a change when a peer reschedules (cells differ)', async () => {
    fetchScheduleProjectionMock.mockResolvedValueOnce(proj([viewCell({ courtOrder: 1, scheduledDate: DATE })]));
    await loadReservedCells(primaryRecord(['peer']));
    fetchScheduleProjectionMock.mockResolvedValueOnce(proj([viewCell({ courtOrder: 3, scheduledDate: DATE })]));
    expect(await reloadReservedCells(primaryRecord(['peer']))).toBe(true);
    expect(getReservedCellsForDate(DATE, PRIMARY).map((c) => c.courtOrder)).toEqual([3]);
  });
});
