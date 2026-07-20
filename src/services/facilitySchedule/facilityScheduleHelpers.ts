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

/**
 * Inject read-only reserved cells (other tournaments' court occupancy, from a schedule projection)
 * into the grid's `rows` model IN PLACE. A reserved cell lands in the empty slot at its court column
 * (`courtId` → index in `courtsData`, keyed `${courtPrefix}${index}`) and its `courtOrder` row
 * (`rows[courtOrder - 1]`). Occupied slots (the viewer's own matchUp) are never overwritten — a
 * SAME_COURT_ORDER clash keeps the owned matchUp and drops the reserved marker. Cells for courts not
 * in this grid, or whose `courtOrder` exceeds the rendered rows, are skipped. Opaque by design: only
 * the scheduled time is surfaced, never participants/round.
 *
 * `courtsData` must be the FULL (pre-visibility-filter) court list, since row keys use those indices.
 */
/** True when the two venue-id lists share at least one venue. Empty either side → no intersection. */
export function venueIdsIntersect(a: string[], b: string[]): boolean {
  if (!a?.length || !b?.length) return false;
  const set = new Set(a);
  return b.some((id) => set.has(id));
}

/**
 * Gate for an opaque `facilityScheduleChanged` event: does it concern a tournament owning these venues?
 * An event with no venue scope is treated as relevant (defensive — the re-fetch re-gates server-side,
 * so at worst we do one extra fetch; missing a real change would strand a reserved cell). Otherwise it
 * must intersect the tournament's venues.
 */
export function facilityEventTouchesVenues(eventVenueIds: string[], ourVenueIds: string[]): boolean {
  if (!eventVenueIds?.length) return true;
  return venueIdsIntersect(eventVenueIds, ourVenueIds);
}

export function mergeReservedCellsIntoRows(
  rows: any[],
  reservedCells: any[],
  courtsData: any[],
  courtPrefix: string,
): void {
  if (!reservedCells?.length || !rows?.length) return;
  const courtIndexById = new Map<string, number>();
  for (let i = 0; i < courtsData.length; i++) courtIndexById.set(courtsData[i].courtId, i);

  for (const cell of reservedCells) {
    const courtIndex = courtIndexById.get(cell?.courtId);
    if (courtIndex === undefined) continue;
    const ri = (cell?.courtOrder ?? 0) - 1;
    if (ri < 0 || ri >= rows.length || !rows[ri]) continue;
    const key = `${courtPrefix}${courtIndex}`;
    // Skip only a slot holding an OWNED matchUp — the grid pre-populates empty slots with placeholder
    // cell objects (no matchUpId), which must be replaceable by a reserved marker.
    if (rows[ri][key]?.matchUpId) continue;
    rows[ri][key] = {
      isReserved: true,
      reservation: { scheduledTime: cell?.scheduledTime },
      schedule: { courtId: cell.courtId, courtOrder: cell.courtOrder, venueId: cell?.venueId },
    };
  }
}
