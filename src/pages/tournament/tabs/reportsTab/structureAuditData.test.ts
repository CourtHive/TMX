import { auditTournament, groupByStructure } from './structureAuditData';
import { mocksEngine } from 'tods-competition-factory';
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
    const { audits, drawCount } = auditTournament();
    expect(drawCount).toEqual(1);
    expect(audits).toEqual([]);
  });

  it('returns drawCount 0 when the loaded tournament has no generated draws', () => {
    mocksEngine.generateTournamentRecord({ participantsProfile: { participantsCount: 8 }, setState: true });
    const { audits, drawCount } = auditTournament();
    expect(drawCount).toEqual(0);
    expect(audits).toEqual([]);
  });
});
