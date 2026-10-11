import { cellPanelLayout, completedMatchUpTimes, isCompletedMatchUp } from './completedCellPanel';
import { factoryConstants, matchUpStatusConstants } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

const { COMPLETED, RETIRED, WALKOVER, DOUBLE_WALKOVER, TO_BE_PLAYED, IN_PROGRESS, SUSPENDED, BYE } =
  matchUpStatusConstants;

/** Every instant is written with its venue offset, so the assertions hold in any runner zone. */
const ZONE = 'America/New_York';
const CALLED_AT = '2026-10-11T14:02:00-04:00';
const SCORED_AT = '2026-10-11T15:47:30-04:00';

describe('isCompletedMatchUp — every finished status, not COMPLETED alone (CA, 2026-10-11)', () => {
  it('counts every status in the factory completedMatchUpStatuses', () => {
    for (const status of factoryConstants.completedMatchUpStatuses) expect(isCompletedMatchUp(status)).toBe(true);
    for (const status of [COMPLETED, RETIRED, WALKOVER, DOUBLE_WALKOVER]) expect(isCompletedMatchUp(status)).toBe(true);
  });

  it('does not count a matchUp still to play, live or suspended, nor a BYE', () => {
    for (const status of [TO_BE_PLAYED, IN_PROGRESS, SUSPENDED, BYE, undefined])
      expect(isCompletedMatchUp(status)).toBe(false);
  });
});

describe('completedMatchUpTimes — the times shown as facts', () => {
  it('shows the scored time when there is no endTime', () => {
    const times = completedMatchUpTimes({ calledAt: CALLED_AT, startTime: '14:10', scoredTime: SCORED_AT }, ZONE);
    expect(times).toEqual([
      { key: 'calledAt', clock: '14:02' },
      { key: 'startTime', clock: '14:10' },
      { key: 'scoredTime', clock: '15:47' },
    ]);
  });

  it('does not show the scored time once there is an endTime', () => {
    const times = completedMatchUpTimes({ startTime: '14:10', endTime: '15:40', scoredTime: SCORED_AT }, ZONE);
    expect(times).toEqual([
      { key: 'startTime', clock: '14:10' },
      { key: 'endTime', clock: '15:40' },
    ]);
  });

  it('reads calledAt and scoredTime on the venue clock, not the runner clock', () => {
    const times = completedMatchUpTimes({ calledAt: '2026-10-11T18:02:00Z', scoredTime: '2026-10-11T19:47:00Z' }, ZONE);
    expect(times).toEqual([
      { key: 'calledAt', clock: '14:02' },
      { key: 'scoredTime', clock: '15:47' },
    ]);
  });

  it('reads only the clock of a date-carrying start or end time, with no zone conversion', () => {
    const times = completedMatchUpTimes({ startTime: '2026-10-11T09:05', endTime: '2026-10-11T10:30' }, ZONE);
    expect(times).toEqual([
      { key: 'startTime', clock: '09:05' },
      { key: 'endTime', clock: '10:30' },
    ]);
  });

  it('shows nothing it does not have: no stamp means no row, never a fallback', () => {
    expect(completedMatchUpTimes(undefined, ZONE)).toEqual([]);
    expect(completedMatchUpTimes({}, ZONE)).toEqual([]);
    expect(completedMatchUpTimes({ scoredTime: 'not-an-instant' }, ZONE)).toEqual([]);
  });
});

describe('cellPanelLayout — a completed matchUp drops what no longer applies', () => {
  it('has no annotations, no Set time, no call or start, and lists its times', () => {
    const layout = cellPanelLayout(
      { matchUpStatus: WALKOVER, schedule: { calledAt: CALLED_AT, scoredTime: SCORED_AT } },
      ZONE,
    );
    expect(layout).toEqual({
      completed: true,
      showAnnotations: false,
      showSetTime: false,
      allowCallAndStart: false,
      times: [
        { key: 'calledAt', clock: '14:02' },
        { key: 'scoredTime', clock: '15:47' },
      ],
    });
  });

  it('keeps the panel unchanged for a matchUp that is not completed, and lists no times', () => {
    const layout = cellPanelLayout(
      { matchUpStatus: IN_PROGRESS, schedule: { calledAt: CALLED_AT, startTime: '14:10' } },
      ZONE,
    );
    expect(layout).toEqual({
      completed: false,
      showAnnotations: true,
      showSetTime: true,
      allowCallAndStart: true,
      times: [],
    });
  });
});
