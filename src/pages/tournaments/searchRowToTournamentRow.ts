import { TournamentSearchHit } from 'services/apis/searchTournaments';
import { mapTournamentRecord, TournamentRow } from './mapTournamentRecord';
import { searchHitToRecord } from './searchHitToRecord';

/**
 * A SEARCH hit as a rendered row — through `mapTournamentRecord`, the SAME mapper the calendar
 * path uses. One mapper, one card, two sources; the translation itself is `searchHitToRecord`.
 *
 * This file is deliberately three lines of glue: it imports `courthive-components` (transitively,
 * via the mapper), which needs a DOM, so it is covered by the Playwright journey rather than by a
 * node unit test asserting against a stubbed mapper.
 */
export function searchRowToTournamentRow(hit: TournamentSearchHit): TournamentRow {
  const row = mapTournamentRecord(searchHitToRecord(hit));
  // `mapTournamentToCardData` counts an `events` array it cannot have here. The projection carries
  // the count itself, so set it rather than fabricating events to be counted.
  if (hit.eventCount) row.tournament.eventCount = hit.eventCount;
  return row;
}
