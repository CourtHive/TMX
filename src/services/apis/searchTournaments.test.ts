import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSearchQueryString, searchTournaments } from './searchTournaments';

const getTournamentSearch = vi.hoisted(() => vi.fn());
vi.mock('services/apis/servicesApi', () => ({ getTournamentSearch }));

/**
 * The tournaments page used to filter only the rows it had already loaded. Against a paged list
 * that is a lie with a confident count on it — ALTA served 500 of 967 on 2026-09-17. These tests
 * pin the two properties that make the replacement honest: every page is walked, and the number
 * reported is the SERVER's total rather than whatever happened to arrive.
 */

function page({ tournaments, paging }: any) {
  return { data: { tournaments, paging } };
}

const hits = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => ({ tournamentId: `${prefix}-${i}`, tournamentName: `${prefix} ${i}` }));

describe('searchTournaments', () => {
  beforeEach(() => getTournamentSearch.mockReset());

  it('walks every page — the ALTA case, 967 hits across ten requests', async () => {
    for (let i = 0; i < 9; i++) {
      getTournamentSearch.mockResolvedValueOnce(
        page({ tournaments: hits(100, `p${i}`), paging: { total: 967, returned: 100, hasMore: true } }),
      );
    }
    getTournamentSearch.mockResolvedValueOnce(
      page({ tournaments: hits(67, 'last'), paging: { total: 967, returned: 67, hasMore: false } }),
    );

    const result = await searchTournaments({ providerId: 'alta-id' });

    expect(getTournamentSearch).toHaveBeenCalledTimes(10);
    expect(result.tournaments).toHaveLength(967);
    expect(result.total).toBe(967);
    expect(result.truncated).toBe(false);
  });

  it('advances the offset by what the server actually returned', async () => {
    getTournamentSearch
      .mockResolvedValueOnce(
        page({ tournaments: hits(100, 'a'), paging: { total: 150, returned: 100, hasMore: true } }),
      )
      .mockResolvedValueOnce(
        page({ tournaments: hits(50, 'b'), paging: { total: 150, returned: 50, hasMore: false } }),
      );

    await searchTournaments({ q: 'open' });

    expect(getTournamentSearch.mock.calls[0][0]).toContain('offset=0');
    expect(getTournamentSearch.mock.calls[1][0]).toContain('offset=100');
  });

  it('reports the SERVER total, not the number of rows it loaded', async () => {
    getTournamentSearch.mockResolvedValueOnce(
      page({ tournaments: hits(100, 'a'), paging: { total: 4_212, returned: 100, hasMore: false } }),
    );

    const result = await searchTournaments({ q: 'spring' });

    expect(result.tournaments).toHaveLength(100);
    expect(result.total).toBe(4_212); // the honest denominator
  });

  it('treats a response with NO paging block as the whole list, so TMX can deploy first', async () => {
    getTournamentSearch.mockResolvedValue(page({ tournaments: hits(3, 'only') }));

    const result = await searchTournaments({ q: 'open' });

    expect(getTournamentSearch).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(3);
    expect(result.truncated).toBe(false);
  });

  it('stops when a page reports hasMore with no progress, rather than looping to the cap', async () => {
    getTournamentSearch.mockResolvedValue(page({ tournaments: [], paging: { total: 99, returned: 0, hasMore: true } }));

    const result = await searchTournaments({ q: 'open' });

    expect(getTournamentSearch).toHaveBeenCalledTimes(1);
    expect(result.tournaments).toHaveLength(0);
  });

  it('says so when the page cap stops the walk early', async () => {
    getTournamentSearch.mockResolvedValue(
      page({ tournaments: hits(100, 'x'), paging: { total: 10_000, returned: 100, hasMore: true } }),
    );

    const result = await searchTournaments({ q: 'a' });

    expect(getTournamentSearch).toHaveBeenCalledTimes(20); // MAX_SEARCH_PAGES
    expect(result.tournaments).toHaveLength(2_000);
    expect(result.truncated).toBe(true);
  });

  it('does not throw on a response that is not a result set', async () => {
    getTournamentSearch.mockResolvedValueOnce({ data: { error: 'nope' } });

    const result = await searchTournaments({ q: 'open' });

    expect(result).toEqual({ tournaments: [], total: 0, truncated: false });
  });

  it('propagates a rejection rather than reporting an empty result set', async () => {
    getTournamentSearch.mockRejectedValueOnce(new Error('network'));
    // An empty list and a failed request must not look the same to the caller: the caller falls
    // back to local filtering on an error, and would silently render "no matches" otherwise.
    await expect(searchTournaments({ q: 'open' })).rejects.toThrow('network');
  });
});

describe('buildSearchQueryString', () => {
  it('always bounds the request', () => {
    const search = buildSearchQueryString({}, { limit: 100, offset: 0 });
    expect(search).toContain('limit=100');
    expect(search).toContain('offset=0');
  });

  it('adds a parameter only for the facets supplied', () => {
    const none = buildSearchQueryString({}, { limit: 100, offset: 0 });
    expect(none).not.toContain('providerId');
    expect(none).not.toContain('genders');

    const some = buildSearchQueryString({ providerId: 'p-1', genders: ['MALE'] }, { limit: 100, offset: 0 });
    expect(some).toContain('providerId=p-1');
    expect(some).toContain('genders=MALE');
    expect(some).not.toContain('ageCodes');
  });

  it('sends array facets as CSV', () => {
    const search = buildSearchQueryString({ ageCodes: ['U12', 'U14'] }, { limit: 100, offset: 0 });
    expect(decodeURIComponent(search)).toContain('ageCodes=U12,U14');
  });

  it('treats a blank or whitespace-only value as NO filter', () => {
    const search = buildSearchQueryString({ q: '   ', providerId: '' }, { limit: 100, offset: 0 });
    expect(search).not.toContain('q=');
    expect(search).not.toContain('providerId');
  });

  it('trims a query the user padded, so " open " and "open" are one request', () => {
    expect(buildSearchQueryString({ q: '  open  ' }, { limit: 100, offset: 0 })).toContain('q=open&');
  });

  it('encodes a value that would otherwise break the query string', () => {
    const search = buildSearchQueryString({ q: 'A&B Open #1' }, { limit: 100, offset: 0 });
    expect(search).not.toContain('A&B');
    expect(new URLSearchParams(search).get('q')).toBe('A&B Open #1');
  });

  it('sends excludeCancelled only when asked — cancelled is struck through, not dropped', () => {
    expect(buildSearchQueryString({}, { limit: 100, offset: 0 })).not.toContain('excludeCancelled');
    expect(buildSearchQueryString({ excludeCancelled: true }, { limit: 100, offset: 0 })).toContain(
      'excludeCancelled=true',
    );
  });
});
