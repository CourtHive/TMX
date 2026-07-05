import { describe, expect, it } from 'vitest';

import { computeAutoCalls, type StripColumn } from './autoCallDueMatches';

// A ready matchUp has two sides with participants; the raw factory cell rides on
// `payload` (schedule.scheduledTime, sides).
const ready = (over: Partial<any> & { matchUpId: string }) => ({
  drawId: 'd',
  participantIds: ['p1', 'p2'],
  ...over,
  payload: { sides: [{ participantId: 'p1' }, { participantId: 'p2' }], schedule: over.scheduledTime ? { scheduledTime: over.scheduledTime } : {} },
});

const column = (courtId: string, cells: any[]): StripColumn => ({ courtId, cells });

const NOW = '12:00';

describe('computeAutoCalls', () => {
  it('auto-calls a free court next match with no scheduledTime', () => {
    const cols = [column('C1', [ready({ matchUpId: 'M1', matchUpStatus: 'TO_BE_PLAYED' })])];
    expect(computeAutoCalls(cols, NOW)).toEqual([{ matchUpId: 'M1', drawId: 'd' }]);
  });

  it('auto-calls a match whose scheduledTime is now or in the past', () => {
    const cols = [column('C1', [ready({ matchUpId: 'M1', matchUpStatus: 'TO_BE_PLAYED', scheduledTime: '11:00' })])];
    expect(computeAutoCalls(cols, NOW).map((c) => c.matchUpId)).toEqual(['M1']);
  });

  it('does NOT call a match whose scheduledTime is strictly in the future', () => {
    const cols = [column('C1', [ready({ matchUpId: 'M1', matchUpStatus: 'TO_BE_PLAYED', scheduledTime: '14:00' })])];
    expect(computeAutoCalls(cols, NOW)).toEqual([]);
  });

  it('skips a court that already has a live match', () => {
    const cols = [
      column('C1', [
        ready({ matchUpId: 'L1', matchUpStatus: 'IN_PROGRESS' }),
        ready({ matchUpId: 'M2', matchUpStatus: 'TO_BE_PLAYED' }),
      ]),
    ];
    expect(computeAutoCalls(cols, NOW)).toEqual([]);
  });

  it('skips a court whose next match has already been called', () => {
    const cols = [
      column('C1', [ready({ matchUpId: 'M1', matchUpStatus: 'TO_BE_PLAYED', calledAt: '2024-01-01T10:00:00Z' })]),
    ];
    expect(computeAutoCalls(cols, NOW)).toEqual([]);
  });

  it('calls the next pending after a completed match on the same court', () => {
    const cols = [
      column('C1', [
        ready({ matchUpId: 'DONE', matchUpStatus: 'COMPLETED', winningSide: 1 }),
        ready({ matchUpId: 'NEXT', matchUpStatus: 'TO_BE_PLAYED' }),
      ]),
    ];
    expect(computeAutoCalls(cols, NOW).map((c) => c.matchUpId)).toEqual(['NEXT']);
  });

  it('does not call an unfilled (TBD) match', () => {
    const cols = [
      column('C1', [
        { matchUpId: 'M1', drawId: 'd', matchUpStatus: 'TO_BE_PLAYED', payload: { sides: [{ participantId: 'p1' }, {}] } },
      ]),
    ];
    expect(computeAutoCalls(cols, NOW)).toEqual([]);
  });

  it('handles multiple courts independently', () => {
    const cols = [
      column('C1', [ready({ matchUpId: 'A', matchUpStatus: 'TO_BE_PLAYED' })]),
      column('C2', [ready({ matchUpId: 'B', matchUpStatus: 'IN_PROGRESS' })]),
      column('C3', [ready({ matchUpId: 'C', matchUpStatus: 'TO_BE_PLAYED', scheduledTime: '23:00' })]),
    ];
    expect(computeAutoCalls(cols, NOW).map((c) => c.matchUpId)).toEqual(['A']);
  });
});
