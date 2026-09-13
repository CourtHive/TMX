import { registerScheduleMutationControl, resetScheduleMutationControl } from './scheduleMutationControl';
import { clearScheduledTime, scheduleForTime } from './matchUpTimeAction';
import { afterEach, describe, expect, it, vi } from 'vitest';

const VIEWED = '2026-09-13';

afterEach(resetScheduleMutationControl);

describe('scheduleForTime — the date is the part that gets forgotten', () => {
  it('writes the viewed date when the matchUp has none of its own', () => {
    // Without this a matchUp is scheduled for 14:30 on no day at all: invisible
    // on every date, and reachable only by clearing it.
    expect(scheduleForTime('2:30 PM', { matchUpId: 'm1', viewedDate: VIEWED })).toEqual({
      scheduledTime: '14:30',
      scheduledDate: VIEWED,
    });
  });

  it('leaves a matchUp on its own day rather than moving it to the viewed one', () => {
    const schedule = scheduleForTime('2:30 PM', {
      matchUpId: 'm1',
      scheduledDate: '2026-09-11',
      viewedDate: VIEWED,
    });
    expect(schedule).toEqual({ scheduledTime: '14:30' });
  });

  it('writes the time alone when there is no date to be had', () => {
    expect(scheduleForTime('9:00 AM', { matchUpId: 'm1' })).toEqual({ scheduledTime: '09:00' });
  });

  it('returns nothing for a time that does not convert, rather than writing an empty one', () => {
    expect(scheduleForTime('', { matchUpId: 'm1', viewedDate: VIEWED })).toBeUndefined();
  });
});

describe('dispatch routes through the registered schedule executor', () => {
  it('clears the time and its modifiers together', () => {
    const execute = vi.fn();
    registerScheduleMutationControl({ execute });

    expect(clearScheduledTime('m1')).toBe(true);
    const [methods] = execute.mock.calls[0];
    // Both together: a "not before" left standing beside a cleared time is a
    // claim about a time that no longer exists.
    expect(methods[0].params.schedule).toEqual({ scheduledTime: '', timeModifiers: [] });
    expect(methods[0].params.matchUpIds).toEqual(['m1']);
  });

  it('declines when no schedule view is mounted, rather than dispatching into nothing', () => {
    expect(clearScheduledTime('m1')).toBe(false);
  });
});
