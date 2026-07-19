/**
 * reservedCells — fetch + cache of other facility-sharing tournaments' court occupancy (a slim
 * schedule projection). No tournamentRecords are loaded; a projection cell for another tournament is
 * a reserved slot from the viewer's perspective.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchScheduleProjectionMock } = vi.hoisted(() => ({ fetchScheduleProjectionMock: vi.fn() }));

vi.mock('services/apis/servicesApi', () => ({ fetchScheduleProjection: fetchScheduleProjectionMock }));

import { loadReservedCells, getReservedCellsForDate, hasReservedCells, clearReservedCells } from './reservedCells';

const PRIMARY = 'primary';
const DATE = '2026-07-20';
const DATE_2 = '2026-07-21';
const primaryRecord = (peerIds: string[]) => ({
  tournamentId: PRIMARY,
  linkedTournamentIds: [PRIMARY, ...peerIds],
  venues: [{ venueId: 'v1' }],
});
const proj = (cells: any[]) => ({ data: { scheduleCells: cells } });

beforeEach(() => {
  fetchScheduleProjectionMock.mockReset();
  clearReservedCells();
});
afterEach(() => vi.clearAllMocks());

describe('loadReservedCells', () => {
  it('caches other-tournament cells and exposes them per date', async () => {
    fetchScheduleProjectionMock.mockResolvedValue(
      proj([
        { tournamentId: 'peer', courtId: 'c1', courtOrder: 2, scheduledDate: DATE, scheduledTime: '14:00' },
        { tournamentId: 'peer', courtId: 'c1', courtOrder: 1, scheduledDate: DATE_2 },
      ]),
    );

    const count = await loadReservedCells(primaryRecord(['peer']));

    expect(count).toBe(2);
    expect(fetchScheduleProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ tournamentIds: ['peer'], venueIds: ['v1'] }),
    );
    expect(getReservedCellsForDate(DATE, PRIMARY).map((c) => c.courtOrder)).toEqual([2]);
    expect(getReservedCellsForDate(DATE_2, PRIMARY)).toHaveLength(1);
    expect(getReservedCellsForDate('2099-01-01', PRIMARY)).toEqual([]);
    expect(hasReservedCells(PRIMARY)).toBe(true);
  });

  it('excludes the primary tournament’s own cells (only other tournaments are reserved)', async () => {
    fetchScheduleProjectionMock.mockResolvedValue(
      proj([
        { tournamentId: PRIMARY, courtId: 'c1', courtOrder: 1, scheduledDate: DATE },
        { tournamentId: 'peer', courtId: 'c1', courtOrder: 2, scheduledDate: DATE },
      ]),
    );

    const count = await loadReservedCells(primaryRecord(['peer']));

    expect(count).toBe(1);
    expect(getReservedCellsForDate(DATE, PRIMARY).map((c) => c.tournamentId)).toEqual(['peer']);
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
    fetchScheduleProjectionMock.mockResolvedValue(
      proj([{ tournamentId: 'peer', courtId: 'c1', courtOrder: 1, scheduledDate: DATE }]),
    );
    await loadReservedCells(primaryRecord(['peer']));
    expect(getReservedCellsForDate(DATE, 'other-tournament')).toEqual([]);
    expect(hasReservedCells('other-tournament')).toBe(false);
  });

  it('clearReservedCells empties the cache', async () => {
    fetchScheduleProjectionMock.mockResolvedValue(
      proj([{ tournamentId: 'peer', courtId: 'c1', courtOrder: 1, scheduledDate: DATE }]),
    );
    await loadReservedCells(primaryRecord(['peer']));
    clearReservedCells();
    expect(getReservedCellsForDate(DATE, PRIMARY)).toEqual([]);
    expect(hasReservedCells(PRIMARY)).toBe(false);
  });
});
