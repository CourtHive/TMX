import { describe, expect, it } from 'vitest';

import { computeAutoCalls, computeDueMatchUps, type StripColumn } from './autoCallDueMatches';

// A ready matchUp has two sides with participants; the raw factory cell rides on
// `payload` (schedule.scheduledTime, sides).
const ready = (over: Partial<any> & { matchUpId: string }) => ({
  drawId: 'd',
  participantIds: ['p1', 'p2'],
  ...over,
  payload: {
    sides: [{ participantId: 'p1' }, { participantId: 'p2' }],
    schedule: over.scheduledTime ? { scheduledTime: over.scheduledTime } : {},
  },
});

const column = (courtId: string, cells: any[]): StripColumn => ({ courtId, cells });

const NOW = '12:00';

// The afternoon used by the overdue cases: 16:02, with 14:30 behind it and 17:00 ahead.
const AFTERNOON = '16:02';
const PAST = '14:30';
const FUTURE = '17:00';
const COURT = 'c1';
// The row-2 match whose time has passed while row 1 is still in the future.
const OVERDUE = 'overdue-row-2';

describe('computeAutoCalls', () => {
  // ── D4f: autocall CALLS AND MARKS; it never skips on incomplete check-in ──
  //
  // These pin a decision, not a mechanism. `computeAutoCalls` has no check-in filter today, so they
  // pass trivially against current source — that is the point: they exist so that adding one turns
  // red. CA, 2026-08-24: a silent skip stalls the schedule for a reason no operator can see, and
  // `runAutoCallPass` is timer-driven and batched, so there is nobody standing there to warn.
  //
  // The interactive sites warn instead (D4d) — a test routed through `schedule2CellActions` would
  // pass identically whether or not autocall skips, and would prove nothing about this decision.

  // Self-contained rather than extending `ready()`: the check-in field belongs to this decision
  // alone, and widening the shared fixture would imply every autocall case cares about it.
  const withCheckIn = (checkedInParticipantIds: string[]) => ({
    drawId: 'd',
    matchUpId: 'M1',
    matchUpStatus: 'TO_BE_PLAYED',
    participantIds: ['p1', 'p2'],
    payload: {
      sides: [{ participantId: 'p1' }, { participantId: 'p2' }],
      schedule: {},
      checkedInParticipantIds,
    },
  });

  it('calls a match on which NOBODY has checked in', () => {
    expect(computeAutoCalls([column('C1', [withCheckIn([])])], NOW)).toEqual([{ matchUpId: 'M1', drawId: 'd' }]);
  });

  it('calls a match on which only ONE of two participants has checked in', () => {
    // The partial — the state the badge exists to surface. Autocall stamps calledAt anyway and
    // lets the badge carry it; the operator sees "called, 1/2 here" rather than a match that
    // silently never appeared on the strip.
    expect(computeAutoCalls([column('C1', [withCheckIn(['p1'])])], NOW)).toEqual([{ matchUpId: 'M1', drawId: 'd' }]);
  });

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
        {
          matchUpId: 'M1',
          drawId: 'd',
          matchUpStatus: 'TO_BE_PLAYED',
          payload: { sides: [{ participantId: 'p1' }, {}] },
        },
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

describe('a due match sitting BEHIND a not-yet-due one', () => {
  // Court order is the sequence the director stated, so autocall follows it: the
  // first candidate in the column decides, and if that one is not due yet the
  // court waits. The consequence is that a LATER row whose time has already
  // passed is never reached — the court stays idle with work waiting on it.
  //
  // Pinned because it is the exact shape behind "why isn't this 14:30 match on
  // the Now strip at 16:02", and because it is the trigger the strip's `due`
  // state exists to surface: autocall structurally cannot reach this match, so
  // no amount of waiting will call it.
  it('is NOT called — the earlier row is in the future and the column is skipped', () => {
    const col = column(COURT, [
      ready({ matchUpId: 'later-row-1', scheduledTime: FUTURE }),
      ready({ matchUpId: OVERDUE, scheduledTime: PAST }),
    ]);
    expect(computeAutoCalls([col], AFTERNOON)).toEqual([]);
  });

  it('the control: with the rows in time order, the due one IS called', () => {
    const col = column(COURT, [
      ready({ matchUpId: 'overdue-row-1', scheduledTime: PAST }),
      ready({ matchUpId: 'later-row-2', scheduledTime: FUTURE }),
    ]);
    expect(computeAutoCalls([col], AFTERNOON)).toEqual([{ matchUpId: 'overdue-row-1', drawId: 'd' }]);
  });
});

describe('computeDueMatchUps', () => {
  it('finds the overdue match autocall cannot reach — the one behind a future row', () => {
    // The pair to the autocall test above: autocall returns [] for this column
    // because court order short-circuits it, so nothing will ever call this
    // match. This is what makes the court read `due` instead of `free`.
    const col = column(COURT, [
      ready({ matchUpId: 'later-row-1', scheduledTime: FUTURE }),
      ready({ matchUpId: OVERDUE, scheduledTime: PAST }),
    ]);
    expect(computeAutoCalls([col], AFTERNOON)).toEqual([]);
    expect(computeDueMatchUps([col], AFTERNOON)).toEqual([OVERDUE]);
  });

  it('says nothing about a court that already has a live match', () => {
    const col = column(COURT, [
      ready({ matchUpId: 'live', matchUpStatus: 'IN_PROGRESS' }),
      ready({ matchUpId: 'overdue', scheduledTime: PAST }),
    ]);
    expect(computeDueMatchUps([col], AFTERNOON)).toEqual([]);
  });

  it('says nothing about a court whose next match has been called', () => {
    const col = column(COURT, [
      ready({ matchUpId: 'called', scheduledTime: '15:00', calledAt: '2026-09-13T15:00:00.000Z' }),
      ready({ matchUpId: 'overdue', scheduledTime: PAST }),
    ]);
    expect(computeDueMatchUps([col], AFTERNOON)).toEqual([]);
  });

  it('does not call a matchUp late before its time has come', () => {
    const col = column(COURT, [ready({ matchUpId: 'future', scheduledTime: FUTURE })]);
    expect(computeDueMatchUps([col], AFTERNOON)).toEqual([]);
  });

  it('does not call a matchUp late when it has no scheduled time at all', () => {
    // No time is not late: it has never claimed a moment to be measured against.
    const col = column(COURT, [ready({ matchUpId: 'untimed' })]);
    expect(computeDueMatchUps([col], AFTERNOON)).toEqual([]);
  });

  it('ignores an undecided matchUp — that is a readiness answer, not a lateness one', () => {
    const tbd = {
      drawId: 'd',
      matchUpId: 'tbd',
      participantIds: [],
      payload: { sides: [{}, {}], schedule: { scheduledTime: PAST } },
    };
    expect(computeDueMatchUps([column(COURT, [tbd])], AFTERNOON)).toEqual([]);
  });

  it('ignores a matchUp whose annotation withdrew the promise of its time', () => {
    // These four CLEAR `scheduledTime` when written, so in practice they never
    // reach the comparison at all. Kept as a guard for legacy records hydrated
    // from timeItems, where the pair can still arrive: the annotation is the
    // more recent statement of intent, so it wins.
    for (const modifier of ['FOLLOWED_BY', 'NEXT_AVAILABLE', 'AFTER_REST', 'TO_BE_ANNOUNCED']) {
      const soft = {
        drawId: 'd',
        matchUpId: 'soft',
        participantIds: ['p1', 'p2'],
        payload: {
          sides: [{ participantId: 'p1' }, { participantId: 'p2' }],
          schedule: { scheduledTime: PAST, timeModifiers: [modifier] },
        },
      };
      expect(computeDueMatchUps([column(COURT, [soft])], AFTERNOON)).toEqual([]);
    }
    // The control: the same matchUp with no annotation IS due.
    const col = column(COURT, [ready({ matchUpId: 'hard', scheduledTime: PAST })]);
    expect(computeDueMatchUps([col], AFTERNOON)).toEqual(['hard']);
  });

  it('reports a NOT_BEFORE matchUp once its floor has passed — a cleared floor IS due', () => {
    // `NOT_BEFORE` is the ONLY annotation the engine lets stand beside a live
    // time, and it makes that time more binding rather than less: "no earlier
    // than 14:30" is a floor, and at 16:02 the floor is cleared. Suppressing it
    // was the entire live effect of the old five-member set — it hid exactly
    // the matchUp most obviously waiting on an idle court.
    const floored = {
      drawId: 'd',
      matchUpId: 'floored',
      participantIds: ['p1', 'p2'],
      payload: {
        sides: [{ participantId: 'p1' }, { participantId: 'p2' }],
        schedule: { scheduledTime: PAST, timeModifiers: ['NOT_BEFORE'] },
      },
    };
    expect(computeDueMatchUps([column(COURT, [floored])], AFTERNOON)).toEqual(['floored']);
  });

  it('does not report a NOT_BEFORE matchUp before its floor', () => {
    // The control for the rule above: a floor still in the future is a floor.
    const floored = {
      drawId: 'd',
      matchUpId: 'floored',
      participantIds: ['p1', 'p2'],
      payload: {
        sides: [{ participantId: 'p1' }, { participantId: 'p2' }],
        schedule: { scheduledTime: FUTURE, timeModifiers: ['NOT_BEFORE'] },
      },
    };
    expect(computeDueMatchUps([column(COURT, [floored])], AFTERNOON)).toEqual([]);
  });

  it('reports every overdue row on an idle court, and handles courts independently', () => {
    const cols = [
      column(COURT, [
        ready({ matchUpId: 'a', scheduledTime: '14:00' }),
        ready({ matchUpId: 'b', scheduledTime: '15:00' }),
      ]),
      column('c2', [ready({ matchUpId: 'c', matchUpStatus: 'IN_PROGRESS' })]),
    ];
    expect(computeDueMatchUps(cols, '16:02')).toEqual(['a', 'b']);
  });
});
