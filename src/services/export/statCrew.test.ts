/**
 * The StatCrew export of one dual, through the real engine: which game is picked from the factory's
 * `generateStatCrew`, its home and visitor, and the file name.
 */
import { eventConstants, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { setHomeMethod } from 'components/overlays/scorecard/homeTeam';
import { describe, expect, it } from 'vitest';
import {
  canExportStatCrew,
  statCrewExport,
  statCrewFilename,
  STATCREW_NOT_A_DUAL,
  STATCREW_NOT_COMPLETE,
} from './statCrew';

const { TEAM } = eventConstants;

const duals = (): any[] =>
  tournamentEngine
    .allTournamentMatchUps({ inContext: true })
    .matchUps?.filter((m: any) => m.matchUpType === TEAM && m.sides?.every((side: any) => side.participantId)) ?? [];

const sideOf = (matchUp: any, sideNumber: number) => matchUp.sides.find((s: any) => s.sideNumber === sideNumber);

describe('StatCrew export of a dual', () => {
  it('is refused until the dual has its result', () => {
    mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize: 2, eventType: TEAM }], setState: true });
    const [dual] = duals();
    expect(canExportStatCrew(dual)).toEqual(false);
    expect(statCrewExport({ drawId: dual.drawId, matchUpId: dual.matchUpId })).toEqual({
      error: STATCREW_NOT_COMPLETE,
    });

    const line = dual.tieMatchUps[0];
    expect(canExportStatCrew(line)).toEqual(false);
    expect(statCrewExport({ drawId: dual.drawId, matchUpId: line.matchUpId })).toEqual({ error: STATCREW_NOT_A_DUAL });
  });

  it("writes the dual's own game, with its home team, among several duals", () => {
    mocksEngine.generateTournamentRecord({
      drawProfiles: [{ drawSize: 4, eventType: TEAM }],
      tournamentName: 'Fall Duals',
      completeAllMatchUps: true,
      setState: true,
    });
    const all = duals();
    expect(all.length).toEqual(3);
    // the second first-round dual, so a pick by position would take the wrong game
    const dual = all.filter((m: any) => m.roundNumber === 1)[1];
    const { drawId, matchUpId } = dual;
    const home = sideOf(dual, 2);
    const visitor = sideOf(dual, 1);
    expect(canExportStatCrew(dual)).toEqual(true);

    const run: any = tournamentEngine.executionQueue([
      setHomeMethod({ drawId, matchUpId, participantId: home.participantId }),
    ]);
    expect(run.success).toEqual(true);

    const result: any = statCrewExport({ drawId, matchUpId });
    expect(result.error).toBeUndefined();
    expect(result.neutral).toEqual(false);
    expect(result.homeName).toEqual(home.participant.participantName);
    expect(result.visitorName).toEqual(visitor.participant.participantName);

    const { content } = result;
    expect(content.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<tngame>')).toEqual(true);
    expect(content).toContain('neutralgame="N"');
    expect(content).toContain(`homeid="${home.participantId}"`);
    expect(content).toContain(`visid="${visitor.participantId}"`);
    expect(content).toContain(`<team vh="H" id="${home.participantId}"`);
    expect(content).toContain('<singles_match');
    expect(content).toContain('<doubles_match');
    // the other duals' teams are not in this game
    const others = all
      .filter((m: any) => m.matchUpId !== matchUpId)
      .flatMap((m: any) => m.sides.map((s: any) => s.participantId))
      .filter((id: string) => id !== home.participantId && id !== visitor.participantId);
    for (const id of others) expect(content).not.toContain(`id="${id}"`);

    const date = tournamentEngine.getTournament().tournamentRecord.startDate;
    const homeFile = home.participant.participantName.replaceAll(' ', '-');
    const visitorFile = visitor.participant.participantName.replaceAll(' ', '-');
    expect(result.filename).toEqual(`StatCrew_${visitorFile}_at_${homeFile}_${date}.xml`);
  });

  it('writes a neutral game when there is no home team', () => {
    mocksEngine.generateTournamentRecord({
      drawProfiles: [{ drawSize: 2, eventType: TEAM }],
      completeAllMatchUps: true,
      setState: true,
    });
    const [dual] = duals();
    const result: any = statCrewExport({ drawId: dual.drawId, matchUpId: dual.matchUpId });
    expect(result.error).toBeUndefined();
    expect(result.neutral).toEqual(true);
    expect(result.content).toContain('neutralgame="Y"');
    expect(result.filename).toContain('_vs_');
  });

  it('names files safely', () => {
    expect(
      statCrewFilename({ homeName: 'Université Laval', visitorName: 'St. Mary’s / A&M', date: '2026-11-01' }),
    ).toEqual('StatCrew_St-Mary-s-A-M_at_Universite-Laval_2026-11-01.xml');
    expect(statCrewFilename({ neutral: true })).toEqual('StatCrew_visitor_vs_home.xml');
  });
});
