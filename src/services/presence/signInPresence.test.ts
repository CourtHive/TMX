/**
 * Presence as-of a date, and the set the end-of-day action closes out.
 *
 * The case that drives the whole of (c): a Thursday sign-in must NOT make somebody read as present on
 * Friday. Nothing signs anybody out at end of day, so `participant.signedIn` — the latest value —
 * says it does. That is the bug (c) exists to fix, not an edge case.
 */
import { signedInOnDate, stillSignedInOnDate, localCalendarDate } from './signInPresence';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const DAY = '2026-08-24';
const PRIOR = '2026-08-23';

/** Built as a LOCAL midday instant so the fixture means "that local day" in whatever zone runs it. */
const at = (date: string, hour = 12, itemValue = 'SIGNED_IN') => {
  const [y, m, d] = date.split('-').map(Number);
  return { itemType: 'SIGN_IN_STATUS', createdAt: new Date(y, m - 1, d, hour).toISOString(), itemValue };
};

const person = (participantId: string, timeItems: any[] = []) => ({ participantId, timeItems });

describe('localCalendarDate', () => {
  /**
   * ⚠️ The obvious value-based test for this is VACUOUS. TMX runs vitest with `TZ=UTC`
   * (`package.json`), so local and UTC days are identical in the suite and no assertion on a Date can
   * tell the correct implementation from the `toISOString().slice(0, 10)` bug that shipped in #1352.
   * Confirmed by restoring the bug and watching such a test stay green. Guarded at the source instead.
   */
  const codeOf = (file: string) =>
    readFileSync(new URL(file, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

  it('never derives a calendar date from toISOString — that is UTC, the surfaces are local', () => {
    const code = codeOf('./signInPresence.ts');
    expect(code).not.toMatch(/toISOString\(\)\s*\.slice\(\s*0\s*,\s*10\s*\)/);
    // Control: the guard must be able to see the code, not merely fail to match an empty string.
    expect(code).toContain('export function localCalendarDate');
  });

  it('builds the date from LOCAL getters', () => {
    const code = codeOf('./signInPresence.ts');
    for (const getter of ['getFullYear()', 'getMonth()', 'getDate()']) expect(code).toContain(getter);
  });

  it('returns empty for an unparseable value rather than "NaN-NaN-NaN"', () => {
    expect(localCalendarDate('not-a-date')).toBe('');
  });
});

describe('signedInOnDate', () => {
  it('is true for a sign-in stamped that day', () => {
    expect(signedInOnDate(person('p1', [at(DAY)]), DAY)).toBe(true);
  });

  it("does NOT carry a previous day's sign-in forward", () => {
    // The entire reason (c) exists: with nothing signing anybody out, the latest value stays
    // SIGNED_IN all week, so `participant.signedIn` would answer true here.
    expect(signedInOnDate(person('p1', [at(PRIOR)]), DAY)).toBe(false);
  });

  it('honours a sign-out later the same day', () => {
    // Somebody who signed in at 9 and out at 5 was not present at 6.
    expect(signedInOnDate(person('p1', [at(DAY, 9), at(DAY, 17, 'SIGNED_OUT')]), DAY)).toBe(false);
  });

  it('honours signing back IN after signing out', () => {
    expect(signedInOnDate(person('p1', [at(DAY, 9), at(DAY, 12, 'SIGNED_OUT'), at(DAY, 14)]), DAY)).toBe(true);
  });

  it('is false with no timeItems at all', () => {
    expect(signedInOnDate(person('p1'), DAY)).toBe(false);
    expect(signedInOnDate(undefined, DAY)).toBe(false);
  });
});

describe('stillSignedInOnDate', () => {
  it('returns exactly the people whose day is still open', () => {
    const participants = [
      person('open', [at(DAY, 9)]),
      person('closed', [at(DAY, 9), at(DAY, 17, 'SIGNED_OUT')]),
      person('yesterday', [at(PRIOR, 9)]),
      person('never'),
    ];
    expect(stillSignedInOnDate(participants, DAY)).toEqual(['open']);
  });

  it('is role-agnostic — closing the day is not signOutUnapproved', () => {
    // signOutUnapproved is COMPETITOR-scoped because "signed in with no events" is the definition of
    // an official or a volunteer. Closing the day is the opposite intent and must include them.
    const participants = [
      { ...person('official', [at(DAY, 9)]), participantRole: 'OFFICIAL' },
      { ...person('volunteer', [at(DAY, 9)]), participantRole: 'VOLUNTEER' },
      { ...person('competitor', [at(DAY, 9)]), participantRole: 'COMPETITOR' },
    ];
    expect(stillSignedInOnDate(participants, DAY).sort()).toEqual(['competitor', 'official', 'volunteer']);
  });

  it('is empty rather than undefined for no input', () => {
    expect(stillSignedInOnDate(undefined, DAY)).toEqual([]);
    expect(stillSignedInOnDate([], DAY)).toEqual([]);
  });
});
