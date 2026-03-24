import { describe, expect, it, vi } from 'vitest';

const mockToast = vi.fn();
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: (...args: any[]) => mockToast(...args) }));
vi.mock('i18n', () => ({ t: (k: string) => k }));

import { logMutationError } from './logMutationError';

describe('logMutationError', () => {
  it('logs error to console and shows toast by default', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockToast.mockClear();

    logMutationError('test', { error: { message: 'Something failed' } });

    expect(spy).toHaveBeenCalledWith('[test]', { message: 'Something failed' });
    expect(mockToast).toHaveBeenCalledWith({ message: 'Something failed', intent: 'is-danger' });
    spy.mockRestore();
  });

  it('uses custom message when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockToast.mockClear();

    logMutationError('test', { error: { message: 'raw' } }, { message: 'Custom message' });

    expect(mockToast).toHaveBeenCalledWith({ message: 'Custom message', intent: 'is-danger' });
    spy.mockRestore();
  });

  it('falls back to t("common.error") when no error message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockToast.mockClear();

    logMutationError('test', {});

    expect(mockToast).toHaveBeenCalledWith({ message: 'common.error', intent: 'is-danger' });
    spy.mockRestore();
  });

  it('suppresses toast when toast: false', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockToast.mockClear();

    logMutationError('test', { error: { message: 'silent' } }, { toast: false });

    expect(spy).toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
