import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted alongside the spies: `vi.mock` factories are lifted above module-level
// consts, so a plain `const` here would be undefined inside them.
const VIEWED_DATE = vi.hoisted(() => '2026-08-27');

const engineWork = vi.hoisted(() => ({
  allMatchUps: vi.fn(),
  venueFrame: vi.fn(),
  analyze: vi.fn(),
  // What the cache holds, reset per test; unscheduled matchUps are measured on the viewed day.
  cached: [] as any[],
  refuse: false,
}));

const UNSCHEDULED = [{ matchUpId: 'm1' }, { matchUpId: 'm2' }, { matchUpId: 'm3' }];

vi.mock('./schedule2DataCache', () => ({
  getCachedAllMatchUps: (...args: any[]) => {
    engineWork.allMatchUps(...args);
    return { matchUps: engineWork.cached };
  },
}));
// Rest is the factory's batched query: one call answers a list of requests, aligned. Each answer
// echoes its request, so a test can tell whose answer a card received.
vi.mock('services/factory/engine', () => ({
  tournamentEngine: {
    getParticipantsRest: (params: any) => {
      engineWork.analyze(params);
      if (engineWork.refuse) return { error: { message: 'refused' } };
      return { rests: params.requests.map((request: any) => ({ evaluated: true, rows: [], request })) };
    },
  },
}));
vi.mock('functions/venueTimeFrame', () => ({
  resolveVenueFrame: (...args: any[]) => {
    engineWork.venueFrame(...args);
    return { timeZone: 'UTC' };
  },
  venueCalendarDate: () => VIEWED_DATE,
  venueClock: () => '10:00',
  venueWallClockToMs: () => Date.parse(`${VIEWED_DATE}T10:00:00Z`),
}));
vi.mock('i18n', () => ({ t: (key: string) => key }));

import { evaluateRest, makeRestEvaluator } from './inspectorRest';

const requestsOf = (call: number) => engineWork.analyze.mock.calls[call][0].requests;
const idsOf = (call: number) => requestsOf(call).map((request: any) => request.matchUpId);

/**
 * `makeRestEvaluator` is documented as being worth building once per pass — it
 * reads the hydrated matchUps and resolves the venue frame, neither of which
 * varies per matchUp.
 *
 * The 30-second badge ticker honoured that. The RENDER did not: `renderRestBadge`
 * is `renderCardExtra`, called once per card, and it reached `evaluateRest`, which
 * built a whole evaluator every call. Measured on a 149-matchUp tournament that
 * was 307 `getTournament` calls and ~245ms of a ~305ms schedule render; sharing
 * one evaluator per pass took the same render to ~63ms and 11 calls.
 *
 * The factory query itself was still asked once per card, and it rebuilt its
 * whole rest index each time: 252 calls and ~390ms on a 252-card schedule. The
 * pass now asks `getParticipantsRest` once for every matchUp on the day.
 *
 * Nothing was WRONG before — the answers were identical, which is precisely why
 * it went unnoticed. So these tests are about call counts, and each one needs its
 * control: a cache that never refreshed would satisfy "called once" perfectly.
 */
describe('the rest evaluator is built once per pass', () => {
  beforeEach(() => {
    engineWork.allMatchUps.mockClear();
    engineWork.venueFrame.mockClear();
    engineWork.analyze.mockClear();
    engineWork.cached = UNSCHEDULED;
    engineWork.refuse = false;
  });

  const flushMicrotasks = () => Promise.resolve();

  it('answers every card in a synchronous pass from one factory call', () => {
    const results: any[] = ['m1', 'm2', 'm3'].map((id) => evaluateRest(id, VIEWED_DATE));

    expect(engineWork.venueFrame).toHaveBeenCalledTimes(1);
    expect(engineWork.allMatchUps).toHaveBeenCalledTimes(1);
    expect(engineWork.analyze).toHaveBeenCalledTimes(1);
    expect(idsOf(0)).toEqual(['m1', 'm2', 'm3']);
    // The pass's hydrated matchUps are handed over, so the factory never hydrates the tournament
    // again — which is the whole cost the shared pass exists to avoid.
    expect(engineWork.analyze.mock.calls[0][0].matchUps).toHaveLength(3);

    // The control. Sharing the CALL must not share the ANSWER — each card reads its own, which an
    // answer map keyed too coarsely, or read at the wrong index, would break.
    expect(results.map((result) => result.request.matchUpId)).toEqual(['m1', 'm2', 'm3']);
    expect(requestsOf(0).every((request: any) => request.scheduledDate === VIEWED_DATE)).toBe(true);
  });

  it('scales: the engine work does not grow with the number of cards', () => {
    // The shape of the defect. A test that only ever asks for three could pass while still being
    // linear, so ask about a hundred matchUps.
    engineWork.cached = Array.from({ length: 100 }, (_, i) => ({ matchUpId: `c${i}` }));
    for (let i = 0; i < 100; i++) evaluateRest(`c${i}`, VIEWED_DATE);

    expect(engineWork.allMatchUps).toHaveBeenCalledTimes(1);
    expect(engineWork.analyze).toHaveBeenCalledTimes(1);
    expect(requestsOf(0)).toHaveLength(100);
  });

  it('measures a matchUp scheduled on another day on that day, in a request of its own', () => {
    // The Inspector can show a matchUp from another day beside a catalog on the viewed one. Its rest
    // is measured on ITS day, so the viewed day's batch must not answer it.
    engineWork.cached = [...UNSCHEDULED, { matchUpId: 'other', schedule: { scheduledDate: '2026-08-26' } }];

    evaluateRest('m1', VIEWED_DATE);
    expect(idsOf(0)).toEqual(['m1', 'm2', 'm3']);

    const other: any = evaluateRest('other', VIEWED_DATE);
    expect(engineWork.analyze).toHaveBeenCalledTimes(2);
    expect(requestsOf(1)).toEqual([expect.objectContaining({ matchUpId: 'other', scheduledDate: '2026-08-26' })]);
    expect(other.request.matchUpId).toBe('other');

    // Both days are now answered; asking again re-asks neither.
    evaluateRest('m2', VIEWED_DATE);
    evaluateRest('other', VIEWED_DATE);
    expect(engineWork.analyze).toHaveBeenCalledTimes(2);
  });

  it('still asks about a matchUp the cache does not hold, and only once', () => {
    const result: any = evaluateRest('stranger', VIEWED_DATE);
    expect(idsOf(0)).toEqual(['stranger', 'm1', 'm2', 'm3']);
    expect(result.request.matchUpId).toBe('stranger');

    evaluateRest('stranger', VIEWED_DATE);
    evaluateRest('m3', VIEWED_DATE);
    expect(engineWork.analyze).toHaveBeenCalledTimes(1);
  });

  it('reads a refused call as unanswered for every card, not as a crash', () => {
    engineWork.refuse = true;
    expect(evaluateRest('m1', VIEWED_DATE)).toEqual({ evaluated: false, reason: 'unknownMatchUp' });
    expect(evaluateRest('m2', VIEWED_DATE)).toEqual({ evaluated: false, reason: 'unknownMatchUp' });
    expect(engineWork.analyze).toHaveBeenCalledTimes(1);
  });

  it('releases at the end of the task, so the next pass re-reads the engine', async () => {
    evaluateRest('m1', VIEWED_DATE);
    expect(engineWork.allMatchUps).toHaveBeenCalledTimes(1);

    await flushMicrotasks();

    // A cache that outlived its pass would freeze both the clock and the factory
    // state — the badge counts up, and a mutation between renders must be seen.
    evaluateRest('m1', VIEWED_DATE);
    expect(engineWork.allMatchUps).toHaveBeenCalledTimes(2);
    expect(engineWork.analyze).toHaveBeenCalledTimes(2);
  });

  it('leaves makeRestEvaluator itself unshared, which the ticker relies on', () => {
    // `tick()` builds its own evaluator deliberately and must keep getting a fresh
    // one — that is how every badge in a tick agrees about what time it is.
    //
    // A pass has to be OPEN for this to mean anything. Written first without the
    // `evaluateRest` line, it passed against a `makeRestEvaluator` that returned
    // the shared evaluator whenever one existed — because none ever did.
    evaluateRest('m1', VIEWED_DATE);
    expect(engineWork.allMatchUps).toHaveBeenCalledTimes(1);

    makeRestEvaluator()('m1', VIEWED_DATE);
    expect(engineWork.allMatchUps).toHaveBeenCalledTimes(2);
    expect(engineWork.analyze).toHaveBeenCalledTimes(2);
  });
});
