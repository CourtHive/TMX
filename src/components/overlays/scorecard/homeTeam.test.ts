/**
 * A dual's home team through the real engine: who the factory resolves as home, and the methods the scorecard and
 * the dual's ⋮ menu send, run as the executionQueue runs them.
 */
import { eventConstants, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { clearHomeMethod, dualHome, homeTeamMenu, inferredHome, saveHomeTeam, setHomeMethod } from './homeTeam';
import { describe, expect, it } from 'vitest';

const { TEAM } = eventConstants;

const run = (methods: any[]) => tournamentEngine.executionQueue(methods, true);

function generateDual({ drawSize = 2 } = {}) {
  mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize, eventType: TEAM }], setState: true });
  const dual: any = tournamentEngine
    .allTournamentMatchUps({ inContext: true })
    .matchUps?.find((m: any) => m.matchUpType === TEAM && m.sides?.every((side: any) => side.participantId));
  const side = (sideNumber: number) => dual.sides.find((s: any) => s.sideNumber === sideNumber).participantId;
  return { drawId: dual.drawId, matchUpId: dual.matchUpId, side1: side(1), side2: side(2) };
}

describe('dual home team', () => {
  it('has no home team until one is set: no side is assumed', () => {
    const { drawId, matchUpId } = generateDual();
    expect(dualHome({ drawId, matchUpId })).toEqual({ basis: 'NONE', homeParticipantId: undefined });

    const menu = homeTeamMenu({ drawId, matchUpId });
    expect(menu?.teams.map(({ isHome }) => isHome)).toEqual([false, false]);
    expect(menu?.canClear).toEqual(false);
  });

  it('sets the home team, which the menu then marks and offers to clear', () => {
    const { drawId, matchUpId, side1, side2 } = generateDual();
    let result: any = run([setHomeMethod({ drawId, matchUpId, participantId: side2 })]);
    expect(result.success).toEqual(true);
    expect(dualHome({ drawId, matchUpId })).toEqual({ basis: 'EXPLICIT', homeParticipantId: side2 });

    const menu = homeTeamMenu({ drawId, matchUpId });
    expect(menu?.teams.map(({ participantId, isHome }) => [participantId, isHome])).toEqual([
      [side1, false],
      [side2, true],
    ]);
    expect(menu?.teams.every(({ participantName }) => !!participantName)).toEqual(true);
    expect(menu?.canClear).toEqual(true);

    // the other team can take over
    result = run([setHomeMethod({ drawId, matchUpId, participantId: side1 })]);
    expect(result.success).toEqual(true);
    expect(dualHome({ drawId, matchUpId }).homeParticipantId).toEqual(side1);
  });

  it('clears the home team', () => {
    const { drawId, matchUpId, side1 } = generateDual();
    run([setHomeMethod({ drawId, matchUpId, participantId: side1 })]);
    const result: any = run([clearHomeMethod({ drawId, matchUpId })]);
    expect(result.success).toEqual(true);
    expect(dualHome({ drawId, matchUpId }).basis).toEqual('NONE');
    expect(tournamentEngine.findMatchUp({ drawId, matchUpId }).matchUp?.schedule?.homeParticipantId).toBeUndefined();
  });

  it('refuses a home team that is not one of the two sides', () => {
    const { drawId, matchUpId } = generateDual();
    const result: any = run([setHomeMethod({ drawId, matchUpId, participantId: 'not-a-side' })]);
    expect(result.error).toBeDefined();
    expect(dualHome({ drawId, matchUpId }).basis).toEqual('NONE');
  });

  it('shows an inferred home with its basis, and nothing to clear', () => {
    const { drawId, matchUpId, side1 } = generateDual();
    const venueId = 'home-venue';
    let result: any = tournamentEngine.addVenue({ venue: { venueId, venueName: 'Home courts' } });
    expect(result.success).toEqual(true);
    // no engine method writes a TEAM's homeVenueIds (modifyParticipant drops it), so the record carries it
    const { tournamentRecord } = tournamentEngine.getTournament();
    tournamentRecord.participants.find((p: any) => p.participantId === side1).homeVenueIds = [venueId];
    tournamentEngine.setState(tournamentRecord);
    result = tournamentEngine.addMatchUpScheduleItems({ drawId, matchUpId, schedule: { venueId } });
    expect(result.success).toEqual(true);

    expect(dualHome({ drawId, matchUpId })).toEqual({ basis: 'VENUE', homeParticipantId: side1 });
    const menu = homeTeamMenu({ drawId, matchUpId });
    expect(menu?.teams[0].isHome).toEqual(true);
    expect(menu?.basis).toEqual('VENUE');
    expect(menu?.canClear).toEqual(false);
  });

  it('says which home a set one gives way to, and nothing when none would be inferred', () => {
    const { drawId, matchUpId, side1, side2 } = generateDual();
    run([setHomeMethod({ drawId, matchUpId, participantId: side2 })]);
    expect(inferredHome({ drawId, matchUpId })).toEqual({});

    const venueId = 'home-venue';
    tournamentEngine.addVenue({ venue: { venueId, venueName: 'Home courts' } });
    const { tournamentRecord } = tournamentEngine.getTournament();
    tournamentRecord.participants.find((p: any) => p.participantId === side1).homeVenueIds = [venueId];
    tournamentEngine.setState(tournamentRecord);
    tournamentEngine.addMatchUpScheduleItems({ drawId, matchUpId, schedule: { venueId } });

    // the set home still wins; with it taken out, the venue makes side 1 home
    expect(dualHome({ drawId, matchUpId })).toEqual({ basis: 'EXPLICIT', homeParticipantId: side2 });
    expect(inferredHome({ drawId, matchUpId })).toEqual({ inferredParticipantId: side1, inferredBasis: 'VENUE' });
    // and nothing was changed on the record by asking
    expect(dualHome({ drawId, matchUpId }).homeParticipantId).toEqual(side2);
  });

  it('resolves a save to whether it was accepted, refreshing only when it was', async () => {
    let refreshed = 0;
    const onRefresh = () => (refreshed += 1);
    const methods = [{ method: 'anything' }];

    const accepted = (params: any) => params.callback({ success: true });
    expect(await saveHomeTeam({ send: accepted, methods, onRefresh })).toEqual(true);
    expect(refreshed).toEqual(1);

    const refused = (params: any) => params.callback({ error: { message: 'no' } });
    expect(await saveHomeTeam({ send: refused, methods, onRefresh })).toEqual(false);
    const throwing = () => Promise.reject(new Error('offline'));
    expect(await saveHomeTeam({ send: throwing, methods, onRefresh })).toEqual(false);
    expect(refreshed).toEqual(1);
  });

  it('offers no menu for a dual whose teams are not both in', () => {
    mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize: 4, eventType: TEAM }], setState: true });
    const final: any = tournamentEngine
      .allTournamentMatchUps({ inContext: true })
      .matchUps?.find((m: any) => m.matchUpType === TEAM && m.roundNumber === 2);
    expect(homeTeamMenu({ drawId: final.drawId, matchUpId: final.matchUpId })).toBeUndefined();
  });
});
