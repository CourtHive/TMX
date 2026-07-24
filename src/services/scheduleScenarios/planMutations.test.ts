import { foldMethodsIntoScenario } from 'services/scheduleScenarios/planMutations';
import { describe, expect, it } from 'vitest';

import { ADD_MATCHUP_SCHEDULE_ITEMS } from 'constants/mutationConstants';

const TID = 't1';
const place = (matchUpId: string, schedule: any) => ({
  method: ADD_MATCHUP_SCHEDULE_ITEMS,
  params: { matchUpId, schedule },
});

describe('foldMethodsIntoScenario', () => {
  it('adds a new placement from a placing drop', () => {
    const result = foldMethodsIntoScenario([], [place('m1', { scheduledTime: '10:00', courtId: 'c1' })], TID);
    expect(result).toEqual([
      { tournamentId: TID, matchUpId: 'm1', schedule: { scheduledTime: '10:00', courtId: 'c1' } },
    ]);
  });

  it('upserts (replaces) an existing placement by matchUpId', () => {
    const existing = [{ tournamentId: TID, matchUpId: 'm1', schedule: { scheduledTime: '09:00' } }];
    const result = foldMethodsIntoScenario(existing, [place('m1', { scheduledTime: '11:00', courtId: 'c2' })], TID);
    expect(result).toEqual([
      { tournamentId: TID, matchUpId: 'm1', schedule: { scheduledTime: '11:00', courtId: 'c2' } },
    ]);
  });

  it('preserves a clearing drop verbatim (unschedule within the plan)', () => {
    const existing = [{ tournamentId: TID, matchUpId: 'm1', schedule: { scheduledTime: '09:00', courtId: 'c1' } }];
    const clear = { scheduledDate: '', scheduledTime: '', courtId: '', courtOrder: '', venueId: '' };
    const result = foldMethodsIntoScenario(existing, [place('m1', clear)], TID);
    expect(result).toEqual([{ tournamentId: TID, matchUpId: 'm1', schedule: clear }]);
  });

  it('applies a multi-method swap (two placements updated)', () => {
    const result = foldMethodsIntoScenario(
      [],
      [place('m1', { courtId: 'c1', courtOrder: 2 }), place('m2', { courtId: 'c1', courtOrder: 1 })],
      TID,
    );
    expect(result.map((p) => p.matchUpId).sort()).toEqual(['m1', 'm2']);
    expect(result.find((p) => p.matchUpId === 'm1')?.schedule.courtOrder).toEqual(2);
  });

  it('ignores non-schedule methods and missing matchUpId', () => {
    const result = foldMethodsIntoScenario(
      [{ tournamentId: TID, matchUpId: 'm1', schedule: { scheduledTime: '09:00' } }],
      [
        { method: 'someOtherMethod', params: { matchUpId: 'm1', schedule: { scheduledTime: '23:00' } } },
        { method: ADD_MATCHUP_SCHEDULE_ITEMS, params: { schedule: { scheduledTime: '23:00' } } },
      ],
      TID,
    );
    expect(result).toEqual([{ tournamentId: TID, matchUpId: 'm1', schedule: { scheduledTime: '09:00' } }]);
  });

  it('defaults a missing schedule to {}', () => {
    const result = foldMethodsIntoScenario(
      [],
      [{ method: ADD_MATCHUP_SCHEDULE_ITEMS, params: { matchUpId: 'm1' } }],
      TID,
    );
    expect(result).toEqual([{ tournamentId: TID, matchUpId: 'm1', schedule: {} }]);
  });
});
