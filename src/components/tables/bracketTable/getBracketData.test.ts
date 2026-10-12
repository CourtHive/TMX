/**
 * A drawn result (16-16 of a points total that allows a tie, SET1-S:P32) is neither a win nor a loss, so a
 * round-robin group's match record read "0/0" for a player whose only result was a draw. CA, 2026-10-11:
 * show W/L/D. A group with a draw shows W/L/D for every row; a group without one keeps W/L.
 */
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { getBracketData } from './getBracketData';
import { describe, expect, it } from 'vitest';

function groupsAfter(results: { side1Score: number; side2Score: number; winningSide?: number }[]) {
  const {
    eventIds: [eventId],
    drawIds: [drawId],
  } = mocksEngine.generateTournamentRecord({
    drawProfiles: [{ drawType: 'ROUND_ROBIN', drawSize: 4, matchUpFormat: 'SET1-S:P32' }],
    setState: true,
    nonRandom: 1,
  });
  const playable = (tournamentEngine.allTournamentMatchUps({ inContext: true }).matchUps ?? []).filter(
    (m: any) => m.readyToScore,
  );
  results.forEach(({ side1Score, side2Score, winningSide }, index) => {
    const result: any = tournamentEngine.setMatchUpStatus({
      matchUpId: playable[index].matchUpId,
      drawId,
      outcome: {
        matchUpStatus: 'COMPLETED',
        winningSide,
        score: { sets: [{ setNumber: 1, side1Score, side2Score, winningSide }] },
      },
    });
    expect(result.success).toBe(true);
  });

  const { participants, eventData } = tournamentEngine.getEventData({
    participantFilters: { eventIds: [eventId], positionedParticipants: true },
    allParticipantResults: true,
    refreshResults: true,
    eventId,
  });
  const structure = eventData.drawsData[0].structures[0];
  const participantMap = Object.fromEntries((participants ?? []).map((p: any) => [p.participantId, p]));
  return getBracketData({ structure, participantMap, participantResults: structure.participantResults, drawId });
}

describe('a round-robin group with a drawn result', () => {
  it('reads W/L/D for every row, and the drawn players carry their draw', () => {
    const [group] = groupsAfter([
      { side1Score: 16, side2Score: 16 },
      { side1Score: 17, side2Score: 15, winningSide: 1 },
    ]);
    expect(group.hasDraws).toBe(true);
    const results = group.rows.map((row: any) => row.result).sort((a: string, b: string) => a.localeCompare(b));
    expect(results).toEqual(['0/0/1', '0/0/1', '0/1/0', '1/0/0']);
  });

  it('control: a group without a draw keeps W/L', () => {
    const [group] = groupsAfter([{ side1Score: 17, side2Score: 15, winningSide: 1 }]);
    expect(group.hasDraws).toBe(false);
    const results = group.rows.map((row: any) => row.result).sort((a: string, b: string) => a.localeCompare(b));
    expect(results).toEqual(['0/0', '0/0', '0/1', '1/0']);
  });
});
