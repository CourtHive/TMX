import { describe, expect, it, vi } from 'vitest';

// Return the key plus its interpolation values so assertions can pin both the message chosen and
// the times it names — the operator's complaint was that the rejection said nothing useful.
vi.mock('i18n', () => ({
  t: (key: string, options?: Record<string, any>) => (options ? `${key}:${JSON.stringify(options)}` : key),
}));

import { crossesMidnight, endFollowsStart, resolveTimeSeed, validateTimeValue } from './scheduleTimeFields';

/**
 * Regression cover for the production rejections of 2026-08-23 (CFS audit_log,
 * tournament 189ab4d5, two `ERR_INVALID_END_TIME` on `bulkScheduleMatchUps`).
 *
 * TMX's picker is a 12-hour clock that opens at 12:00 AM, so dialing an afternoon time without
 * touching the AM/PM toggle sends the small-hours value: `convertTime('2:29 AM', true) === '02:29'`.
 * Both rejected values were produced that way against an afternoon start time.
 *
 * The rules here must mirror factory `resolveEndTimePlacement` exactly — stricter would block the
 * after-midnight finishes the engine accepts and records via `END_DATE`; looser would hand the user
 * back the silent server rejection this work exists to remove.
 */
describe('endFollowsStart', () => {
  it('rejects the two values production actually rejected', () => {
    // 14:00 start, "2:29" dialed with AM still selected → 12h29m implied span, past the engine cap
    expect(endFollowsStart({ startTime: '14:00', endTime: '02:29' })).toBe(false);
    // 14:55 start, "4:17" dialed with AM still selected → 13h22m implied span
    expect(endFollowsStart({ startTime: '14:55', endTime: '04:17' })).toBe(false);
  });

  it('accepts what those operators meant', () => {
    expect(endFollowsStart({ startTime: '14:00', endTime: '14:29' })).toBe(true);
    expect(endFollowsStart({ startTime: '14:55', endTime: '16:17' })).toBe(true);
  });

  it('accepts a genuine after-midnight finish', () => {
    expect(endFollowsStart({ startTime: '23:00', endTime: '00:30' })).toBe(true);
    expect(endFollowsStart({ startTime: '21:15', endTime: '01:00' })).toBe(true);
  });

  it('treats the engine 12h cross-midnight cap as inclusive, and rejects one minute past it', () => {
    // Exactly 720 minutes — accepted, matching factory MAX_CROSS_MIDNIGHT_SPAN_MS.
    expect(endFollowsStart({ startTime: '14:00', endTime: '02:00' })).toBe(true);
    expect(endFollowsStart({ startTime: '14:00', endTime: '02:01' })).toBe(false);
  });

  it('rejects an end equal to its start', () => {
    expect(endFollowsStart({ startTime: '14:00', endTime: '14:00' })).toBe(false);
  });

  it('has nothing to say when either side is absent or unparseable', () => {
    expect(endFollowsStart({ startTime: undefined, endTime: '02:29' })).toBe(true);
    expect(endFollowsStart({ startTime: '14:00', endTime: undefined })).toBe(true);
    // `timeStringMinutes` answers 0 for junk, which would otherwise read as a valid midnight
    expect(endFollowsStart({ startTime: 'banana', endTime: '02:29' })).toBe(true);
    expect(endFollowsStart({ startTime: '14:00', endTime: '' })).toBe(true);
  });
});

describe('crossesMidnight', () => {
  it('is true only when the end sorts at or before the start', () => {
    expect(crossesMidnight({ startTime: '23:00', endTime: '00:30' })).toBe(true);
    expect(crossesMidnight({ startTime: '14:00', endTime: '14:00' })).toBe(true);
    expect(crossesMidnight({ startTime: '14:00', endTime: '16:17' })).toBe(false);
    expect(crossesMidnight({ startTime: undefined, endTime: '00:30' })).toBe(false);
  });
});

describe('resolveTimeSeed', () => {
  it('opens the end-time picker on the start time so AM/PM is already correct', () => {
    const seed = resolveTimeSeed({ field: 'endTime', schedule: { startTime: '14:00' } });
    expect(seed).toBe('14:00');
  });

  it('prefers an existing value for the field over any fallback', () => {
    const schedule = { startTime: '14:00', endTime: '16:17' };
    expect(resolveTimeSeed({ field: 'endTime', schedule })).toBe('16:17');
  });

  it('falls back through scheduledTime and then the court window', () => {
    expect(resolveTimeSeed({ field: 'endTime', schedule: { scheduledTime: '13:30' } })).toBe('13:30');
    expect(resolveTimeSeed({ field: 'endTime', schedule: {}, bounds: { latest: '20:00' } })).toBe('20:00');
    expect(resolveTimeSeed({ field: 'startTime', schedule: { scheduledTime: '13:30' } })).toBe('13:30');
    expect(resolveTimeSeed({ field: 'startTime', schedule: {}, bounds: { earliest: '08:00' } })).toBe('08:00');
    expect(resolveTimeSeed({ field: 'scheduledTime', schedule: {}, bounds: { earliest: '08:00' } })).toBe('08:00');
  });

  it('returns an empty seed when nothing is known', () => {
    expect(resolveTimeSeed({ field: 'endTime' })).toBe('');
  });
});

describe('validateTimeValue', () => {
  it('names both times when the end precedes the start', () => {
    const message = validateTimeValue({ field: 'endTime', value: '02:29', schedule: { startTime: '14:00' } });
    expect(message).toContain('toasts.schedule.endBeforeStart');
    expect(message).toContain('02:29');
    expect(message).toContain('14:00');
  });

  it('accepts the corrected value', () => {
    expect(validateTimeValue({ field: 'endTime', value: '14:29', schedule: { startTime: '14:00' } })).toBeUndefined();
  });

  it('accepts an after-midnight end and does not apply the court window to it', () => {
    const bounds = { earliest: '08:00', latest: '20:00' };
    const result = validateTimeValue({ field: 'endTime', value: '00:30', schedule: { startTime: '23:00' }, bounds });
    expect(result).toBeUndefined();
  });

  it('applies the court window to a same-day value', () => {
    const bounds = { earliest: '08:00', latest: '20:00' };
    expect(validateTimeValue({ field: 'scheduledTime', value: '07:30', bounds })).toContain(
      'toasts.schedule.beforeCourtOpens',
    );
    expect(validateTimeValue({ field: 'scheduledTime', value: '21:00', bounds })).toContain(
      'toasts.schedule.afterCourtCloses',
    );
    expect(validateTimeValue({ field: 'scheduledTime', value: '12:00', bounds })).toBeUndefined();
  });

  it('rejects a start time that would land after the recorded end', () => {
    const message = validateTimeValue({ field: 'startTime', value: '18:00', schedule: { endTime: '16:17' } });
    expect(message).toContain('toasts.schedule.startAfterEnd');
  });

  it('allows a start time whose end crosses midnight', () => {
    expect(validateTimeValue({ field: 'startTime', value: '23:00', schedule: { endTime: '00:30' } })).toBeUndefined();
  });

  it('has no opinion on an empty value', () => {
    expect(validateTimeValue({ field: 'endTime', value: '', schedule: { startTime: '14:00' } })).toBeUndefined();
  });
});
