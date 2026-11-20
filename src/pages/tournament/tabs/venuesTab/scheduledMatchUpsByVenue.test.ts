import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { scheduledMatchUpsByVenue } from './scheduledMatchUpsByVenue';
import { describe, expect, it } from 'vitest';
import { mapVenue } from './mapVenue';

// The Venues table's "Scheduled matches" column was a literal 0 from TMX's first commit: a venue with every court
// full still read 0. These pin the count to the matchUps actually placed on the venue's courts.
describe('scheduledMatchUpsByVenue', () => {
  it('counts the matchUps scheduled on each venue, by venueId or by one of its courts', () => {
    const venues = [
      { venueId: 'v1', courts: [{ courtId: 'c1' }, { courtId: 'c2' }] },
      { venueId: 'v2', courts: [{ courtId: 'c3' }] },
    ];
    const matchUps = [
      { schedule: { venueId: 'v1', courtId: 'c1' } },
      { schedule: { venueId: 'v1', courtId: 'c2' } },
      { schedule: { courtId: 'c2' } }, // court known, venueId absent
      { schedule: { venueId: 'v2' } }, // venue assigned, no court yet
      { schedule: { scheduledDate: '2026-11-20' } }, // dated but not placed on a venue
      {},
    ];

    const counts = scheduledMatchUpsByVenue(matchUps, venues);

    expect(counts.get('v1')).toBe(3);
    expect(counts.get('v2')).toBe(1);
  });

  it('gives mapVenue the count instead of 0', () => {
    const venue = { venueId: 'v1', venueName: 'Main', courts: [] };

    expect(mapVenue(venue, undefined, new Map([['v1', 7]])).scheduledMatchUpsCount).toBe(7);
    expect(mapVenue(venue).scheduledMatchUpsCount).toBe(0);
  });

  it('counts a tournament scheduled through addMatchUpScheduleItems', () => {
    const startDate = '2026-11-20';
    const { tournamentRecord } = mocksEngine.generateTournamentRecord({
      drawProfiles: [{ drawSize: 16 }],
      venueProfiles: [{ courtsCount: 4 }],
      startDate,
    });
    tournamentEngine.setState(tournamentRecord);
    let result: any = tournamentEngine.getVenuesAndCourts();
    const venues: any[] = result.venues;
    const { courts, venueId } = venues[0];
    result = tournamentEngine.allTournamentMatchUps({ inContext: true });
    const firstRound = result.matchUps.filter((m: any) => m.roundNumber === 1);
    firstRound.forEach((m: any, i: number) => {
      result = tournamentEngine.addMatchUpScheduleItems({
        matchUpId: m.matchUpId,
        drawId: m.drawId,
        schedule: { scheduledDate: startDate, courtId: courts[i % courts.length].courtId, venueId },
      });
      expect(result.success).toBe(true);
    });

    result = tournamentEngine.allTournamentMatchUps({ inContext: false });

    expect(scheduledMatchUpsByVenue(result.matchUps, venues).get(venueId)).toBe(firstRound.length);
  });
});
