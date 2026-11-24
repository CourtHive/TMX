import { lastChangeTime, warpStartChoice } from './warpStartTime';
import { mocksEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

const NOW = Date.parse('2026-11-22T15:40:00Z');
const LAST = '2026-11-22T15:21:07.275Z';
const [START, END] = ['2026-11-21', '2026-11-24'];

const record = (extra: Record<string, unknown> = {}) => ({
  startDate: START,
  endDate: END,
  timeItems: [{ createdAt: '2026-11-21T00:39:19.965Z' }],
  events: [
    { drawDefinitions: [{ updatedAt: LAST, structures: [{ matchUps: [{ updatedAt: '2026-11-21T18:00:00Z' }] }] }] },
  ],
  ...extra,
});

describe('lastChangeTime', () => {
  it('finds the newest updatedAt or createdAt anywhere in the record', () => {
    expect(lastChangeTime(record(), NOW)).toEqual(Date.parse(LAST));
  });

  it('compares the tournament stamp and the stamps of all draws across events', () => {
    const snapshot = record({
      factory: { timeStamp: NOW - 5 },
      events: [
        { drawDefinitions: [{ factory: { timeStamp: NOW - 4 } }] },
        { drawDefinitions: [{ factory: { timeStamp: NOW - 1 } }, { factory: { timeStamp: NOW - 3 } }] },
      ],
    });
    expect(lastChangeTime(snapshot, NOW)).toBe(NOW - 1);
    expect(lastChangeTime({ ...snapshot, factory: { timeStamp: NOW } }, NOW)).toBe(NOW);
  });

  it('reads a legacy factory extension and gives the native stamp precedence on the same element', () => {
    const extensions = [{ name: 'factory', value: { timeStamp: NOW } }];
    expect(lastChangeTime({ extensions }, NOW)).toBe(NOW);
    expect(lastChangeTime({ extensions, factory: { timeStamp: NOW - 1 } }, NOW)).toBe(NOW - 1);
  });

  it('keeps newer activity stamps and ignores future, invalid and unrelated clocks', () => {
    const snapshot = record({
      factory: { timeStamp: NOW + 1 },
      events: [
        { drawDefinitions: [{ factory: { timeStamp: NaN } }, { factory: { timeStamp: Date.parse(LAST) - 1 } }] },
      ],
      updatedAt: LAST,
      extensions: [{ name: 'import', value: { timeStamp: NOW, factory: { timeStamp: NOW } } }],
    });
    expect(lastChangeTime(snapshot, NOW)).toBe(Date.parse(LAST));
  });

  it('does not believe a stamp from the future, and finds none in a record without stamps', () => {
    expect(lastChangeTime(record({ extensions: [{ createdAt: '2027-01-01T00:00:00Z' }] }), NOW)).toEqual(
      Date.parse(LAST),
    );
    expect(lastChangeTime({ events: [] }, NOW)).toBeUndefined();
  });

  it('reads a factory-generated record', () => {
    const { tournamentRecord } = mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize: 4 }] });
    const found = lastChangeTime(tournamentRecord, Date.now() + 60_000);
    expect(found).toBeDefined();
    expect(found!).toBeLessThanOrEqual(Date.now() + 60_000);
  });
});

describe('warpStartChoice', () => {
  it('starts an ended tournament at its last change, without asking', () => {
    expect(warpStartChoice({ record: record(), today: '2026-11-25', now: NOW })).toEqual({
      kind: 'start',
      startAt: Date.parse(LAST),
      reason: 'ended',
    });
  });

  it('asks during the tournament, offering the last change and now', () => {
    for (const today of [START, '2026-11-22', END]) {
      expect(warpStartChoice({ record: record(), today, now: NOW })).toEqual({
        kind: 'ask',
        lastChange: Date.parse(LAST),
        now: NOW,
      });
    }
  });

  it('starts now before the tournament begins, and when nothing has been recorded', () => {
    expect(warpStartChoice({ record: record(), today: '2026-11-20', now: NOW })).toMatchObject({
      startAt: NOW,
      reason: 'notStarted',
    });
    expect(
      warpStartChoice({ record: { startDate: START, endDate: END }, today: '2026-11-25', now: NOW }),
    ).toMatchObject({
      startAt: NOW,
      reason: 'noChanges',
    });
  });
});
