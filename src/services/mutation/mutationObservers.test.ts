import { afterEach, describe, expect, it, vi } from 'vitest';

import { onMutationApplied, notifyMutationApplied } from './mutationObservers';

describe('mutationObservers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invokes every registered observer on notify', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onMutationApplied(a);
    const offB = onMutationApplied(b);

    notifyMutationApplied();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    offA();
    offB();
  });

  it('stops invoking an observer after it unsubscribes', () => {
    const observer = vi.fn();
    const off = onMutationApplied(observer);

    notifyMutationApplied();
    off();
    notifyMutationApplied();

    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('isolates a throwing observer so the rest still run', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const thrower = vi.fn(() => {
      throw new Error('boom');
    });
    const survivor = vi.fn();
    const offThrower = onMutationApplied(thrower);
    const offSurvivor = onMutationApplied(survivor);

    expect(() => notifyMutationApplied()).not.toThrow();
    expect(survivor).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();

    offThrower();
    offSurvivor();
  });
});
