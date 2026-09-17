import { getCalendar } from 'services/apis/servicesApi';

/**
 * Walk every page of a provider's PUBLIC calendar and merge them.
 *
 * `/provider/calendar` is paged (competition-factory-server #974), defaulting to 500 entries.
 * The logged-out tournaments list issued a single request and rendered whatever came back, so
 * once that server deployed, providers larger than one page silently lost rows — measured on
 * production: ALTA served 500 of 967, HTS 500 of 533.
 *
 * `fetchMyCalendars` does the same for the AUTHENTICATED list. This is its public twin;
 * kept separate because the two endpoints differ in shape — `my-calendars` returns an array
 * of per-provider calendars, this returns one.
 */

/** Rows per request. The server clamps to its own ceiling regardless. */
const CALENDAR_PAGE_SIZE = 500;

/** Stop here. 20 x 500 = 10,000 rows, well past any real provider calendar. */
const MAX_CALENDAR_PAGES = 20;

export interface PublicCalendarResult {
  calendar: any | undefined;
  /** Total the server reports it could serve. */
  total: number;
  /** True when the page cap stopped the walk before the server ran out. */
  truncated: boolean;
}

export async function fetchPublicCalendar({ providerAbbr }: { providerAbbr: string }): Promise<PublicCalendarResult> {
  const tournaments: any[] = [];
  let provider: any;
  let seenCalendar = false;
  let total = 0;
  let offset = 0;
  let truncated = false;

  for (let page = 0; page < MAX_CALENDAR_PAGES; page++) {
    const response: any = await getCalendar({ providerAbbr, limit: CALENDAR_PAGE_SIZE, offset });
    const calendar = response?.data?.calendar;
    if (!calendar) break;

    seenCalendar = true;
    provider ??= calendar.provider;
    tournaments.push(...(calendar.tournaments ?? []));

    const paging = response?.data?.paging;
    // A server that predates paging answers in full and reports none — take the single
    // response as the whole list rather than re-requesting it forever. TMX must stay
    // deployable ahead of the server.
    if (!paging) {
      total = tournaments.length;
      break;
    }

    total = paging.total ?? tournaments.length;
    // `returned: 0` with `hasMore: true` would be a server bug; treat no progress as the end.
    if (!paging.hasMore || !paging.returned) break;

    offset += paging.returned;
    if (page === MAX_CALENDAR_PAGES - 1) truncated = true;
  }

  return { calendar: seenCalendar ? { provider, tournaments } : undefined, total, truncated };
}
