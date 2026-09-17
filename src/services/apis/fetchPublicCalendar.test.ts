import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicCalendar } from './fetchPublicCalendar';

const getCalendar = vi.hoisted(() => vi.fn());
vi.mock('services/apis/servicesApi', () => ({ getCalendar }));

/**
 * The logged-out tournaments list issued ONE request against a PAGED endpoint. Measured on
 * production the day the server deployed: ALTA served 500 of 967, HTS 500 of 533 — a list
 * that looked complete and was not.
 */

function page({ tournaments, paging, provider = { organisationAbbreviation: 'ALTA' } }: any) {
  return { data: { calendar: { provider, tournaments }, paging } };
}

const rows = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => ({ tournamentId: `${prefix}-${i}` }));

describe('fetchPublicCalendar', () => {
  beforeEach(() => getCalendar.mockReset());

  it('walks every page — the ALTA case, 967 across two requests', async () => {
    getCalendar
      .mockResolvedValueOnce(
        page({ tournaments: rows(500, 'a'), paging: { total: 967, returned: 500, hasMore: true } }),
      )
      .mockResolvedValueOnce(
        page({ tournaments: rows(467, 'b'), paging: { total: 967, returned: 467, hasMore: false } }),
      );

    const result = await fetchPublicCalendar({ providerAbbr: 'ALTA' });

    expect(result.calendar.tournaments).toHaveLength(967);
    expect(result.total).toBe(967);
    expect(result.truncated).toBe(false);
    expect(getCalendar).toHaveBeenLastCalledWith({ providerAbbr: 'ALTA', limit: 500, offset: 500 });
  });

  it('stops at one request when the server says there is no more', async () => {
    getCalendar.mockResolvedValueOnce(
      page({ tournaments: rows(12, 'a'), paging: { total: 12, returned: 12, hasMore: false } }),
    );

    const result = await fetchPublicCalendar({ providerAbbr: 'FTK' });

    expect(result.calendar.tournaments).toHaveLength(12);
    expect(getCalendar).toHaveBeenCalledTimes(1);
  });

  it('takes an UNPAGED response from an older server as the whole list', async () => {
    getCalendar.mockResolvedValueOnce(page({ tournaments: rows(700, 'a'), paging: undefined }));

    const result = await fetchPublicCalendar({ providerAbbr: 'ALTA' });

    expect(result.calendar.tournaments).toHaveLength(700);
    expect(result.total).toBe(700);
    expect(getCalendar).toHaveBeenCalledTimes(1);
  });

  it('reports truncation rather than presenting a partial list as complete', async () => {
    getCalendar.mockResolvedValue(
      page({ tournaments: rows(500, 'a'), paging: { total: 99999, returned: 500, hasMore: true } }),
    );

    const result = await fetchPublicCalendar({ providerAbbr: 'BIG' });

    expect(getCalendar).toHaveBeenCalledTimes(20);
    expect(result.truncated).toBe(true);
    expect(result.total).toBe(99999);
  });

  it('terminates when a server claims more but returns nothing', async () => {
    getCalendar.mockResolvedValue(page({ tournaments: [], paging: { total: 10, returned: 0, hasMore: true } }));

    const result = await fetchPublicCalendar({ providerAbbr: 'ODD' });

    expect(getCalendar).toHaveBeenCalledTimes(1);
    expect(result.calendar.tournaments).toEqual([]);
  });

  it('returns NO calendar when the provider has none, so the caller can fall back', async () => {
    getCalendar.mockResolvedValueOnce({ data: {} });

    const result = await fetchPublicCalendar({ providerAbbr: 'GONE' });

    expect(result.calendar).toBeUndefined();
  });

  it('carries the provider block through from the first page', async () => {
    getCalendar.mockResolvedValueOnce(
      page({ tournaments: rows(1, 'a'), paging: { total: 1, returned: 1, hasMore: false } }),
    );

    const result = await fetchPublicCalendar({ providerAbbr: 'ALTA' });

    expect(result.calendar.provider).toEqual({ organisationAbbreviation: 'ALTA' });
  });
});
