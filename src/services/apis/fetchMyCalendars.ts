import { getMyCalendars } from 'services/apis/servicesApi';

/**
 * Walk every page of `/provider/my-calendars` and merge them into one list.
 *
 * The endpoint used to answer unbounded, and on 2026-09-15 that put 49,000+
 * tournaments into a browser in a single response. It is paged now, so the
 * client has to ask for the rest — but "ask for the rest" has to terminate, and
 * it has to admit when it stopped early rather than presenting a truncated list
 * as the whole one. Hence `truncated`, which the caller is expected to surface.
 */

/** Rows per request. The server clamps to its own ceiling regardless. */
const CALENDAR_PAGE_SIZE = 500;

/** Stop here. 20 x 500 = 10,000 rows, well past any real provider calendar. */
const MAX_CALENDAR_PAGES = 20;

export interface MyCalendarsResult {
  calendars: any[];
  /** Total the server reports it could serve, across every target calendar. */
  total: number;
  /** How many rows this result actually holds. */
  loaded: number;
  /** True when the page cap stopped the walk before the server ran out. */
  truncated: boolean;
}

export async function fetchMyCalendars({ providerAbbr }: { providerAbbr?: string } = {}): Promise<MyCalendarsResult> {
  const byProviderAbbr = new Map<string, any>();
  let total = 0;
  let loaded = 0;
  let offset = 0;
  let truncated = false;

  for (let page = 0; page < MAX_CALENDAR_PAGES; page++) {
    const response: any = await getMyCalendars({ providerAbbr, limit: CALENDAR_PAGE_SIZE, offset });
    const calendars = response?.data?.calendars ?? [];
    const paging = response?.data?.paging;

    for (const calendar of calendars) {
      const key = calendar?.providerAbbr ?? '';
      const tournaments = calendar?.tournaments ?? [];
      const merged = byProviderAbbr.get(key);
      if (merged) merged.tournaments.push(...tournaments);
      else byProviderAbbr.set(key, { ...calendar, tournaments: [...tournaments] });
      loaded += tournaments.length;
    }

    // A server that predates paging answers in full and reports none. Take the
    // single response as the whole list rather than re-requesting it forever —
    // TMX must stay deployable ahead of the server.
    if (!paging) {
      total = loaded;
      break;
    }

    total = paging.total ?? loaded;
    // `returned: 0` with `hasMore: true` would be a server bug; treat no
    // progress as the end rather than spinning.
    if (!paging.hasMore || !paging.returned) break;

    offset += paging.returned;
    if (page === MAX_CALENDAR_PAGES - 1) truncated = true;
  }

  return { calendars: [...byProviderAbbr.values()], total, loaded, truncated };
}
