import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('i18n', () => ({
  t: (key: string, options?: Record<string, any>) => (options ? `${key}:${JSON.stringify(options)}` : key),
}));

const { mutationRequest, tmxToast } = vi.hoisted(() => ({
  mutationRequest: vi.fn(),
  tmxToast: vi.fn(),
}));
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast }));

import { scheduleErrorMessage, setMatchUpSchedule } from './setMatchUpSchedule';

/**
 * `mutationRequest` toasts a failure only when NO callback is supplied, and this module always
 * supplies one — so before the error branch existed, every engine rejection routed through here
 * produced no UI whatsoever. That is what a tournament director reported on 2026-08-23: two end
 * times refused by the server, and a client that appeared to do nothing at all.
 *
 * These tests drive the real module and assert on the toast, so the silence cannot come back.
 */
function lastCallback(): (result: any) => void {
  const call = mutationRequest.mock.calls.at(-1);
  return call?.[0]?.callback;
}

describe('setMatchUpSchedule', () => {
  beforeEach(() => {
    mutationRequest.mockClear();
    tmxToast.mockClear();
  });

  it('surfaces an engine rejection instead of swallowing it', () => {
    const callback = vi.fn();
    setMatchUpSchedule({ matchUpId: 'm1', schedule: { endTime: '02:29' }, callback });

    lastCallback()({ error: { message: 'Invalid endTime', code: 'ERR_INVALID_END_TIME' } });

    expect(tmxToast).toHaveBeenCalledTimes(1);
    expect(tmxToast.mock.calls[0][0]).toMatchObject({
      message: 'toasts.schedule.invalidEndTime',
      intent: 'is-danger',
    });
    // the success callback must not run — the row would otherwise show a value the server refused
    expect(callback).not.toHaveBeenCalled();
  });

  it('runs the callback and stays quiet on success', () => {
    const callback = vi.fn();
    setMatchUpSchedule({ matchUpId: 'm1', schedule: { endTime: '14:29' }, callback });

    lastCallback()({ success: true });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(tmxToast).not.toHaveBeenCalled();
  });

  it('sends the mutation the server actually received in production', () => {
    setMatchUpSchedule({ matchUpId: 'm1', schedule: { endTime: '14:29' } });
    expect(mutationRequest.mock.calls[0][0].methods).toEqual([
      {
        params: { matchUpIds: ['m1'], schedule: { endTime: '14:29' }, removePriorValues: true },
        method: 'bulkScheduleMatchUps',
      },
    ]);
  });
});

describe('scheduleErrorMessage', () => {
  it('explains the codes an operator can actually hit', () => {
    expect(scheduleErrorMessage({ code: 'ERR_INVALID_END_TIME' })).toBe('toasts.schedule.invalidEndTime');
    expect(scheduleErrorMessage({ code: 'ERR_INVALID_START_TIME' })).toBe('toasts.schedule.invalidStartTime');
    expect(scheduleErrorMessage({ code: 'ERR_NOT_FOUND_COURT' })).toBe('toasts.schedule.courtNotFound');
    expect(scheduleErrorMessage({ code: 'ERR_INVALID_TIME' })).toBe('toasts.schedule.invalidTime');
  });

  it('falls through to the engine message for an unmapped code', () => {
    const message = scheduleErrorMessage({ code: 'ERR_SOMETHING_NEW', message: 'Something new' });
    expect(message).toContain('toasts.schedule.notSaved');
    expect(message).toContain('Something new');
  });

  it('handles a bare string error and a shapeless one', () => {
    expect(scheduleErrorMessage('Scores present')).toContain('Scores present');
    expect(scheduleErrorMessage(undefined)).toContain('common.error');
  });
});
