import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createOnlineSearchController } from './onlineSearchController';

/**
 * The search box fires on every keystroke. Against an array that is free; against a service it is
 * a request per character, and — worse — a race, because the answer to "ope" can arrive after the
 * answer to "open" and overwrite it. These tests pin the coalescing and the ordering.
 */

const result = (total: number) => ({ tournaments: [], total, truncated: false }) as any;

describe('createOnlineSearchController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function harness(over: any = {}) {
    const search = vi.fn().mockResolvedValue(result(1));
    const onResults = vi.fn();
    const onLocal = vi.fn();
    const onError = vi.fn();
    const controller = createOnlineSearchController({ search, onResults, onLocal, onError, ...over });
    return { search, onResults, onLocal, onError, controller };
  }

  it('issues ONE request for a burst of keystrokes', async () => {
    const { search, controller } = harness();

    for (const q of ['o', 'op', 'ope', 'open']) controller.setQuery(q);
    await vi.advanceTimersByTimeAsync(300);

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('open');
  });

  it('does not search below the minimum length — it filters locally instead', async () => {
    const { search, onLocal, controller } = harness();

    controller.setQuery('o');
    await vi.advanceTimersByTimeAsync(300);

    expect(search).not.toHaveBeenCalled();
    expect(onLocal).toHaveBeenCalledTimes(1);
  });

  it('restores the local list when the box is cleared', async () => {
    const { search, onLocal, controller } = harness();

    controller.setQuery('open');
    await vi.advanceTimersByTimeAsync(300);
    controller.setQuery('');
    await vi.advanceTimersByTimeAsync(300);

    expect(search).toHaveBeenCalledTimes(1);
    expect(onLocal).toHaveBeenCalled();
  });

  it('discards a STALE answer that resolves after a newer one', async () => {
    const { onResults, controller } = harness({
      search: vi
        .fn()
        // "open" (first) is slow; "opens" (second) is fast and must win
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(result(111)), 500)))
        .mockResolvedValueOnce(result(222)),
    });

    controller.setQuery('open');
    await vi.advanceTimersByTimeAsync(300); // first request issued
    controller.setQuery('opens');
    await vi.advanceTimersByTimeAsync(300); // second issued and resolved
    await vi.advanceTimersByTimeAsync(500); // first finally resolves

    expect(onResults).toHaveBeenCalledTimes(1);
    expect(onResults.mock.calls[0][0].total).toBe(222);
    expect(onResults.mock.calls[0][1]).toBe('opens');
  });

  it('does not render a result that arrives after the user cleared the box', async () => {
    const { onResults, onLocal, controller } = harness({
      search: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(result(9)), 400))),
    });

    controller.setQuery('open');
    await vi.advanceTimersByTimeAsync(300);
    controller.setQuery(''); // backspaced out while the request is in flight
    await vi.advanceTimersByTimeAsync(400);

    expect(onLocal).toHaveBeenCalled();
    expect(onResults).not.toHaveBeenCalled();
  });

  it('reports a failure instead of reporting an empty result set', async () => {
    const { onError, onResults, controller } = harness({ search: vi.fn().mockRejectedValue(new Error('offline')) });

    controller.setQuery('open');
    await vi.advanceTimersByTimeAsync(300);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onResults).not.toHaveBeenCalled();
  });

  it('renders nothing once disposed — a pending answer cannot outlive the page', async () => {
    const { onResults, controller } = harness();

    controller.setQuery('open');
    controller.dispose();
    await vi.advanceTimersByTimeAsync(300);

    expect(onResults).not.toHaveBeenCalled();
  });

  it('discards an answer already IN FLIGHT when the page is disposed', async () => {
    // Distinct from the case above: there the timer had not fired, so no request existed to
    // discard. Here one is outstanding, which is what happens when the user navigates away
    // mid-search — and a result rendering into a page that is gone is the 2026-09-15 defect.
    const { onResults, controller } = harness({
      search: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(result(7)), 400))),
    });

    controller.setQuery('open');
    await vi.advanceTimersByTimeAsync(300); // request issued
    controller.dispose();
    await vi.advanceTimersByTimeAsync(400); // it resolves after disposal

    expect(onResults).not.toHaveBeenCalled();
  });

  it('trims the query it sends, so " open " is the same request as "open"', async () => {
    const { search, controller } = harness();

    controller.setQuery('  open  ');
    await vi.advanceTimersByTimeAsync(300);

    expect(search).toHaveBeenCalledWith('open');
  });
});
