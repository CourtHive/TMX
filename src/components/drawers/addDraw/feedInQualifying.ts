import { tournamentEngine } from 'services/factory/engine';

type FeedInQualifyingQuery = (params: { drawSize: number }) => { qualifyingPositions?: number[] };

/** The factory's FEED_IN qualifying query. A factory without it builds a FEED_IN qualifying as single
 *  elimination, so TMX offers FEED_IN for qualifying only where this is present. Cast because the typed
 *  engine boundary lists only the methods of the factory TMX is pinned to. */
function feedInQualifyingQuery(): FeedInQualifyingQuery | undefined {
  const query = (tournamentEngine as unknown as Record<string, unknown>).getFeedInQualifyingPositions;
  return typeof query === 'function' ? (query as FeedInQualifyingQuery) : undefined;
}

export function feedInQualifyingSupported(): boolean {
  return !!feedInQualifyingQuery();
}

/** The qualifier counts a FEED_IN (staggered entry) qualifying of `drawSize` positions can produce:
 *  12 → [1, 2, 3, 4, 6], 13 → [1], 10 → [1, 2, 5]. Undefined when the factory cannot build one. */
export function feedInQualifierCounts(drawSize: number): number[] | undefined {
  return feedInQualifyingQuery()?.({ drawSize })?.qualifyingPositions;
}
