/**
 * Schedule 2 — the Profile view's round catalog, built from the factory's `getRounds`.
 *
 * Each round becomes a `CatalogRoundItem` for the courthive-components Scheduling Profile. A round's
 * `playingDates` pass through as `getRounds` gives them: present only when the event's own dates (range,
 * active dates, weekdays) narrow the tournament's, and then (even when empty) the only dates the event plays.
 * With them the component hides the round on a selected date its event does not play (unless the round is
 * already placed somewhere) and warns `EVENT_DATE_INACTIVE` about a round planned on such a date. Absent, the
 * round plays every date, as before.
 *
 * Pure: the caller passes the rounds.
 */
import type { CatalogRoundItem } from 'courthive-components';

const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

export function profileRoundCatalog(rounds: any[], fallbackTournamentId = ''): CatalogRoundItem[] {
  return (rounds ?? []).map((r: any) => {
    // Prefer structureName (e.g. "Main Draw", "Consolation"); fall back to drawName only if it's not a UUID
    const isUUID = UUID_PREFIX.test(r.drawName || '');
    const drawName = r.structureName || (isUUID ? '' : r.drawName) || '';

    // Build a human-readable round name from matchUps if factory gives raw format
    const rawRound = r.roundName || '';
    const roundName = rawRound.startsWith('rn=')
      ? r.matchUps?.[0]?.roundName || `Round ${r.roundNumber}`
      : rawRound || `Round ${r.roundNumber}`;

    const item: CatalogRoundItem = {
      tournamentId: r.tournamentId || fallbackTournamentId,
      eventId: r.eventId,
      eventName: r.eventName || '',
      drawId: r.drawId,
      drawName,
      structureId: r.structureId,
      roundNumber: r.roundNumber,
      roundName,
      matchCountEstimate: r.matchUpsCount,
    };
    if (Array.isArray(r.playingDates)) item.playingDates = [...r.playingDates];
    return item;
  });
}
