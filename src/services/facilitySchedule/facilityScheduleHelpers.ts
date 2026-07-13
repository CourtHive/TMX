// Pure, dependency-free helpers for the shared-facility overlay. Kept separate from
// facilitySchedule.ts (which imports the factory + api graph) so they unit-test in isolation.

export interface FacilityCourtOccupancy {
  venueId: string;
  courtId: string;
  cells: any[]; // ScheduleCell[] for the date, primary + peers, sorted by the factory merge
}

/** Peer link ids on a record, excluding the record itself (the factory stores self in the list). */
export function peerLinkedIds(record: any): string[] {
  const self = record?.tournamentId;
  return (record?.linkedTournamentIds ?? []).filter((id: string) => id && id !== self);
}

/** Distinct venueIds the primary tournament uses — the shared-court scope for the projection. */
export function primaryVenueIds(record: any): string[] {
  return Array.from(new Set((record?.venues ?? []).map((venue: any) => venue?.venueId).filter(Boolean)));
}

/** Per-court occupancy for a date, restricted to courts that carry at least one PEER cell (a court a
 * linked tournament is using) — the shared-court usage the director must be aware of. Each row keeps
 * ALL cells on that court/date (primary + peer) so the timeline reads in context. */
export function peerOccupancyForDate(grid: any, scheduledDate: string, primaryId: string): FacilityCourtOccupancy[] {
  const rows: FacilityCourtOccupancy[] = [];
  const venues = grid?.venues ?? {};
  for (const venueId of Object.keys(venues)) {
    const courts = venues[venueId]?.courts ?? {};
    for (const courtId of Object.keys(courts)) {
      const cells: any[] = courts[courtId]?.dates?.[scheduledDate] ?? [];
      if (cells.some((cell) => cell?.tournamentId !== primaryId)) rows.push({ venueId, courtId, cells });
    }
  }
  return rows;
}

/** Advisory double-bookings on a given date. */
export function conflictsForDate(grid: any, scheduledDate: string): any[] {
  return (grid?.conflicts ?? []).filter((conflict: any) => conflict?.scheduledDate === scheduledDate);
}

/** Compact display label for a schedule cell. */
export function cellLabel(cell: any): string {
  const time = cell?.scheduledTime ? `${cell.scheduledTime} ` : '';
  const round = cell?.roundName ? `${cell.roundName} ` : '';
  const players = Array.isArray(cell?.labels) && cell.labels.length ? cell.labels.join(' v ') : '';
  return `${time}${round}${players}`.trim() || cell?.matchUpId || '';
}
