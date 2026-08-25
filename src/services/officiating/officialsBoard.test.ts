/**
 * Officials board derivation (P0, D5).
 *
 * The case that matters most is the one that distinguishes `waiting` from `available`: a Thursday
 * sign-in must NOT make somebody read as present on Friday. Nothing signs anybody out at end of day,
 * so `participant.signedIn` — the latest value — would say it does.
 */
import { buildOfficialsBoard, signedInOnDate, durationToMinutes, isOfficial } from './officialsBoard';
import { describe, expect, it } from 'vitest';

const DAY = '2026-08-24';
const PRIOR = '2026-08-23';

const official = (participantId: string, participantName: string, timeItems: any[] = []) => ({
  participantId,
  participantName,
  participantType: 'INDIVIDUAL',
  participantRole: 'OFFICIAL',
  timeItems,
});

// Built as a LOCAL midday instant so the fixture means "signed in on that local day" in whatever
// zone the suite runs in. A fixed `...T08:00:00.000Z` would land on the previous local day for any
// runner west of UTC-8 — the fixture would then encode the very bug under test.
const signIn = (date: string, itemValue = 'SIGNED_IN') => {
  const [y, m, d] = date.split('-').map(Number);
  return {
    itemType: 'SIGN_IN_STATUS',
    createdAt: new Date(y, m - 1, d, 12, 0, 0).toISOString(),
    itemValue,
  };
};

const assignment = (over: any = {}) => ({
  matchUpId: over.matchUpId ?? 'm1',
  matchUpStatus: over.matchUpStatus ?? 'TO_BE_PLAYED',
  matchUpDuration: over.matchUpDuration,
  winningSide: over.winningSide,
  schedule: {
    scheduledDate: over.scheduledDate ?? DAY,
    scheduledTime: over.scheduledTime,
    courtName: over.courtName,
    official: over.official,
  },
});

describe('signedInOnDate', () => {
  it('is true for a sign-in stamped that date', () => {
    expect(signedInOnDate(official('o1', 'Ana', [signIn(DAY)]), DAY)).toBe(true);
  });

  it("does NOT carry a previous day's sign-in forward", () => {
    // The whole reason this reads timeItems instead of participant.signedIn: with nothing signing
    // anybody out, the latest value stays SIGNED_IN all week.
    expect(signedInOnDate(official('o1', 'Ana', [signIn(PRIOR)]), DAY)).toBe(false);
  });

  it('honours a sign-out later the same day', () => {
    const p = official('o1', 'Ana', [
      signIn(DAY, 'SIGNED_IN'),
      { ...signIn(DAY, 'SIGNED_OUT'), createdAt: new Date(2026, 7, 24, 17, 0, 0).toISOString() },
    ]);
    expect(signedInOnDate(p, DAY)).toBe(false);
  });

  it('is false with no timeItems at all', () => {
    expect(signedInOnDate(official('o1', 'Ana'), DAY)).toBe(false);
    expect(signedInOnDate(undefined, DAY)).toBe(false);
  });
});

describe('durationToMinutes', () => {
  it('parses the factory HH:MM:SS field', () => {
    expect(durationToMinutes('01:23:45')).toBe(83);
    expect(durationToMinutes('00:00:30')).toBe(0);
  });

  it('returns 0 for absent or malformed input rather than NaN', () => {
    // NaN would poison the summed column silently — worse than a visible zero.
    expect(durationToMinutes(undefined)).toBe(0);
    expect(durationToMinutes('not-a-duration')).toBe(0);
  });
});

describe('isOfficial', () => {
  it('keys on participantRole, never participantType', () => {
    expect(isOfficial({ participantRole: 'OFFICIAL', participantType: 'INDIVIDUAL' })).toBe(true);
    expect(isOfficial({ participantRole: 'COMPETITOR', participantType: 'INDIVIDUAL' })).toBe(false);
    expect(isOfficial({ participantType: 'INDIVIDUAL' })).toBe(false);
  });
});

describe('buildOfficialsBoard', () => {
  it('derives all four states', () => {
    const participants = [
      official('o1', 'On Court', [signIn(DAY)]),
      official('o2', 'Assigned', [signIn(DAY)]),
      official('o3', 'Waiting', [signIn(DAY)]),
      official('o4', 'Available'),
    ];
    const matchUps = [
      assignment({ matchUpId: 'm1', official: 'o1', matchUpStatus: 'IN_PROGRESS', courtName: 'Court 7' }),
      assignment({ matchUpId: 'm2', official: 'o2', scheduledTime: '14:00', courtName: 'Court 2' }),
    ];
    const byId = Object.fromEntries(
      buildOfficialsBoard({ matchUps, participants, date: DAY }).map((row) => [row.participantId, row]),
    );

    expect(byId.o1.state).toBe('onCourt');
    expect(byId.o1.courtName).toBe('Court 7');
    expect(byId.o2.state).toBe('assigned');
    expect(byId.o2.nextScheduledTime).toBe('14:00');
    expect(byId.o3.state).toBe('waiting');
    expect(byId.o4.state).toBe('available');
  });

  it('reads an official signed in YESTERDAY as available, not waiting', () => {
    // The headline failure this derivation exists to avoid.
    const rows = buildOfficialsBoard({
      matchUps: [],
      participants: [official('o1', 'Ana', [signIn(PRIOR)])],
      date: DAY,
    });
    expect(rows[0].state).toBe('available');
  });

  it('ignores assignments on another date', () => {
    const rows = buildOfficialsBoard({
      matchUps: [assignment({ official: 'o1', scheduledDate: PRIOR, matchUpStatus: 'IN_PROGRESS' })],
      participants: [official('o1', 'Ana', [signIn(DAY)])],
      date: DAY,
    });
    expect(rows[0].state).toBe('waiting');
    expect(rows[0].matchesToday).toBe(0);
  });

  it('excludes non-officials entirely', () => {
    const rows = buildOfficialsBoard({
      matchUps: [],
      participants: [{ participantId: 'c1', participantName: 'Player', participantRole: 'COMPETITOR' }],
      date: DAY,
    });
    expect(rows).toEqual([]);
  });

  it('sums time on court and counts matches for the date', () => {
    const rows = buildOfficialsBoard({
      matchUps: [
        assignment({ matchUpId: 'm1', official: 'o1', matchUpStatus: 'COMPLETED', matchUpDuration: '01:30:00' }),
        assignment({ matchUpId: 'm2', official: 'o1', matchUpStatus: 'COMPLETED', matchUpDuration: '00:45:00' }),
      ],
      participants: [official('o1', 'Ana', [signIn(DAY)])],
      date: DAY,
    });
    expect(rows[0].matchesToday).toBe(2);
    expect(rows[0].minutesOnCourtToday).toBe(135);
  });

  it('caps an unclosed timer at 12h rather than letting it grow without bound', () => {
    // matchUpDuration adds a live-elapsed term for anything started and not ended, so a forgotten
    // STOP would otherwise inflate "time on court today" indefinitely.
    const rows = buildOfficialsBoard({
      matchUps: [
        assignment({ matchUpId: 'm1', official: 'o1', matchUpStatus: 'IN_PROGRESS', matchUpDuration: '97:00:00' }),
      ],
      participants: [official('o1', 'Ana', [signIn(DAY)])],
      date: DAY,
    });
    expect(rows[0].minutesOnCourtToday).toBe(12 * 60);
  });

  it('sorts busiest state first, then by name', () => {
    const rows = buildOfficialsBoard({
      matchUps: [assignment({ matchUpId: 'm1', official: 'o2', matchUpStatus: 'IN_PROGRESS' })],
      participants: [official('o1', 'Zoe'), official('o2', 'Ana'), official('o3', 'Bea')],
      date: DAY,
    });
    expect(rows.map((row) => row.participantName)).toEqual(['Ana', 'Bea', 'Zoe']);
  });
});
