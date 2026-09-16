import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMyCalendars } from './fetchMyCalendars';

const getMyCalendars = vi.hoisted(() => vi.fn());

vi.mock('services/apis/servicesApi', () => ({ getMyCalendars }));

function page({ calendars, paging }: { calendars: any[]; paging?: any }) {
  return { data: { calendars, paging } };
}

function tournaments(count: number, prefix: string) {
  return Array.from({ length: count }, (_, i) => ({ tournamentId: `${prefix}-${i}` }));
}

describe('fetchMyCalendars', () => {
  beforeEach(() => getMyCalendars.mockReset());

  it('merges consecutive pages of one calendar in order', async () => {
    getMyCalendars
      .mockResolvedValueOnce(
        page({
          calendars: [{ providerAbbr: 'AAA', tournaments: tournaments(500, 'a') }],
          paging: { total: 700, returned: 500, hasMore: true, limit: 500, offset: 0 },
        }),
      )
      .mockResolvedValueOnce(
        page({
          calendars: [{ providerAbbr: 'AAA', tournaments: tournaments(200, 'b') }],
          paging: { total: 700, returned: 200, hasMore: false, limit: 500, offset: 500 },
        }),
      );

    const result = await fetchMyCalendars({ providerAbbr: 'AAA' });

    expect(result.calendars).toHaveLength(1);
    expect(result.calendars[0].tournaments).toHaveLength(700);
    expect(result).toMatchObject({ total: 700, loaded: 700, truncated: false });
    expect(getMyCalendars).toHaveBeenCalledTimes(2);
    expect(getMyCalendars).toHaveBeenLastCalledWith({ providerAbbr: 'AAA', limit: 500, offset: 500 });
  });

  it('stops at the first page when the server reports no more', async () => {
    getMyCalendars.mockResolvedValueOnce(
      page({
        calendars: [{ providerAbbr: 'AAA', tournaments: tournaments(3, 'a') }],
        paging: { total: 3, returned: 3, hasMore: false, limit: 500, offset: 0 },
      }),
    );

    const result = await fetchMyCalendars({});

    expect(getMyCalendars).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ total: 3, loaded: 3, truncated: false });
  });

  it('takes an unpaged response from an older server as the whole list', async () => {
    getMyCalendars.mockResolvedValueOnce(
      page({ calendars: [{ providerAbbr: 'AAA', tournaments: tournaments(4, 'a') }] }),
    );

    const result = await fetchMyCalendars({});

    expect(getMyCalendars).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ total: 4, loaded: 4, truncated: false });
  });

  it('reports truncation rather than presenting a partial list as complete', async () => {
    getMyCalendars.mockResolvedValue(
      page({
        calendars: [{ providerAbbr: 'AAA', tournaments: tournaments(500, 'a') }],
        paging: { total: 49000, returned: 500, hasMore: true, limit: 500, offset: 0 },
      }),
    );

    const result = await fetchMyCalendars({});

    expect(getMyCalendars).toHaveBeenCalledTimes(20);
    expect(result.truncated).toBe(true);
    expect(result.total).toBe(49000);
    expect(result.loaded).toBe(10000);
  });

  it('terminates when a server claims more but returns nothing', async () => {
    getMyCalendars.mockResolvedValue(
      page({
        calendars: [{ providerAbbr: 'AAA', tournaments: [] }],
        paging: { total: 10, returned: 0, hasMore: true, limit: 500, offset: 0 },
      }),
    );

    const result = await fetchMyCalendars({});

    expect(getMyCalendars).toHaveBeenCalledTimes(1);
    expect(result.loaded).toBe(0);
  });

  it('keeps calendars separate when a page spans two providers', async () => {
    getMyCalendars
      .mockResolvedValueOnce(
        page({
          calendars: [
            { providerAbbr: 'AAA', tournaments: tournaments(2, 'a') },
            { providerAbbr: 'BBB', tournaments: [] },
          ],
          paging: { total: 4, returned: 2, hasMore: true, limit: 2, offset: 0 },
        }),
      )
      .mockResolvedValueOnce(
        page({
          calendars: [
            { providerAbbr: 'AAA', tournaments: [] },
            { providerAbbr: 'BBB', tournaments: tournaments(2, 'b') },
          ],
          paging: { total: 4, returned: 2, hasMore: false, limit: 2, offset: 2 },
        }),
      );

    const result = await fetchMyCalendars({});

    expect(result.calendars).toHaveLength(2);
    expect(result.calendars[0]).toMatchObject({ providerAbbr: 'AAA' });
    expect(result.calendars[0].tournaments).toHaveLength(2);
    expect(result.calendars[1]).toMatchObject({ providerAbbr: 'BBB' });
    expect(result.calendars[1].tournaments).toHaveLength(2);
  });
});
