import { describe, expect, it } from 'vitest';
import { getCellStatusClass } from './getCellStatusClass';

const constants = {
  ABANDONED: 'ABANDONED',
  CANCELLED: 'CANCELLED',
  DOUBLE_WALKOVER: 'DOUBLE_WALKOVER',
  DOUBLE_DEFAULT: 'DOUBLE_DEFAULT',
  IN_PROGRESS: 'IN_PROGRESS',
  SCHEDULE_CONFLICT: 'SCHEDULE_CONFLICT',
  SCHEDULE_ISSUE: 'SCHEDULE_ISSUE',
  SCHEDULE_WARNING: 'SCHEDULE_WARNING',
  SCHEDULE_ERROR: 'SCHEDULE_ERROR',
  CONFLICT_COURT_DOUBLE_BOOKING: 'CONFLICT_COURT_DOUBLE_BOOKING',
};

const cell = (overrides: any = {}) =>
  getCellStatusClass({ statusConstants: constants, ...overrides });

describe('getCellStatusClass', () => {
  it('returns matchup-abandoned for ABANDONED', () => {
    expect(cell({ matchUpStatus: 'ABANDONED' })).toBe('matchup-abandoned');
  });

  it('returns matchup-cancelled for CANCELLED', () => {
    expect(cell({ matchUpStatus: 'CANCELLED' })).toBe('matchup-cancelled');
  });

  it('returns matchup-double-walkover-default for DOUBLE_WALKOVER', () => {
    expect(cell({ matchUpStatus: 'DOUBLE_WALKOVER' })).toBe('matchup-double-walkover-default');
  });

  it('returns matchup-double-walkover-default for DOUBLE_DEFAULT', () => {
    expect(cell({ matchUpStatus: 'DOUBLE_DEFAULT' })).toBe('matchup-double-walkover-default');
  });

  it('returns matchup-complete when winningSide is set', () => {
    expect(cell({ winningSide: 1 })).toBe('matchup-complete');
  });

  it('returns matchup-inprogress for IN_PROGRESS', () => {
    expect(cell({ matchUpStatus: 'IN_PROGRESS' })).toBe('matchup-inprogress');
  });

  it('returns matchup-conflict for SCHEDULE_CONFLICT', () => {
    expect(cell({ scheduleState: 'SCHEDULE_CONFLICT' })).toBe('matchup-conflict');
  });

  it('returns matchup-double-booking for CONFLICT_COURT_DOUBLE_BOOKING', () => {
    expect(cell({ scheduleState: 'SCHEDULE_CONFLICT', issueType: 'CONFLICT_COURT_DOUBLE_BOOKING' })).toBe('matchup-double-booking');
  });

  it('returns matchup-issue for SCHEDULE_ISSUE', () => {
    expect(cell({ scheduleState: 'SCHEDULE_ISSUE' })).toBe('matchup-issue');
  });

  it('returns matchup-warning for SCHEDULE_WARNING', () => {
    expect(cell({ scheduleState: 'SCHEDULE_WARNING' })).toBe('matchup-warning');
  });

  it('returns matchup-error for SCHEDULE_ERROR', () => {
    expect(cell({ scheduleState: 'SCHEDULE_ERROR' })).toBe('matchup-error');
  });

  it('returns undefined when no status applies', () => {
    expect(cell({})).toBeUndefined();
  });

  it('terminal status takes priority over scheduleState', () => {
    expect(cell({ matchUpStatus: 'ABANDONED', scheduleState: 'SCHEDULE_CONFLICT' })).toBe('matchup-abandoned');
  });

  it('winningSide takes priority over scheduleState', () => {
    expect(cell({ winningSide: 2, scheduleState: 'SCHEDULE_ERROR' })).toBe('matchup-complete');
  });
});
