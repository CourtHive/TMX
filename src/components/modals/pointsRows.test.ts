import { fixtures, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { pointsRowsForEvent } from './pointsRows';
import { describe, expect, it } from 'vitest';

const POLICY = (fixtures.policies as any).POLICY_RANKING_POINTS_ITF_JUNIOR_2025;

/** A completed doubles event, and the ranking-point awards the factory makes for it. */
function doublesEvent() {
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({
    drawProfiles: [{ eventType: 'DOUBLES', drawSize: 8, completionGoal: 7 }],
  });
  tournamentEngine.setState(tournamentRecord);
  const event = tournamentRecord.events[0];
  const result: any = tournamentEngine.getEventRankingPoints({
    policyDefinitions: POLICY,
    level: 1,
    eventId: event.eventId,
  });
  const { participants } = tournamentEngine.getParticipants({ participantFilters: { participantTypes: ['PAIR'] } });
  return { event, awards: result.eventAwards ?? [], pairs: participants };
}

describe('pointsRowsForEvent', () => {
  it('shows a doubles pair the points its players were awarded, one row per player', () => {
    const { event, awards, pairs } = doublesEvent();
    // the factory awards doubles points to the players, never to the pair
    const pairIds = new Set(pairs.map((pair: any) => pair.participantId));
    expect(awards.length).toBeGreaterThan(0);
    expect(awards.some((award: any) => pairIds.has(award.participantId))).toBe(false);

    const awarded = pairs.find((pair: any) =>
      awards.some((award: any) => pair.individualParticipantIds?.includes(award.participantId)),
    );
    const rows = pointsRowsForEvent({
      participantId: awarded.participantId,
      individualParticipantIds: awarded.individualParticipantIds,
      awards,
      eventId: event.eventId,
      eventName: event.eventName,
    });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(awarded.individualParticipantIds).toContain(row.participantId);
      expect(row.points).toBeGreaterThan(0);
      // the columns the card shows are filled, and each row names its player
      expect(row.positionPoints).toBeDefined();
      expect(row.eventName).toMatch(new RegExp(`^${event.eventName} · `));
    }
  });

  it("matches an individual's own award by participantId or personId, without a member label", () => {
    const awards = [{ participantId: 'p1', personId: 'person-1', points: 50, participantName: 'Ann' }];
    expect(pointsRowsForEvent({ participantId: 'p1', awards, eventId: 'e', eventName: 'Open' })).toEqual([
      { ...awards[0], eventId: 'e', eventName: 'Open' },
    ]);
    expect(
      pointsRowsForEvent({
        participantId: 'other-id',
        personId: 'person-1',
        awards,
        eventId: 'e',
        eventName: 'Open',
      })[0].points,
    ).toBe(50);
  });

  it('keeps the event as a zero row when nobody on the card was awarded', () => {
    expect(
      pointsRowsForEvent({
        participantId: 'x',
        individualParticipantIds: ['y'],
        awards: [{ participantId: 'z', points: 9 }],
        eventId: 'e',
        eventName: 'Open',
      }),
    ).toEqual([{ eventName: 'Open', eventId: 'e', points: 0 }]);
  });
});
