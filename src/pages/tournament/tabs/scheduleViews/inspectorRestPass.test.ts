import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted alongside the spies: `vi.mock` factories are lifted above module-level
// consts, so a plain `const` here would be undefined inside them.
const VIEWED_DATE = vi.hoisted(() => '2026-08-27');

const engineWork = vi.hoisted(() => ({
  allMatchUps: vi.fn(),
  timingResolver: vi.fn(),
  dailyLimits: vi.fn(),
  venueFrame: vi.fn(),
  analyze: vi.fn(),
}));

vi.mock('./schedule2DataCache', () => ({
  getCachedAllMatchUps: (...args: any[]) => {
    engineWork.allMatchUps(...args);
    return { matchUps: [{ matchUpId: 'm1' }, { matchUpId: 'm2' }, { matchUpId: 'm3' }] };
  },
}));
vi.mock('./scheduleTimingResolver', () => ({
  makeTimingResolver: (...args: any[]) => {
    engineWork.timingResolver(...args);
    return () => undefined;
  },
}));
vi.mock('services/factory/engine', () => ({
  competitionEngine: {
    getMatchUpDailyLimits: (...args: any[]) => {
      engineWork.dailyLimits(...args);
      return { matchUpDailyLimits: { total: 3 } };
    },
  },
}));
vi.mock('functions/venueTimeFrame', () => ({
  resolveVenueFrame: (...args: any[]) => {
    engineWork.venueFrame(...args);
    return { timeZone: 'UTC' };
  },
  venueDayMinutes: () => 600,
  venueCalendarDate: () => VIEWED_DATE,
}));
vi.mock('./participantRest', () => ({
  analyzeParticipantRest: (params: any) => {
    engineWork.analyze(params);
    return { state: 'ok', matchUpId: params.matchUpId };
  },
}));
vi.mock('i18n', () => ({ t: (key: string) => key }));

import { evaluateRest, makeRestEvaluator } from './inspectorRest';

/**
 * `makeRestEvaluator` is documented as being worth building once per pass — it
 * walks the tournament's events, reads daily limits from the engine and resolves
 * the venue frame, none of which vary per matchUp.
 *
 * The 30-second badge ticker honoured that. The RENDER did not: `renderRestBadge`
 * is `renderCardExtra`, called once per card, and it reached `evaluateRest`, which
 * built a whole evaluator every call. Measured on a 149-matchUp tournament that
 * was 307 `getTournament` calls and ~245ms of a ~305ms schedule render; sharing
 * one evaluator per pass took the same render to ~63ms and 11 calls.
 *
 * Nothing was WRONG before — the answers were identical, which is precisely why
 * it went unnoticed. So these tests are about call counts, and each one needs its
 * control: a cache that never refreshed would satisfy "called once" perfectly.
 */
describe('the rest evaluator is built once per pass', () => {
  beforeEach(() => {
    for (const spy of Object.values(engineWork)) spy.mockClear();
  });

  const flushMicrotasks = () => Promise.resolve();

  it('shares one evaluator across every call in a synchronous pass', () => {
    for (const id of ['m1', 'm2', 'm3']) evaluateRest(id, VIEWED_DATE);

    expect(engineWork.timingResolver).toHaveBeenCalledTimes(1);
    expect(engineWork.dailyLimits).toHaveBeenCalledTimes(1);
    expect(engineWork.venueFrame).toHaveBeenCalledTimes(1);
    expect(engineWork.allMatchUps).toHaveBeenCalledTimes(1);

    // The control. Sharing the SETUP must not share the ANSWER — every matchUp
    // is still evaluated on its own, which a cache keyed too coarsely would break.
    expect(engineWork.analyze).toHaveBeenCalledTimes(3);
    expect(engineWork.analyze.mock.calls.map(([p]: any[]) => p.matchUpId)).toEqual(['m1', 'm2', 'm3']);
  });

  it('scales: the engine work does not grow with the number of matchUps', () => {
    // The shape of the defect. One hundred cards used to mean one hundred event-map
    // walks; a test that only ever asks for three could pass while still being linear.
    for (let i = 0; i < 100; i++) evaluateRest('m1', VIEWED_DATE);

    expect(engineWork.timingResolver).toHaveBeenCalledTimes(1);
    expect(engineWork.analyze).toHaveBeenCalledTimes(100);
  });

  it('releases at the end of the task, so the next pass re-reads the engine', async () => {
    evaluateRest('m1', VIEWED_DATE);
    expect(engineWork.timingResolver).toHaveBeenCalledTimes(1);

    await flushMicrotasks();

    // A cache that outlived its pass would freeze both the clock and the factory
    // state — the badge counts up, and a mutation between renders must be seen.
    evaluateRest('m1', VIEWED_DATE);
    expect(engineWork.timingResolver).toHaveBeenCalledTimes(2);
  });

  it('leaves makeRestEvaluator itself unshared, which the ticker relies on', () => {
    // `tick()` builds its own evaluator deliberately and must keep getting a fresh
    // one — that is how every badge in a tick agrees about what time it is.
    //
    // A pass has to be OPEN for this to mean anything. Written first without the
    // `evaluateRest` line, it passed against a `makeRestEvaluator` that returned
    // the shared evaluator whenever one existed — because none ever did.
    evaluateRest('m1', VIEWED_DATE);
    expect(engineWork.timingResolver).toHaveBeenCalledTimes(1);

    makeRestEvaluator();
    expect(engineWork.timingResolver).toHaveBeenCalledTimes(2);
  });
});
