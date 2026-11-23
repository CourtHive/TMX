import { recoveryPlacements } from './recoveryPlacements';
import { describe, expect, it } from 'vitest';

const DAY = '2026-11-22';
const key = { tournamentId: 't', eventId: 'e', drawId: 'd', structureId: 's' };
const carried = (matchUpId: string) => ({ ...key, roundNumber: 1, matchUpId });
const imported = (matchUpId: string) => ({ ...key, roundNumber: 2, matchUpId, schedule: { scheduledTime: '13:00' } });

describe('recoveryPlacements', () => {
  const result = {
    placements: {
      [DAY]: {
        v1: [
          { matchUpId: 'c1', scheduleTime: '08:00' },
          { matchUpId: 't1', scheduleTime: '13:00' },
          { matchUpId: 'other', scheduleTime: '09:00' },
        ],
        v2: [{ matchUpId: 'c2', scheduleTime: '08:30' }],
      },
    },
    noTimeMatchUpIds: { [DAY]: ['c3', 't2'] },
  };
  const placements = recoveryPlacements({
    carryover: [carried('c1'), carried('c2'), carried('c3')],
    targetDay: [imported('t1'), imported('t2')],
    scheduleDate: DAY,
    result,
  });
  const byId = Object.fromEntries(placements.map((placement) => [placement.matchUpId, placement]));

  it('places each projected matchUp on the target day at its time and venue, times only', () => {
    expect(byId.c1.schedule).toEqual({
      scheduledDate: DAY,
      scheduledTime: '08:00',
      venueId: 'v1',
      courtId: '',
      courtOrder: '',
    });
    expect(byId.c2.schedule).toEqual({
      scheduledDate: DAY,
      scheduledTime: '08:30',
      venueId: 'v2',
      courtId: '',
      courtOrder: '',
    });
    expect(byId.t1.schedule).toMatchObject({ scheduledDate: DAY, scheduledTime: '13:00', venueId: 'v1' });
    expect(byId.c1.tournamentId).toEqual('t');
  });

  it('takes an unplaced carryover off the interrupted day, and leaves an unplaced target-day matchUp as it is', () => {
    expect(byId.c3.schedule).toEqual({});
    expect(byId.t2).toBeUndefined();
  });

  it('never moves a matchUp the recovery was not asked about', () => {
    expect(byId.other).toBeUndefined();
    expect(placements.map((placement) => placement.matchUpId).sort()).toEqual(['c1', 'c2', 'c3', 't1']);
  });
});
