import { describe, expect, it } from 'vitest';
import { mapTournament } from './mapTournament';

const START = '2025-01-01';
const END = '2025-01-02';

describe('mapTournament', () => {
  it('maps basic tournament fields', () => {
    const input = {
      tuid: 'abc123',
      tournamentName: 'US Open',
      start: '2025-08-25',
      end: '2025-09-07',
      category: 'Grand Slam',
    };
    const result = mapTournament(input);

    expect(result.tournamentId).toBe('abc123');
    expect(result.category).toBe('Grand Slam');
    expect(result.searchText).toBe('us open');
    expect(result.tournament.tournamentName).toBe('US Open');
    expect(result.tournament.startDate).toBe('2025-08-25');
    expect(result.tournament.endDate).toBe('2025-09-07');
  });

  it('extracts media from publishing.logo', () => {
    const input = {
      tuid: 'x',
      tournamentName: 'Test',
      start: START,
      end: END,
      publishing: { logo: 'https://example.com/logo.png' },
    };
    expect(mapTournament(input).tournament.media).toBe('https://example.com/logo.png');
  });

  it('handles missing publishing', () => {
    const input = {
      tuid: 'x',
      tournamentName: 'Test',
      start: START,
      end: END,
    };
    expect(mapTournament(input).tournament.media).toBeUndefined();
  });

  it('search text defaults to Error when name is missing', () => {
    const input = { tuid: 'x', start: START, end: END };
    expect(mapTournament(input).searchText).toBe('Error');
  });
});
