import { describe, expect, it, vi } from 'vitest';

vi.mock('courthive-components', () => ({
  tennisCourt: vi.fn(),
  basketballCourt: vi.fn(),
  baseballDiamond: vi.fn(),
  hockeyRink: vi.fn(),
  pickleballCourt: vi.fn(),
  badmintonCourt: vi.fn(),
  padelCourt: vi.fn(),
}));

import { sportFromMatchUpFormat, resolveCourtSport, COURT_SVG_RESOURCE_SUB_TYPE } from './courtSvgUtil';

describe('sportFromMatchUpFormat', () => {
  it('returns undefined for no input', () => {
    expect(sportFromMatchUpFormat()).toBeUndefined();
    expect(sportFromMatchUpFormat('')).toBeUndefined();
  });

  it('maps SET-based formats to tennis', () => {
    expect(sportFromMatchUpFormat('SET3-S:6/TB7')).toBe('tennis');
    expect(sportFromMatchUpFormat('SET1-S:4/TB7')).toBe('tennis');
  });

  it('maps T-prefix formats to tennis', () => {
    expect(sportFromMatchUpFormat('T:10')).toBe('tennis');
  });

  it('maps SET with @RALLY to pickleball', () => {
    expect(sportFromMatchUpFormat('SET3-S:11@RALLY')).toBe('pickleball');
  });

  it('maps HAL to basketball', () => {
    expect(sportFromMatchUpFormat('HAL4-S:12')).toBe('basketball');
  });

  it('maps INN to baseball', () => {
    expect(sportFromMatchUpFormat('INN9')).toBe('baseball');
  });

  it('maps PER to hockey', () => {
    expect(sportFromMatchUpFormat('PER3-S:20')).toBe('hockey');
  });

  it('returns undefined for unrecognized formats', () => {
    expect(sportFromMatchUpFormat('UNKNOWN')).toBeUndefined();
  });
});

describe('resolveCourtSport', () => {
  it('returns undefined for no event', () => {
    expect(resolveCourtSport()).toBeUndefined();
    expect(resolveCourtSport({})).toBeUndefined();
  });

  it('prefers competitionFormat.sport', () => {
    expect(resolveCourtSport({ competitionFormat: { sport: 'TENNIS' } })).toBe('tennis');
    expect(resolveCourtSport({ competitionFormat: { sport: 'PICKLEBALL' } })).toBe('pickleball');
    expect(resolveCourtSport({ competitionFormat: { sport: 'PADEL' } })).toBe('padel');
    expect(resolveCourtSport({ competitionFormat: { sport: 'BADMINTON' } })).toBe('badminton');
  });

  it('falls back to matchUpFormat', () => {
    expect(resolveCourtSport({ matchUpFormat: 'SET3-S:6/TB7' })).toBe('tennis');
    expect(resolveCourtSport({ matchUpFormat: 'HAL4-S:12' })).toBe('basketball');
  });

  it('ignores unrecognized competitionFormat.sport and falls back', () => {
    expect(resolveCourtSport({
      competitionFormat: { sport: 'CRICKET' },
      matchUpFormat: 'SET3-S:6/TB7',
    })).toBe('tennis');
  });
});

describe('COURT_SVG_RESOURCE_SUB_TYPE', () => {
  it('is COURT_SVG', () => {
    expect(COURT_SVG_RESOURCE_SUB_TYPE).toBe('COURT_SVG');
  });
});
