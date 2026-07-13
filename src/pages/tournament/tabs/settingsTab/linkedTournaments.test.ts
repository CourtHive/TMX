import { getPeerLinkedIds, buildLinkGroup, resolveLinkedRows, availableToLink } from './linkedTournamentsHelpers';
import { describe, it, expect } from 'vitest';

const siblings = [
  { tournamentId: 'A', tournamentName: 'Alpha', providerId: 'p1' },
  { tournamentId: 'B', tournamentName: 'Bravo', providerId: 'p1' },
  { tournamentId: 'C', tournamentName: 'Charlie', providerId: 'p2' },
];

describe('linkedTournaments pure helpers', () => {
  it('getPeerLinkedIds excludes the record itself', () => {
    expect(getPeerLinkedIds({ tournamentId: 'A', linkedTournamentIds: ['A', 'B', 'C'] })).toEqual(['B', 'C']);
    expect(getPeerLinkedIds({ tournamentId: 'A', linkedTournamentIds: [] })).toEqual([]);
    expect(getPeerLinkedIds({ tournamentId: 'A' })).toEqual([]);
  });

  it('buildLinkGroup unions primary + existing peers + additions, deduped', () => {
    expect(buildLinkGroup('A', ['B'], ['C']).sort()).toEqual(['A', 'B', 'C']);
    // dedupe when an addition is already a peer or the primary
    expect(buildLinkGroup('A', ['B'], ['B', 'A', 'D']).sort()).toEqual(['A', 'B', 'D']);
    expect(buildLinkGroup('A', [], [])).toEqual(['A']);
  });

  it('resolveLinkedRows maps ids to names, falling back to the id', () => {
    expect(resolveLinkedRows(['B', 'Z'], siblings)).toEqual([
      { tournamentId: 'B', tournamentName: 'Bravo', providerId: 'p1' },
      { tournamentId: 'Z', tournamentName: 'Z' },
    ]);
  });

  it('availableToLink returns same-provider, non-self, unlinked siblings', () => {
    // primary A at provider p1, already linked to B → only... none at p1 remain (A self, B linked)
    expect(availableToLink('A', 'p1', ['B'], siblings)).toEqual([]);
    // primary A at p1, nothing linked → B is available; C is a different provider so excluded
    expect(availableToLink('A', 'p1', [], siblings).map((s) => s.tournamentId)).toEqual(['B']);
    // no provider filter → both B and C (A excluded as self)
    expect(availableToLink('A', undefined, [], siblings).map((s) => s.tournamentId)).toEqual(['B', 'C']);
  });
});
