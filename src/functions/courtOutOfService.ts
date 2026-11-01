/**
 * Courts and venues out of service — the pure decisions behind the venue and court actions and the
 * schedule grid: is a court out of service on a date, which matchUps sit on it, which methods take it
 * out or put it back, and whether a placement lands on it.
 *
 * The factory stores the state as `disabled` on the court or venue: `true` for every date, or
 * `{ dates: [...] }` for a court taken out on some dates only. Records written before the first-class
 * attribute carry it as a `disabled` extension instead; both are read here.
 *
 * Nothing is moved: a matchUp already on a court that goes out of service keeps its placement, and the
 * confirmation names it so the director can move it deliberately.
 */
import { factoryConstants } from 'tods-competition-factory';

// constants
import { DISABLE_COURTS, DISABLE_VENUES, ENABLE_COURTS, ENABLE_VENUES } from 'constants/mutationConstants';

const { completedMatchUpStatuses } = factoryConstants;
const COMPLETED_STATUSES = new Set<string>(completedMatchUpStatuses);
const DISABLED = 'disabled';

export type CourtServiceState = {
  /** the court itself is out of service on every date */
  allDates: boolean;
  /** dates on which the court alone is out of service (empty when `allDates`) */
  dates: string[];
  /** the court's venue is out of service, which takes every court in it out on every date */
  venueOutOfService: boolean;
};

/** The stored `disabled` value: first-class attribute first, then the legacy extension. */
export function readDisabled(element: any): any {
  if (element?.disabled !== undefined) return element.disabled;
  return element?.extensions?.find((extension: any) => extension?.name === DISABLED)?.value;
}

export function isVenueOutOfService(venue: any): boolean {
  return !!readDisabled(venue);
}

export function courtServiceState({ court, venue }: { court: any; venue?: any }): CourtServiceState {
  const value = readDisabled(court);
  const allDates = value === true;
  const dates: string[] = !allDates && Array.isArray(value?.dates) ? value.dates : [];
  return { allDates, dates, venueOutOfService: isVenueOutOfService(venue) };
}

/** Out of service on `date`: the court on every date, the court on that date, or its venue. */
export function isCourtOutOfService({ court, venue, date }: { court: any; venue?: any; date?: string }): boolean {
  const state = courtServiceState({ court, venue });
  if (state.venueOutOfService || state.allDates) return true;
  return !!date && state.dates.includes(date);
}

/** The court is out of service on at least one date (or its venue is): the popover offers Return to service. */
export function isCourtOutOfServiceAnyDate({ court, venue }: { court: any; venue?: any }): boolean {
  const state = courtServiceState({ court, venue });
  return state.venueOutOfService || state.allDates || state.dates.length > 0;
}

/**
 * The ids of the courts out of service on `date`. `courts` are the grid's court data (each carries its
 * `venueId`); `venues` supply the venue-level flag.
 */
export function outOfServiceCourtIds({
  courts,
  venues,
  date,
}: {
  courts?: any[];
  venues?: any[];
  date?: string;
}): Set<string> {
  const venueById = new Map((venues ?? []).map((venue: any) => [venue.venueId, venue]));
  const ids = new Set<string>();
  for (const court of courts ?? []) {
    const venue = venueById.get(court?.venueId);
    if (court?.courtId && isCourtOutOfService({ court, venue, date })) ids.add(court.courtId);
  }
  return ids;
}

function isCompleted(matchUp: any): boolean {
  return !!matchUp?.winningSide || COMPLETED_STATUSES.has(matchUp?.matchUpStatus);
}

/**
 * The unfinished matchUps placed on any of `courtIds` — on `date` when given, on every date otherwise —
 * ordered by date, then court order. These are what the confirmation lists; none of them is moved.
 */
export function matchUpsOnCourts({
  matchUps,
  courtIds,
  date,
}: {
  matchUps: any[];
  courtIds: string[];
  date?: string;
}): any[] {
  const wanted = new Set(courtIds);
  return (matchUps ?? [])
    .filter((matchUp: any) => {
      const schedule = matchUp?.schedule;
      if (!schedule?.courtId || !wanted.has(schedule.courtId)) return false;
      if (date && schedule.scheduledDate !== date) return false;
      return !isCompleted(matchUp);
    })
    .sort((a: any, b: any) => {
      const byDate = (a.schedule.scheduledDate ?? '').localeCompare(b.schedule.scheduledDate ?? '');
      if (byDate) return byDate;
      return (Number(a.schedule.courtOrder) || 0) - (Number(b.schedule.courtOrder) || 0);
    });
}

/** One readable line per listed matchUp: event and round, the sides, and when it is placed. */
export function describeMatchUpOnCourt(matchUp: any): string {
  const names = (matchUp?.sides ?? [])
    .map((side: any) => side?.participant?.participantName ?? side?.participantName)
    .filter(Boolean);
  const title = [matchUp?.eventName, matchUp?.roundName].filter(Boolean).join(' ');
  const sides = names.join(' v ');
  const schedule = matchUp?.schedule ?? {};
  const when = [schedule.scheduledDate, schedule.courtName].filter(Boolean).join(' · ');
  return [title, sides, when].filter(Boolean).join(' — ');
}

/**
 * `date` scopes the change to that date; without it the court is out of service on every date.
 *
 * The factory REPLACES a court's out-of-service dates rather than adding to them, so a dated change
 * carries the court's `existingDates` forward: taking a court out on a second date must not silently
 * return it to service on the first.
 */
export function buildCourtsOutOfServiceMethods({
  courtIds,
  date,
  existingDates = [],
}: {
  courtIds: string[];
  date?: string;
  existingDates?: string[];
}): any[] {
  if (!date) return [{ method: DISABLE_COURTS, params: { courtIds } }];
  const dates = [...new Set([...existingDates, date])].sort((a, b) => a.localeCompare(b));
  return [{ method: DISABLE_COURTS, params: { courtIds, dates } }];
}

/**
 * `date` returns the court for that date only; without it every out-of-service date is cleared. A court
 * out of service on every date can only be returned on every date, so a dated return is not built for it.
 */
export function buildCourtsReturnToServiceMethods({ courtIds, date }: { courtIds: string[]; date?: string }): any[] {
  const params = date ? { courtIds, dates: [date] } : { courtIds };
  return [{ method: ENABLE_COURTS, params }];
}

/** Venues go out of service on every date: the factory's `disableVenues` takes no dates. */
export function buildVenuesOutOfServiceMethods({ venueIds }: { venueIds: string[] }): any[] {
  return [{ method: DISABLE_VENUES, params: { venueIds } }];
}

export function buildVenuesReturnToServiceMethods({ venueIds }: { venueIds: string[] }): any[] {
  return [{ method: ENABLE_VENUES, params: { venueIds } }];
}

/**
 * The out-of-service courts a batch of methods would place a matchUp on. Any method whose
 * `params.schedule` names a court counts; its own `scheduledDate` decides the date, else `date`.
 * Clearing a placement (an empty `courtId`) is never refused, so a matchUp can always leave the court.
 */
export function refusedPlacementCourtIds({
  methods,
  courts,
  venues,
  date,
}: {
  methods: any[];
  courts?: any[];
  venues?: any[];
  date?: string;
}): string[] {
  const courtById = new Map((courts ?? []).map((court: any) => [court.courtId, court]));
  const venueById = new Map((venues ?? []).map((venue: any) => [venue.venueId, venue]));
  const refused = new Set<string>();
  for (const method of methods ?? []) {
    const schedule = method?.params?.schedule;
    const courtId = schedule?.courtId;
    if (!courtId) continue;
    const court = courtById.get(courtId);
    if (!court) continue;
    const venue = venueById.get(court.venueId ?? schedule.venueId);
    const placementDate = schedule.scheduledDate || date;
    if (isCourtOutOfService({ court, venue, date: placementDate })) refused.add(courtId);
  }
  return [...refused];
}
