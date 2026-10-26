/**
 * Transit between venues — the pure model behind the venues tab's Transit view.
 *
 * Mirrors the factory's rule (scheduling-pipeline.md § 3.4): the minutes from one venue to another are the stated minutes
 * for that direction (a pair stated once applies both ways, a one-way value only its way; where several apply, the
 * greatest); none between venues that share a facilityId (one physical place); else the scheduling policy's
 * `defaultTimes.transitMinutes`; with no policy stating it, none. Read straight from the record so the view needs no
 * engine query, and kept free of the DOM so it is unit-tested.
 */

export type TransitEntry = {
  venueIds: [string, string];
  minutes: number;
  oneWay?: boolean;
  sanctioned?: { minutes: number; sanctioningId?: string };
};

export type TransitVenue = {
  venueId: string;
  name: string;
  abbreviation?: string;
  facilityId?: string;
  latitude?: number;
  longitude?: number;
};

/** where a direction's minutes come from: what the view styles an edge or a cell by */
export type TransitSource = 'stated' | 'sanctioned' | 'default' | 'facility' | 'none';

export type DirectedTransit = {
  minutes: number;
  source: TransitSource;
  /** the entry that states it, when one does: what an edit or a removal acts on */
  entry?: TransitEntry;
};

export type TransitInputs = {
  venues: TransitVenue[];
  entries: TransitEntry[];
  defaultMinutes?: number;
};

/** the entries that state a direction: a symmetric pair naming both venues, or a one-way pair from → to */
function statingEntries(entries: TransitEntry[], from: string, to: string): TransitEntry[] {
  return entries.filter(({ venueIds: [a, b], oneWay }) =>
    oneWay ? a === from && b === to : (a === from && b === to) || (a === to && b === from),
  );
}

/** the minutes from one venue to another, and where they come from */
export function directedTransit(
  { venues, entries, defaultMinutes }: TransitInputs,
  from: string,
  to: string,
): DirectedTransit {
  if (from === to) return { minutes: 0, source: 'none' };
  const stating = statingEntries(entries, from, to);
  if (stating.length) {
    const entry = stating.reduce((greatest, candidate) =>
      candidate.minutes > greatest.minutes ? candidate : greatest,
    );
    return { minutes: entry.minutes, source: entry.sanctioned ? 'sanctioned' : 'stated', entry };
  }
  const facilityOf = (venueId: string) => venues.find((venue) => venue.venueId === venueId)?.facilityId;
  const facility = facilityOf(from);
  if (facility && facility === facilityOf(to)) return { minutes: 0, source: 'facility' };
  if (typeof defaultMinutes === 'number') return { minutes: defaultMinutes, source: 'default' };
  return { minutes: 0, source: 'none' };
}

export type TransitEdge = {
  from: string;
  to: string;
  forward: DirectedTransit;
  back: DirectedTransit;
  /** both directions alike: drawn as one line, else as two arrows */
  symmetric: boolean;
};

/** one edge per pair of venues, each with both directions */
export function transitEdges(inputs: TransitInputs): TransitEdge[] {
  const edges: TransitEdge[] = [];
  const { venues } = inputs;
  for (let i = 0; i < venues.length; i++) {
    for (let j = i + 1; j < venues.length; j++) {
      const from = venues[i].venueId;
      const to = venues[j].venueId;
      const forward = directedTransit(inputs, from, to);
      const back = directedTransit(inputs, to, from);
      edges.push({
        from,
        to,
        forward,
        back,
        symmetric: forward.minutes === back.minutes && forward.source === back.source,
      });
    }
  }
  return edges;
}

export type Point = { x: number; y: number };

/**
 * Where each venue sits in a width × height box. With two or more venues located, their coordinates are projected
 * (equirectangular, fine at a city's scale) and fitted to the box; the rest, and every venue when fewer are located, sit
 * on a circle. Venues sharing a facility are drawn close together, a cluster around their shared point.
 */
export function layoutVenues(
  venues: TransitVenue[],
  width: number,
  height: number,
  padding = 48,
): Record<string, Point> {
  const positions: Record<string, Point> = {};
  const located = venues.filter(({ latitude, longitude }) => Number.isFinite(latitude) && Number.isFinite(longitude));
  const centre = { x: width / 2, y: height / 2 };
  const radius = Math.max(10, Math.min(width, height) / 2 - padding);

  if (located.length >= 2) {
    const meanLatitude = located.reduce((sum, { latitude }) => sum + (latitude as number), 0) / located.length;
    const scaleX = Math.cos((meanLatitude * Math.PI) / 180);
    const xs = located.map(({ longitude }) => (longitude as number) * scaleX);
    const ys = located.map(({ latitude }) => -(latitude as number));
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const span = Math.max(maxX - minX, maxY - minY) || 1;
    const scale = (Math.min(width, height) - 2 * padding) / span;
    const offsetX = (width - (maxX - minX) * scale) / 2;
    const offsetY = (height - (maxY - minY) * scale) / 2;
    located.forEach((venue, index) => {
      positions[venue.venueId] = { x: offsetX + (xs[index] - minX) * scale, y: offsetY + (ys[index] - minY) * scale };
    });
  }

  const unplaced = venues.filter((venue) => !positions[venue.venueId]);
  unplaced.forEach((venue, index) => {
    const angle = (2 * Math.PI * index) / Math.max(1, unplaced.length) - Math.PI / 2;
    positions[venue.venueId] =
      unplaced.length === 1 && !located.length
        ? { ...centre }
        : { x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) };
  });

  return clusterFacilities(venues, positions);
}

/** venues of one facility gather around their mean point, a small ring apart, so the cluster reads as one place */
function clusterFacilities(venues: TransitVenue[], positions: Record<string, Point>): Record<string, Point> {
  const byFacility = new Map<string, TransitVenue[]>();
  for (const venue of venues) {
    if (!venue.facilityId) continue;
    byFacility.set(venue.facilityId, [...(byFacility.get(venue.facilityId) ?? []), venue]);
  }
  for (const members of byFacility.values()) {
    if (members.length < 2) continue;
    const mean = members.reduce(
      (sum, { venueId }) => ({
        x: sum.x + positions[venueId].x / members.length,
        y: sum.y + positions[venueId].y / members.length,
      }),
      { x: 0, y: 0 },
    );
    const ring = 26;
    members.forEach(({ venueId }, index) => {
      const angle = (2 * Math.PI * index) / members.length;
      positions[venueId] = { x: mean.x + ring * Math.cos(angle), y: mean.y + ring * Math.sin(angle) };
    });
  }
  return positions;
}

export type TransitValidation =
  { minutes: number; error?: undefined } | { minutes?: undefined; error: TransitInputError };
export type TransitInputError = 'notWhole' | 'belowSanctioned';

/** a typed value is whole, non-negative minutes, and never below a sanctioned floor */
export function validateTransitMinutes(value: string, sanctionedMinutes?: number): TransitValidation {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return { error: 'notWhole' };
  const minutes = Number(trimmed);
  if (typeof sanctionedMinutes === 'number' && minutes < sanctionedMinutes) return { error: 'belowSanctioned' };
  return { minutes };
}

/** minutes as a compact label: 45 → "45m", 75 → "1h 15m", 120 → "2h" */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** the record's venues and transit, in the shape the view reads (no engine query, so it works on any factory) */
export function transitInputsFromRecord(tournamentRecord: any, defaultMinutes?: number): TransitInputs {
  const venues: TransitVenue[] = (tournamentRecord?.venues ?? []).map((venue: any) => {
    const address = venue.addresses?.[0] ?? {};
    const latitude = Number(address.latitude);
    const longitude = Number(address.longitude);
    return {
      venueId: venue.venueId,
      name: venue.venueName ?? venue.venueId,
      abbreviation: venue.venueAbbreviation,
      facilityId: venue.facilityId,
      ...(address.latitude !== undefined && Number.isFinite(latitude) ? { latitude } : {}),
      ...(address.longitude !== undefined && Number.isFinite(longitude) ? { longitude } : {}),
    };
  });
  const entries: TransitEntry[] = tournamentRecord?.scheduling?.venueTransits ?? [];
  return { venues, entries, defaultMinutes };
}

/** the scheduling policy's default transit, as the factory reads it (absent: no policy states one) */
export function policyDefaultTransitMinutes(appliedPolicies: any): number | undefined {
  const stated = appliedPolicies?.scheduling?.defaultTimes?.transitMinutes;
  return typeof stated === 'number' ? stated : undefined;
}
