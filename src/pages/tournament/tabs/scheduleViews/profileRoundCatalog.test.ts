import { competitionEngine, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { profileRoundCatalog } from './profileRoundCatalog';
import { describe, expect, it } from 'vitest';

// constants and types
import type { CatalogRoundItem } from 'courthive-components';

/**
 * The Profile view's round catalog from the real engine: an event whose weekdays narrow the tournament's dates gets
 * `playingDates` on its rounds from `getRounds`, and the catalog carries them to the scheduling profile, which hides
 * such a round on a day its event does not play and warns (EVENT_DATE_INACTIVE) when one is planned there.
 * Fri 13 .. Mon 16 Nov 2026; the weekend event plays Sat and Sun only.
 */
const FRI = '2026-11-13';
const SAT = '2026-11-14';
const SUN = '2026-11-15';
const MON = '2026-11-16';
const WEEKEND = 'Weekend Doubles';
const OPEN = 'Open Singles';

function seedCatalog() {
  const {
    tournamentRecord: { tournamentId },
    eventIds: [weekendEventId, openEventId],
  } = mocksEngine.generateTournamentRecord({
    eventProfiles: [
      { eventName: WEEKEND, drawProfiles: [{ drawSize: 8 }] },
      { eventName: OPEN, drawProfiles: [{ drawSize: 8 }] },
    ],
    startDate: FRI,
    endDate: MON,
    setState: true,
  });
  const result: any = tournamentEngine.setEventDates({ eventId: weekendEventId, weekdays: ['SAT', 'SUN'] });
  expect(result.success).toBe(true);

  const { rounds = [] }: any = competitionEngine.getRounds();
  expect(rounds.length).toBeGreaterThan(0);
  return { tournamentId, weekendEventId, openEventId, rounds, catalog: profileRoundCatalog(rounds) };
}

// the same contract the scheduling profile applies: no playingDates plays every date
const notPlayingOn = (catalog: CatalogRoundItem[], date: string) =>
  catalog.filter((r) => Array.isArray(r.playingDates) && !r.playingDates.includes(date));

describe('profileRoundCatalog', () => {
  it('carries playingDates only for the event whose own dates narrow the tournament', () => {
    const { tournamentId, weekendEventId, openEventId, catalog } = seedCatalog();
    const weekend = catalog.filter((r) => r.eventId === weekendEventId);
    const open = catalog.filter((r) => r.eventId === openEventId);
    expect(weekend.length).toBeGreaterThan(0);
    expect(open.length).toBeGreaterThan(0);
    for (const round of weekend) expect(round.playingDates).toEqual([SAT, SUN]);
    for (const round of open) expect(round).not.toHaveProperty('playingDates');
    for (const round of catalog) {
      expect(round.tournamentId).toEqual(tournamentId);
      expect(round.roundName).toBeTruthy();
      expect(round.matchCountEstimate).toBeGreaterThan(0);
    }
  });

  it('identifies the rounds whose event does not play on a date, as the factory decides it', () => {
    const { weekendEventId, catalog } = seedCatalog();
    const weekendRounds = catalog.filter((r) => r.eventId === weekendEventId);

    for (const date of [FRI, MON]) {
      const playing: any = competitionEngine.getEventPlayingDates({ eventId: weekendEventId });
      expect(playing.playingDates).not.toContain(date);
      expect(notPlayingOn(catalog, date)).toEqual(weekendRounds);
    }
    expect(notPlayingOn(catalog, SAT)).toEqual([]);
    expect(notPlayingOn(catalog, SUN)).toEqual([]);
  });

  it('copies playingDates rather than sharing the engine result, and keeps an empty list', () => {
    const { rounds, weekendEventId } = seedCatalog();
    const source = rounds.find((r: any) => r.eventId === weekendEventId);
    const [item] = profileRoundCatalog([source]);
    expect(item.playingDates).toEqual(source.playingDates);
    expect(item.playingDates).not.toBe(source.playingDates);

    // an event that plays no tournament date: present and empty, so it plays nowhere
    const [none] = profileRoundCatalog([{ ...source, playingDates: [] }]);
    expect(none.playingDates).toEqual([]);
    expect(notPlayingOn([none], SAT)).toEqual([none]);
  });

  it('names rounds and draws for the catalog, and falls back to the given tournamentId', () => {
    const [item] = profileRoundCatalog(
      [
        {
          eventId: 'e',
          drawId: 'd',
          structureId: 's',
          roundNumber: 2,
          drawName: '0a1b2c3d-1234-5678',
          roundName: 'rn=2',
          matchUps: [{ roundName: 'Semifinals' }],
          matchUpsCount: 2,
        },
      ],
      'fallback',
    );
    expect(item).toEqual({
      tournamentId: 'fallback',
      eventId: 'e',
      eventName: '',
      drawId: 'd',
      drawName: '',
      structureId: 's',
      roundNumber: 2,
      roundName: 'Semifinals',
      matchCountEstimate: 2,
    });
  });
});
