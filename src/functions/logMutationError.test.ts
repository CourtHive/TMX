import { describe, expect, it, vi } from 'vitest';

const mockToast = vi.fn();
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: (...args: any[]) => mockToast(...args) }));
vi.mock('i18n', () => ({ t: (k: string) => k }));

import { logMutationError } from './logMutationError';

const METHOD = 'test';
const ERROR_MSG = 'Something failed';

describe('logMutationError', () => {
  it('logs error to console and shows toast by default', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockToast.mockClear();

    logMutationError(METHOD, { error: { message: ERROR_MSG } });

    expect(spy).toHaveBeenCalledWith('[test]', { message: ERROR_MSG });
    expect(mockToast).toHaveBeenCalledWith({ message: ERROR_MSG, intent: 'is-danger' });
    spy.mockRestore();
  });

  it('uses custom message when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockToast.mockClear();

    logMutationError(METHOD, { error: { message: 'raw' } }, { message: 'Custom message' });

    expect(mockToast).toHaveBeenCalledWith({ message: 'Custom message', intent: 'is-danger' });
    spy.mockRestore();
  });

  it('falls back to t("common.error") when no error message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockToast.mockClear();

    logMutationError(METHOD, {});

    expect(mockToast).toHaveBeenCalledWith({ message: 'common.error', intent: 'is-danger' });
    spy.mockRestore();
  });

  it('suppresses toast when toast: false', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockToast.mockClear();

    logMutationError(METHOD, { error: { message: 'silent' } }, { toast: false });

    expect(spy).toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
