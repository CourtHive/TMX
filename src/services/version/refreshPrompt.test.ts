import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { tmxToast } = vi.hoisted(() => ({ tmxToast: vi.fn() }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast }));

import { promptRefresh, resetRefreshPrompt } from './refreshPrompt';

describe('promptRefresh', () => {
  beforeEach(() => {
    resetRefreshPrompt();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows an actionable is-info refresh toast', () => {
    promptRefresh('Refresh please');

    expect(tmxToast).toHaveBeenCalledTimes(1);
    const arg = tmxToast.mock.calls[0][0];
    expect(arg.intent).toBe('is-info');
    expect(arg.message).toBe('Refresh please');
    expect(arg.action?.text).toBe('Refresh');
    expect(typeof arg.action?.onClick).toBe('function');
  });

  it('shows the prompt only once until reset (dedupes across both version checks)', () => {
    promptRefresh('first');
    promptRefresh('second');

    expect(tmxToast).toHaveBeenCalledTimes(1);
    expect(tmxToast.mock.calls[0][0].message).toBe('first');

    resetRefreshPrompt();
    promptRefresh('third');
    expect(tmxToast).toHaveBeenCalledTimes(2);
  });
});
