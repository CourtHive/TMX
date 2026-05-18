import { describe, expect, it, vi } from 'vitest';

vi.mock('courthive-components', () => ({
  tennisCourt: vi.fn(),
  basketballCourt: vi.fn(),
  baseballDiamond: vi.fn(),
  hockeyRink: vi.fn(),
  pickleballCourt: vi.fn(),
  badmintonCourt: vi.fn(),
  padelCourt: vi.fn(),
  createCourtSvg: vi.fn(),
  resolveCourtSport: vi.fn(),
  sportFromMatchUpFormat: vi.fn(),
  COURT_SVG_RESOURCE_SUB_TYPE: 'COURT_SVG',
  // The TMX wrapper now delegates field extraction to the shared mapper in
  // courthive-components; stub it inline to preserve the existing test
  // contract without pulling in the real implementation.
  mapTournamentToCardData: (tournament: any) => {
    const r = tournament?.onlineResources?.find((res: any) => res?.name === 'tournamentImage');
    const tmxTimeItem = tournament?.timeItems?.find((ti: any) => ti?.itemType === 'TMX');
    return {
      tournamentId: tournament?.tournamentId ?? '',
      tournamentName: tournament?.tournamentName ?? '',
      startDate: tournament?.startDate,
      endDate: tournament?.endDate,
      tournamentImageURL:
        r?.resourceType === 'URL' ? (r?.url ?? r?.identifier) : undefined,
      courtSvgSport: r?.resourceSubType === 'COURT_SVG' ? r?.identifier : undefined,
      offline: tmxTimeItem?.itemValue?.offline,
    };
  },
}));

import { mapTournamentRecord } from './mapTournamentRecord';

describe('mapTournamentRecord', () => {
  const baseTournament = {
    tournamentId: 't1',
    tournamentName: 'Spring Classic',
    startDate: '2025-03-15',
    endDate: '2025-03-20',
  };

  it('maps basic fields', () => {
    const result = mapTournamentRecord(baseTournament);
    expect(result.tournamentId).toBe('t1');
    expect(result.id).toBe('t1');
    expect(result.searchText).toBe('spring classic');
    expect(result.tournament.tournamentName).toBe('Spring Classic');
    expect(result.tournament.startDate).toBe('2025-03-15');
    expect(result.tournament.endDate).toBe('2025-03-20');
  });

  it('extracts tournamentImageURL from onlineResources', () => {
    const record = {
      ...baseTournament,
      onlineResources: [
        { name: 'tournamentImage', resourceType: 'URL', identifier: 'https://example.com/img.png' },
      ],
    };
    const result = mapTournamentRecord(record);
    expect(result.tournament.tournamentImageURL).toBe('https://example.com/img.png');
    expect(result.tournament.courtSvgSport).toBeUndefined();
  });

  it('extracts courtSvgSport from onlineResources', () => {
    const record = {
      ...baseTournament,
      onlineResources: [
        { name: 'tournamentImage', resourceType: 'OTHER', resourceSubType: 'COURT_SVG', identifier: 'tennis' },
      ],
    };
    const result = mapTournamentRecord(record);
    expect(result.tournament.courtSvgSport).toBe('tennis');
    expect(result.tournament.tournamentImageURL).toBeUndefined();
  });

  it('returns undefined for both when no onlineResources', () => {
    const result = mapTournamentRecord(baseTournament);
    expect(result.tournament.tournamentImageURL).toBeUndefined();
    expect(result.tournament.courtSvgSport).toBeUndefined();
  });

  it('extracts offline status from timeItems', () => {
    const record = {
      ...baseTournament,
      timeItems: [{ itemType: 'TMX', itemValue: { offline: true } }],
    };
    expect(mapTournamentRecord(record).tournament.offline).toBe(true);
  });

  it('offline is undefined when no TMX timeItem', () => {
    expect(mapTournamentRecord(baseTournament).tournament.offline).toBeUndefined();
  });

  it('search text defaults to Error when name is missing', () => {
    const record = { tournamentId: 't1', startDate: '2025-01-01', endDate: '2025-01-02' };
    expect(mapTournamentRecord(record).searchText).toBe('Error');
  });
});
