/**
 * Coverage for order-of-play publish state + per-date toggle logic.
 *
 * The toggle logic is the load-bearing part (the footer publish control and the
 * publishing-tab chips both drive mutations from it), so its branches are
 * exercised directly: publish, unpublish-one-of-many, unpublish-the-last, and
 * the "all dates published" materialization. `getOrderOfPlayPublishState` reads
 * the engine, which is mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PUBLISH_ORDER_OF_PLAY, UNPUBLISH_ORDER_OF_PLAY } from 'constants/mutationConstants';

const { publishStateMock } = vi.hoisted(() => ({ publishStateMock: vi.fn() }));

vi.mock('services/factory/engine', () => ({
  tournamentEngine: { q: { publishState: publishStateMock } },
}));

import {
  buildOrderOfPlayDateToggleMethods,
  getOrderOfPlayPublishState,
  isOrderOfPlayDatePublished,
  type OrderOfPlayPublishState,
} from './orderOfPlayPublish';

const D1 = '2026-07-01';
const D2 = '2026-07-02';
const D3 = '2026-07-03';
const RANGE = [D1, D2, D3];

const state = (over: Partial<OrderOfPlayPublishState> = {}): OrderOfPlayPublishState => ({
  published: false,
  allPublished: false,
  publishedDates: [],
  ...over,
});

beforeEach(() => publishStateMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe('isOrderOfPlayDatePublished', () => {
  it('is false when order of play is not published', () => {
    expect(isOrderOfPlayDatePublished(D1, state())).toBe(false);
  });

  it('is true for every date when all dates are published', () => {
    expect(isOrderOfPlayDatePublished('2026-12-31', state({ published: true, allPublished: true }))).toBe(true);
  });

  it('reflects membership of the published-dates list', () => {
    const s = state({ published: true, publishedDates: [D1] });
    expect(isOrderOfPlayDatePublished(D1, s)).toBe(true);
    expect(isOrderOfPlayDatePublished(D2, s)).toBe(false);
  });
});

describe('buildOrderOfPlayDateToggleMethods', () => {
  it('publishes an unpublished date by adding it to the list (no duplicates)', () => {
    const s = state({ published: true, publishedDates: [D2] });
    const { methods, willPublish } = buildOrderOfPlayDateToggleMethods(D1, RANGE, s);
    expect(willPublish).toBe(true);
    expect(methods).toEqual([
      { method: PUBLISH_ORDER_OF_PLAY, params: { scheduledDates: [D2, D1], removePriorValues: true } },
    ]);
  });

  it('unpublishes one of several published dates by removing it, keeping the rest', () => {
    const s = state({ published: true, publishedDates: [D1, D2] });
    const { methods, willPublish } = buildOrderOfPlayDateToggleMethods(D1, RANGE, s);
    expect(willPublish).toBe(false);
    expect(methods).toEqual([
      { method: PUBLISH_ORDER_OF_PLAY, params: { scheduledDates: [D2], removePriorValues: true } },
    ]);
  });

  it('fully unpublishes when removing the last published date', () => {
    const s = state({ published: true, publishedDates: [D1] });
    const { methods, willPublish } = buildOrderOfPlayDateToggleMethods(D1, RANGE, s);
    expect(willPublish).toBe(false);
    expect(methods).toEqual([{ method: UNPUBLISH_ORDER_OF_PLAY }]);
  });

  it('materializes the full range (minus the toggled date) when all dates are published', () => {
    const s = state({ published: true, allPublished: true });
    const { methods, willPublish } = buildOrderOfPlayDateToggleMethods(D2, RANGE, s);
    expect(willPublish).toBe(false);
    expect(methods).toEqual([
      {
        method: PUBLISH_ORDER_OF_PLAY,
        params: { scheduledDates: [D1, D3], removePriorValues: true },
      },
    ]);
  });

  it('unpublishes when the whole (single-date) range is un-toggled', () => {
    const s = state({ published: true, allPublished: true });
    const { methods } = buildOrderOfPlayDateToggleMethods(D1, [D1], s);
    expect(methods).toEqual([{ method: UNPUBLISH_ORDER_OF_PLAY }]);
  });
});

describe('getOrderOfPlayPublishState', () => {
  it('parses a published-with-dates order of play', () => {
    publishStateMock.mockReturnValue({ tournament: { orderOfPlay: { published: true, scheduledDates: [D1, D2] } } });
    expect(getOrderOfPlayPublishState()).toEqual({ published: true, allPublished: false, publishedDates: [D1, D2] });
  });

  it('treats published with no scheduledDates as all-published', () => {
    publishStateMock.mockReturnValue({ tournament: { orderOfPlay: { published: true } } });
    expect(getOrderOfPlayPublishState()).toEqual({ published: true, allPublished: true, publishedDates: [] });
  });

  it('returns an unpublished state when nothing is published', () => {
    publishStateMock.mockReturnValue({});
    expect(getOrderOfPlayPublishState()).toEqual({ published: false, allPublished: false, publishedDates: [] });
  });

  it('tolerates a missing publishState result', () => {
    publishStateMock.mockReturnValue(undefined);
    expect(getOrderOfPlayPublishState().published).toBe(false);
  });
});
