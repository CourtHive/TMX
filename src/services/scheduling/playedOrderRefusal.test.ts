import { describe, expect, it, vi } from 'vitest';

vi.mock('i18n', () => ({
  t: (key: string, options?: Record<string, any>) => (options ? `${key}:${JSON.stringify(options)}` : key),
}));
vi.mock('services/factory/engine', () => ({ tournamentEngine: { allTournamentMatchUps: () => ({ matchUps: [] }) } }));

import { playedOrderRefusalMessage } from './playedOrderRefusal';

// The factory refuses a schedule write that would put a matchUp at or before a played matchUp it depends on (CA
// 2026-10-22). A refused grid drop used to snap back in silence; the message names the match that stands in the way.

const refusal = (blockingMatchUps: any[]) => ({
  error: { code: 'ANACHRONISM', message: 'Chronological error; time violation.' },
  context: { matchUpId: 'final', blockingMatchUps },
});
const labels: Record<string, string> = { sf1: 'SF: Alice vs Bob' };
const labelOf = (matchUpId: string) => labels[matchUpId];

describe('playedOrderRefusalMessage', () => {
  it('names the played source, with its date and time', () => {
    const message = playedOrderRefusalMessage(
      refusal([{ matchUpId: 'sf1', relation: 'playedSource', scheduledDate: '2026-10-02', scheduledTime: '10:00' }]),
      labelOf,
    );
    expect(message).toBe('toasts.schedule.beforePlayedSource:{"matchUp":"SF: Alice vs Bob","when":"2026-10-02 10:00"}');
  });

  it('a played match moved after its dependent says so', () => {
    const message = playedOrderRefusalMessage(refusal([{ matchUpId: 'sf1', relation: 'dependent' }]), labelOf);
    expect(message).toContain('toasts.schedule.afterDependent');
  });

  // CA 2026-10-30: the order binds plans too, so the blocking source may only be scheduled. It used to read "already
  // played".
  it('a source that is only scheduled is not called played', () => {
    const message = playedOrderRefusalMessage(
      refusal([{ matchUpId: 'sf1', relation: 'source', scheduledDate: '2026-10-02', scheduledTime: '10:00' }]),
      labelOf,
    );
    expect(message).toBe('toasts.schedule.beforeSource:{"matchUp":"SF: Alice vs Bob","when":"2026-10-02 10:00"}');
  });

  it('recorded times that overlap a linked match name its times', () => {
    const recorded = (relation: string) => ({
      error: { code: 'ANACHRONISM' },
      context: {
        matchUpId: 'qf',
        startTime: '11:00',
        blockingMatchUps: [{ matchUpId: 'sf1', relation, startTime: '10:30', endTime: '12:00' }],
      },
    });
    expect(playedOrderRefusalMessage(recorded('dependent'), labelOf)).toBe(
      'toasts.schedule.overlapsDependent:{"matchUp":"SF: Alice vs Bob","when":"10:30–12:00"}',
    );
    expect(playedOrderRefusalMessage(recorded('source'), labelOf)).toContain('toasts.schedule.overlapsSource');
  });

  it('falls back to the round when the match cannot be labelled, and counts the rest', () => {
    const message = playedOrderRefusalMessage(
      refusal([
        { matchUpId: 'unknown', relation: 'playedSource', roundNumber: 2 },
        { matchUpId: 'sf1', relation: 'playedSource' },
      ]),
      labelOf,
    );
    expect(message).toContain('toasts.schedule.roundLabel:{\\"roundNumber\\":2}');
    expect(message).toContain('toasts.schedule.moreBlocking:{"count":1}');
  });

  it('is undefined for any other result, so a caller keeps its own message', () => {
    expect(playedOrderRefusalMessage({ error: { code: 'ERR_INVALID_TIME' } }, labelOf)).toBeUndefined();
    expect(playedOrderRefusalMessage({ error: { code: 'ANACHRONISM' } }, labelOf)).toBeUndefined();
    expect(playedOrderRefusalMessage({ success: true }, labelOf)).toBeUndefined();
    expect(playedOrderRefusalMessage(undefined, labelOf)).toBeUndefined();
  });
});
