import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  formatCalendarDay,
  formatFixtureDates,
  groupEntriesByYear,
  parseCalendarDay,
  readParticipationResponse,
} from './participationEntries';

import type { ParticipationEntry } from './participationEntries';

const MAR_4 = '2026-03-04';

const entry = (overrides: Partial<ParticipationEntry> = {}): ParticipationEntry => ({
  tournamentId: 'dual-1',
  tournamentName: 'A vs B',
  startDate: MAR_4,
  endDate: MAR_4,
  teamName: 'Team A',
  ...overrides,
});

describe('readParticipationResponse', () => {
  // The pair that matters. An empty season and a failed load are the two answers a user is most
  // likely to confuse, and the only defence is that the reader tells them apart before anything
  // renders. Both directions are asserted so neither can quietly become the other.
  it('reads a populated season as ok', () => {
    const result = readParticipationResponse({ data: { teamId: 't', participations: [entry()] } });
    expect(result).toEqual({ status: 'ok', entries: [entry()] });
  });

  it('reads a subject with NO fixtures as ok with zero entries — not as an error', () => {
    const result = readParticipationResponse({ data: { teamId: 't', participations: [] } });
    expect(result).toEqual({ status: 'ok', entries: [] });
  });

  it('reads a failed request (baseApi resolves rejections to undefined) as an error', () => {
    expect(readParticipationResponse(undefined)).toEqual({ status: 'error', reason: 'no-response' });
  });

  it('reads a 200 carrying an error body as an error', () => {
    expect(readParticipationResponse({ data: { error: 'Forbidden' } })).toEqual({
      status: 'error',
      reason: 'server-error',
    });
  });

  it('reads a body with no participations array as an error, never as an empty season', () => {
    expect(readParticipationResponse({ data: { teamId: 't' } })).toEqual({ status: 'error', reason: 'malformed' });
    expect(readParticipationResponse({})).toEqual({ status: 'error', reason: 'malformed' });
  });

  // The exact body a refused request returns from the query service behind its guard. Read
  // leniently it yields "0 fixtures"; it must read as a REFUSAL. This is not hypothetical — it was
  // misread twice during development, once by a probe that defaulted the missing key to [].
  it('reads a 401 body — no participations key at all — as an error, not an empty season', () => {
    const unauthorised = { data: { message: 'no HS256 secret configured', error: 'Unauthorized', statusCode: 401 } };
    expect(readParticipationResponse(unauthorised)).toEqual({ status: 'error', reason: 'server-error' });
  });
});

describe('parseCalendarDay', () => {
  it('splits an ISO calendar day', () => {
    expect(parseCalendarDay(MAR_4)).toEqual({ year: 2026, month: 3, day: 4 });
  });

  it('refuses anything that is not a bare calendar day', () => {
    for (const bad of [undefined, '', 'not-a-date', '2026-3-4', `${MAR_4}T10:00:00Z`, '2026-13-01', '2026-03-00']) {
      expect(parseCalendarDay(bad)).toBeUndefined();
    }
  });
});

describe('formatCalendarDay', () => {
  // The regression this exists to prevent: `new Date('2026-03-04').toLocaleDateString()` renders
  // 3 March for anyone west of Greenwich. The formatter must return the day it was GIVEN, in every
  // zone, so a fixture never appears to have been played the day before.
  it('renders the calendar day it was given, not a zone-shifted one', () => {
    expect(formatCalendarDay(MAR_4, 'en-US')).toBe('Mar 4');
    expect(formatCalendarDay('2026-01-01', 'en-US')).toBe('Jan 1');
    expect(formatCalendarDay('2026-12-31', 'en-US')).toBe('Dec 31');
  });

  it('is empty for an unparseable day rather than guessing one', () => {
    expect(formatCalendarDay(undefined, 'en-US')).toBe('');
    expect(formatCalendarDay('tbd', 'en-US')).toBe('');
  });
});

/**
 * The suite runs under `TZ=UTC`, where the naive implementation this formatter replaces would pass
 * every assertion above — a degenerate fixture satisfying the test by accident. So this block moves
 * the process into a zone west of Greenwich and asserts a CONTROL first: that the naive expression
 * really does read the wrong day there. Only then does the assertion about `formatCalendarDay`
 * mean anything.
 */
describe('formatCalendarDay under a non-UTC zone', () => {
  const originalTZ = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });

  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  it('CONTROL — the naive Date-based expression reads the day BEFORE in this zone', () => {
    const naive = new Date(MAR_4).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    expect(naive).toBe('Mar 3');
  });

  it('formatCalendarDay is unmoved by the zone', () => {
    expect(formatCalendarDay(MAR_4, 'en-US')).toBe('Mar 4');
    expect(formatFixtureDates('2026-01-01', '2026-01-03', 'en-US')).toBe('Jan 1 – Jan 3');
  });
});

describe('formatFixtureDates', () => {
  it('renders a single day once', () => {
    expect(formatFixtureDates(MAR_4, MAR_4, 'en-US')).toBe('Mar 4');
  });

  it('renders a multi-day fixture as a range', () => {
    expect(formatFixtureDates(MAR_4, '2026-03-06', 'en-US')).toBe('Mar 4 – Mar 6');
  });

  it('falls back to the start day when the end is missing', () => {
    expect(formatFixtureDates(MAR_4, undefined, 'en-US')).toBe('Mar 4');
  });

  it('is empty when there is no start day', () => {
    expect(formatFixtureDates(undefined, '2026-03-06', 'en-US')).toBe('');
  });
});

describe('groupEntriesByYear', () => {
  it('groups by calendar year and preserves the server order within a group', () => {
    const groups = groupEntriesByYear([
      entry({ tournamentId: 'a', startDate: '2024-02-17' }),
      entry({ tournamentId: 'b', startDate: '2024-11-02' }),
      entry({ tournamentId: 'c', startDate: '2026-04-25' }),
    ]);
    expect(groups.map((g) => g.year)).toEqual(['2024', '2026']);
    expect(groups[0].entries.map((e) => e.tournamentId)).toEqual(['a', 'b']);
    expect(groups[1].entries.map((e) => e.tournamentId)).toEqual(['c']);
  });

  it('keeps an undated fixture, in its own group, last — never dropped and never defaulted', () => {
    const groups = groupEntriesByYear([
      entry({ tournamentId: 'undated', startDate: undefined }),
      entry({ tournamentId: 'dated', startDate: '2025-09-10' }),
    ]);
    expect(groups.map((g) => g.year)).toEqual(['2025', '']);
    expect(groups.flatMap((g) => g.entries).map((e) => e.tournamentId)).toEqual(['dated', 'undated']);
  });

  it('returns nothing for no entries', () => {
    expect(groupEntriesByYear([])).toEqual([]);
  });
});
