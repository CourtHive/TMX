import type { Page } from '@playwright/test';

export type ScheduledMatchUpSeed = {
  eventId: string;
  drawId: string;
  matchUpId: string;
  /** Round 1's second matchUp, on Court 1 `nextDate` — a day other than the live one. */
  nextDayMatchUpId: string;
};

/**
 * An 8-draw with round 1's first matchUp on Court 1 `date` (today, for live scoring) and its second on Court 1
 * `nextDate`. Opened with `dev.load` (the engine's own record,
 * read back after the scheduling mutation): unlike persisting to IDB and navigating, it runs the full
 * tournament-open path — which is where the `/live` socket connects. With `setState: true` alone the
 * engine already holds the tournament, and opening it skips that path.
 */
export async function seedScheduledMatchUp(
  page: Page,
  { tournamentId, date, nextDate }: { tournamentId: string; date: string; nextDate: string },
): Promise<ScheduledMatchUpSeed> {
  return page.evaluate(
    async ({ tournamentId, date, nextDate }) => {
      const engine = dev.factory.tournamentEngine;
      dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Live Scoring',
        tournamentAttributes: { tournamentId, startDate: date, endDate: nextDate },
        drawProfiles: [{ drawSize: 8, matchUpFormat: 'SET3-S:6/TB7' }],
        venueProfiles: [{ courtsCount: 2, venueName: 'Live Venue' }],
      });
      const court = engine.getVenuesAndCourts().venues[0].courts[0];
      const { matchUps } = engine.allTournamentMatchUps({ matchUpFilters: { roundNumbers: [1] }, inContext: true });
      const matchUp = matchUps.find((m: any) => m.roundPosition === 1);
      const nextDayMatchUp = matchUps.find((m: any) => m.roundPosition === 2);
      const place = (m: any, scheduledDate: string) =>
        engine.addMatchUpScheduleItems({
          schedule: { courtId: court.courtId, venueId: court.venueId, courtOrder: 1, scheduledDate },
          removePriorValues: true,
          matchUpId: m.matchUpId,
          drawId: m.drawId,
        });
      place(matchUp, date);
      place(nextDayMatchUp, nextDate);
      await dev.load(engine.getTournament().tournamentRecord);
      return {
        eventId: matchUp.eventId,
        drawId: matchUp.drawId,
        matchUpId: matchUp.matchUpId,
        nextDayMatchUpId: nextDayMatchUp.matchUpId,
      };
    },
    { tournamentId, date, nextDate },
  );
}
