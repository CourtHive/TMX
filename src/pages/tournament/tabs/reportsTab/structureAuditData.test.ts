import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { auditTournament, groupByStructure } from './structureAuditData';
import { describe, expect, it } from 'vitest';

// structureAudit's DOM builders are exercised by Playwright; these node-safe tests cover the
// data layer: enumeration + delegation to the factory checker, and structure grouping.

describe('groupByStructure', () => {
  it('groups inconsistencies by structureId with resolved labels and counts', () => {
    const labels = new Map([
      ['s1', 'MAIN'],
      ['s2', 'CONSOLATION'],
    ]);
    const inconsistencies = [
      { issueType: 'A', message: 'a', matchUpId: 'm1', structureId: 's1' },
      { issueType: 'B', message: 'b', matchUpId: 'm2', structureId: 's2' },
      { issueType: 'C', message: 'c', matchUpId: 'm3', structureId: 's1' },
    ];
    const groups = groupByStructure(inconsistencies, labels);
    expect(groups.map((g) => g.structureId)).toEqual(['s1', 's2']);
    expect(groups.find((g) => g.structureId === 's1')?.label).toEqual('MAIN');
    expect(groups.find((g) => g.structureId === 's1')?.issues.length).toEqual(2);
    expect(groups.find((g) => g.structureId === 's2')?.issues.length).toEqual(1);
  });

  it('falls back to a default label for an unknown structureId', () => {
    const groups = groupByStructure([{ issueType: 'A', message: 'a', matchUpId: 'm1', structureId: 'x' }], new Map());
    expect(groups[0].label).toEqual('Structure');
  });
});

describe('auditTournament', () => {
  it('enumerates draws and reports zero audits for a clean completed tournament', () => {
    mocksEngine.generateTournamentRecord({
      drawProfiles: [{ drawId: 'auditClean', drawSize: 16, drawType: 'SINGLE_ELIMINATION' }],
      completeAllMatchUps: true,
      setState: true,
    });
    const { audits, completeness, drawCount } = auditTournament();
    expect(drawCount).toEqual(1);
    expect(audits).toEqual([]);
    // fully populated + played → nothing outstanding
    expect(completeness).toEqual([]);
  });

  it('returns drawCount 0 when the loaded tournament has no generated draws', () => {
    mocksEngine.generateTournamentRecord({ participantsProfile: { participantsCount: 8 }, setState: true });
    const { audits, completeness, drawCount } = auditTournament();
    expect(drawCount).toEqual(0);
    expect(audits).toEqual([]);
    expect(completeness).toEqual([]);
  });

  it('reports a generated-but-unplayed draw as outstanding with no inconsistencies', () => {
    mocksEngine.generateTournamentRecord({
      drawProfiles: [{ drawId: 'auditOutstanding', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
      setState: true,
    });
    const { audits, completeness } = auditTournament();
    // an in-progress draw is not inconsistent, but it IS outstanding
    expect(audits).toEqual([]);
    expect(completeness.length).toEqual(1);
    const group = completeness[0].groups[0];
    expect(group.unassignedPositions).toEqual([]);
    expect(group.unplayedMatchUps.length).toEqual(7);
  });

  it('surfaces within-structure matchUpFormat variance with the revert pattern', () => {
    const { tournamentRecord } = mocksEngine.generateTournamentRecord({
      drawProfiles: [{ drawId: 'auditFmt', drawSize: 16, drawType: 'SINGLE_ELIMINATION', matchUpFormat: 'SET3-S:6/TB7' }],
      completeAllMatchUps: true,
    });
    // a storm shortened round 2 only; rounds 1/3/4 stay on the baseline → depart-then-return
    const structure = tournamentRecord.events[0].drawDefinitions[0].structures[0];
    structure.matchUps
      .filter((m: any) => m.roundNumber === 2)
      .forEach((m: any) => (m.matchUpFormat = 'SET1-S:6/TB7'));
    tournamentEngine.setState(tournamentRecord);

    const { formatVariance } = auditTournament();
    expect(formatVariance.length).toEqual(1);
    const group = formatVariance[0].groups[0];
    expect(group.baselineFormat).toEqual('SET3-S:6/TB7');
    expect(group.revertPattern).toEqual(true);
    expect(group.departingRounds.some((r) => r.roundNumber === 2)).toEqual(true);
  });
});
