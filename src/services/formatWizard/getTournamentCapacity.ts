import { competitionEngine, TemporalEngine, tournamentEngine } from 'tods-competition-factory';

export interface TournamentCapacity {
  courtCount: number; // raw sum of courts across venues
  effectiveCourtCount?: number; // per-day average of courts with non-empty availability windows
  hasVenues: boolean;
  hasTemporalInfo: boolean; // tournament has start/end dates AND ≥1 court
  dayCount: number;
}

const EMPTY: TournamentCapacity = {
  courtCount: 0,
  hasVenues: false,
  hasTemporalInfo: false,
  dayCount: 0,
};

function flattenCourts(venues: any[]): Array<{ tournamentId?: string; venueId?: string; courtId: string }> {
  const courts: Array<{ tournamentId?: string; venueId?: string; courtId: string }> = [];
  for (const venue of venues) {
    for (const court of venue?.courts ?? []) {
      courts.push({ tournamentId: venue.tournamentId, venueId: venue.venueId, courtId: court.courtId });
    }
  }
  return courts;
}

// Computes a per-day average of "available" courts using the
// TemporalEngine. A court is available on a day when its resolved
// availability window has startTime < endTime.
function computeEffectiveCourtCount(
  tournamentRecord: any,
  courts: Array<{ tournamentId?: string; venueId?: string; courtId: string }>,
  days: string[],
): number | undefined {
  if (days.length === 0 || courts.length === 0) return undefined;

  const engine = new TemporalEngine();
  engine.init(tournamentRecord);

  let totalAvailable = 0;
  for (const day of days) {
    let availableThisDay = 0;
    for (const court of courts) {
      const ref = {
        tournamentId: court.tournamentId ?? tournamentRecord.tournamentId,
        venueId: court.venueId,
        courtId: court.courtId,
      };
      const avail = engine.getCourtAvailability(ref as any, day);
      if (avail && avail.startTime && avail.endTime && avail.startTime < avail.endTime) {
        availableThisDay++;
      }
    }
    totalAvailable += availableThisDay;
  }
  return totalAvailable / days.length;
}

// Reads the live tournament record and reports the current court
// capacity. The wizard's stale-state cues compare the TD's saved
// `courts` constraint against this number; the temporally-aware
// `effectiveCourtCount` is preferred over the raw `courtCount`
// when both are available.
export function getTournamentCapacity(): TournamentCapacity {
  const tournamentRecord: any = tournamentEngine.getTournament?.()?.tournamentRecord;
  if (!tournamentRecord) return EMPTY;

  const venuesResult: any = competitionEngine.getVenuesAndCourts?.() ?? {};
  const venues: any[] = venuesResult.venues ?? [];
  const courts = flattenCourts(venues);

  const hasDates = !!tournamentRecord.startDate;
  const days: string[] = hasDates && courts.length > 0
    ? safeGetTournamentDays(tournamentRecord)
    : [];

  const effectiveCourtCount = days.length > 0 ? computeEffectiveCourtCount(tournamentRecord, courts, days) : undefined;

  return {
    courtCount: courts.length,
    effectiveCourtCount,
    hasVenues: courts.length > 0,
    hasTemporalInfo: hasDates && courts.length > 0,
    dayCount: days.length,
  };
}

function safeGetTournamentDays(tournamentRecord: any): string[] {
  try {
    const engine = new TemporalEngine();
    engine.init(tournamentRecord);
    return engine.getTournamentDays();
  } catch {
    return [];
  }
}
