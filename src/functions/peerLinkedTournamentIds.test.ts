import { buildLinkGroup } from 'pages/tournament/tabs/settingsTab/linkedTournamentsHelpers';
import { competitionEngine, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { peerLinkedTournamentIds } from './peerLinkedTournamentIds';
import { describe, expect, it } from 'vitest';

// the legacy extension name keeps its historical spelling
const LEGACY_EXTENSION = 'linkedTournamentsIds';

function legacyOnlyRecord(tournamentId: string, linkedIds: string[]) {
  mocksEngine.generateTournamentRecord({ tournamentAttributes: { tournamentId }, setState: true });
  let result: any = tournamentEngine.addTournamentExtension({
    extension: { name: LEGACY_EXTENSION, value: { tournamentIds: linkedIds } },
  });
  expect(result.success).toBe(true);
  return tournamentEngine.getTournament().tournamentRecord;
}

describe('peerLinkedTournamentIds', () => {
  // assertions carried over unchanged from the two helpers this replaces
  it('excludes the record itself', () => {
    expect(peerLinkedTournamentIds({ tournamentId: 'A', linkedTournamentIds: ['A', 'B', 'C'] })).toEqual(['B', 'C']);
    expect(peerLinkedTournamentIds({ tournamentId: 'A', linkedTournamentIds: [] })).toEqual([]);
    expect(peerLinkedTournamentIds({ tournamentId: 'A' })).toEqual([]);
    expect(peerLinkedTournamentIds({ tournamentId: 'P', linkedTournamentIds: ['P', 'B', 'C'] })).toEqual(['B', 'C']);
    expect(peerLinkedTournamentIds({ tournamentId: 'P' })).toEqual([]);
  });

  it('returns nothing for a missing record or one without an id', () => {
    expect(peerLinkedTournamentIds(undefined)).toEqual([]);
    expect(peerLinkedTournamentIds({ linkedTournamentIds: ['B'] })).toEqual([]);
  });

  it('reads the links of a record that carries only the legacy extension', () => {
    const record = legacyOnlyRecord('A', ['A', 'B', 'C']);
    expect(record.linkedTournamentIds).toBeUndefined();
    expect(record.extensions?.some((extension: any) => extension.name === LEGACY_EXTENSION)).toBe(true);
    expect(peerLinkedTournamentIds(record)).toEqual(['B', 'C']);
  });

  it('prefers the attribute over the legacy extension when both are present', () => {
    const record = legacyOnlyRecord('A', ['A', 'B']);
    expect(peerLinkedTournamentIds({ ...record, linkedTournamentIds: ['A', 'D'] })).toEqual(['D']);
  });

  it('linking from a legacy record keeps its old peers, and the write heals the record', () => {
    const legacy = legacyOnlyRecord('A', ['A', 'B']);
    const { tournamentRecord: peer } = mocksEngine.generateTournamentRecord({
      tournamentAttributes: { tournamentId: 'B' },
    });
    const { tournamentRecord: added } = mocksEngine.generateTournamentRecord({
      tournamentAttributes: { tournamentId: 'C' },
    });

    const group = buildLinkGroup('A', peerLinkedTournamentIds(legacy), ['C']);
    expect(group.sort()).toEqual(['A', 'B', 'C']);

    competitionEngine.setState([legacy, peer, added]);
    let result: any = competitionEngine.executionQueue([
      { method: 'linkTournaments', params: { tournamentIds: group } },
    ]);
    expect(result.success).toBe(true);

    const { tournamentRecords } = competitionEngine.getState();
    expect(peerLinkedTournamentIds(tournamentRecords.A).sort()).toEqual(['B', 'C']);
    expect(peerLinkedTournamentIds(tournamentRecords.B).sort()).toEqual(['A', 'C']);
    expect(peerLinkedTournamentIds(tournamentRecords.C).sort()).toEqual(['A', 'B']);
    expect(tournamentRecords.A.linkedTournamentIds?.slice().sort()).toEqual(['A', 'B', 'C']);
  });
});
