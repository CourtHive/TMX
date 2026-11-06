import { tournamentClockZone, zoneCity } from './tournamentClock';
import { describe, expect, it } from 'vitest';

const NEW_YORK = 'America/New_York';
const LONDON = 'Europe/London';
const PANAMA = 'America/Panama';
const JANUARY = Date.UTC(2026, 0, 15, 12);
const JULY = Date.UTC(2026, 6, 1, 12);
// Panama keeps UTC-5 all year; New York leaves it for UTC-4 on 8 March 2026.
const MID_MARCH = Date.UTC(2026, 2, 15, 12);

const set = (timeZone: string) => ({ timeZone, source: 'tournament' });

describe('tournamentClockZone', () => {
  it('names the tournament zone when it reads differently from the machine', () => {
    expect(tournamentClockZone(set(NEW_YORK), JANUARY, 'UTC')).toBe(NEW_YORK);
  });

  it('names a zone inferred from the venues', () => {
    expect(tournamentClockZone({ timeZone: 'Asia/Tokyo', source: 'venue' }, JANUARY, 'Europe/Paris')).toBe(
      'Asia/Tokyo',
    );
  });

  it('shows nothing when two different zones read the same clock', () => {
    expect(tournamentClockZone(set('America/Detroit'), JANUARY, NEW_YORK)).toBe(undefined);
    expect(tournamentClockZone(set(LONDON), JANUARY, 'UTC')).toBe(undefined);
  });

  it('compares offsets at the instant, so zones that agree in winter differ across a DST change', () => {
    expect(tournamentClockZone(set(PANAMA), JANUARY, NEW_YORK)).toBe(undefined);
    expect(tournamentClockZone(set(PANAMA), MID_MARCH, NEW_YORK)).toBe(PANAMA);
    expect(tournamentClockZone(set(LONDON), JULY, 'UTC')).toBe(LONDON);
  });

  it('shows nothing for the browser fallback or a refused frame', () => {
    expect(tournamentClockZone({ timeZone: NEW_YORK, source: 'browser' }, JANUARY, 'UTC')).toBe(undefined);
    expect(tournamentClockZone({ source: 'error' }, JANUARY, 'UTC')).toBe(undefined);
  });

  it('names the place briefly', () => {
    expect(zoneCity('America/Los_Angeles')).toBe('Los Angeles');
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
    expect(zoneCity('UTC')).toBe('UTC');
  });
});
