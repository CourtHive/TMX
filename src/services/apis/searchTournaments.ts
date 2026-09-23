import { getTournamentSearch } from 'services/apis/servicesApi';

/**
 * PUBLIC tournament SEARCH, served by courthive-query rather than CFS.
 *
 * WHY THIS EXISTS. The tournaments page filters CLIENT-SIDE, over whatever the calendar walk
 * happened to load (`tournamentsFilter.ts`). That is correct for a list that fits in memory and a
 * LIE for one that does not: the box searches the rows you have, reports a confident count, and
 * never mentions the rows it never saw. The same shape cost us a real incident on 2026-09-17, when
 * ALTA's public listing served 500 of its 967 tournaments for about an hour.
 *
 * `GET /tournaments/search` searches the whole published corpus instead — 49,749 tournaments as of
 * the 2026-09-23 projection rebuild, against the 967 ALTA alone has. The gate is a SQL predicate
 * (`t.published = true`), so this endpoint needs no auth and can never serve an unpublished
 * tournament; see `courthive-query/src/modules/query/searchQuery.ts`, which is the contract.
 *
 * Paged like `fetchPublicCalendar` and for the same reason — and, like it, a response with NO
 * `paging` block is treated as the whole list, so TMX stays deployable ahead of the query service.
 */

/**
 * Rows per request. This is the endpoint's OWN ceiling (`SEARCH_MAX_LIMIT`), and it clamps
 * silently rather than erroring — so asking for more would not fail, it would just make the
 * request a lie about what we expect back.
 */
const SEARCH_PAGE_SIZE = 100;

/** Stop here. 20 x 100 = 2,000 hits, far past what anyone reads out of a search box. */
const MAX_SEARCH_PAGES = 20;

export interface TournamentSearchParams {
  /** Substring of the tournament name, matched case-insensitively (trigram-indexed). */
  q?: string;
  /** The provider's `organisationId` — NOT its abbreviation. Calendar responses carry it. */
  providerId?: string;
  /** ISO calendar days, compared against the tournament's start date. */
  startAfter?: string;
  startBefore?: string;
  /** "still open for entries as of this instant" */
  entriesCloseAfter?: string;
  levelSystem?: string;
  levelValue?: string;
  genders?: string[];
  ageCodes?: string[];
  categoryTypes?: string[];
  /** A cancelled tournament is struck through rather than dropped, so it is included by default. */
  excludeCancelled?: boolean;
}

/**
 * One hit. This is the DISCOVERY projection's shape, not a TODS record: flat, and deliberately
 * narrower than a tournament record. `searchRowToTournamentRow` adapts it for the card/table.
 */
export interface TournamentSearchHit {
  tournamentId: string;
  tournamentName: string;
  providerId: string | null;
  startDate: string | null;
  endDate: string | null;
  venueName: string | null;
  city: string | null;
  state: string | null;
  countryCode: string | null;
  levelSystem: string | null;
  levelValue: string | null;
  entriesOpen: string | null;
  entriesClose: string | null;
  feeMin: string | null;
  feeMax: string | null;
  feeCurrency: string | null;
  /** MINOR or MAJOR. A fee without it is rendered as unknown rather than guessed at. */
  feeUnit: string | null;
  eventCount: number;
  cancelledAt: string | null;
}

export interface TournamentSearchResult {
  tournaments: TournamentSearchHit[];
  /** What the server says it COULD serve — the honest denominator, not `tournaments.length`. */
  total: number;
  /** True when the page cap stopped the walk before the server ran out. */
  truncated: boolean;
}

/** CSV facets: `?genders=MALE,FEMALE`. An empty array is no filter, never a filter matching nothing. */
function appendCsv(query: URLSearchParams, key: string, values?: string[]): void {
  const present = values?.filter(Boolean);
  if (present?.length) query.set(key, present.join(','));
}

/**
 * The query string, built as a pure function so the encoding is testable without a network.
 *
 * Only supplied values become parameters. An empty or whitespace-only value is NO filter — the
 * server reads a blank `q` the same way, but sending it would still be a request that says
 * something we do not mean.
 */
export function buildSearchQueryString(
  params: TournamentSearchParams,
  { limit, offset }: { limit: number; offset: number },
): string {
  const query = new URLSearchParams();
  const scalars: Array<[string, string | undefined]> = [
    ['q', params.q],
    ['providerId', params.providerId],
    ['startAfter', params.startAfter],
    ['startBefore', params.startBefore],
    ['entriesCloseAfter', params.entriesCloseAfter],
    ['levelSystem', params.levelSystem],
    ['levelValue', params.levelValue],
  ];
  for (const [key, value] of scalars) {
    const trimmed = value?.trim();
    if (trimmed) query.set(key, trimmed);
  }
  appendCsv(query, 'genders', params.genders);
  appendCsv(query, 'ageCodes', params.ageCodes);
  appendCsv(query, 'categoryTypes', params.categoryTypes);
  if (params.excludeCancelled) query.set('excludeCancelled', 'true');
  query.set('limit', String(limit));
  query.set('offset', String(offset));
  return `?${query.toString()}`;
}

export async function searchTournaments(params: TournamentSearchParams): Promise<TournamentSearchResult> {
  const tournaments: TournamentSearchHit[] = [];
  let total = 0;
  let offset = 0;
  let truncated = false;

  for (let page = 0; page < MAX_SEARCH_PAGES; page++) {
    const search = buildSearchQueryString(params, { limit: SEARCH_PAGE_SIZE, offset });
    const response: any = await getTournamentSearch(search);
    const hits = response?.data?.tournaments;
    if (!Array.isArray(hits)) break;

    tournaments.push(...hits);

    const paging = response?.data?.paging;
    // A query service that predates paging would answer in full and report none. Take the single
    // response as the whole list rather than re-requesting it forever.
    if (!paging) {
      total = tournaments.length;
      break;
    }

    total = paging.total ?? tournaments.length;
    // `returned: 0` with `hasMore: true` would be a server bug; treat no progress as the end
    // rather than looping until the page cap.
    if (!paging.hasMore || !paging.returned) break;

    offset += paging.returned;
    if (page === MAX_SEARCH_PAGES - 1) truncated = true;
  }

  return { tournaments, total, truncated };
}
