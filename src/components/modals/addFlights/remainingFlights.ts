/**
 * Flights for the participants not yet in any flight or draw, added after the event's existing flights without
 * touching them (every draw counts as a flight).
 *
 * The split is generated here, locally, with the factory's `generateFlightProfile` (scope UNFLIGHTED, appendFlights,
 * optional rating band), and each new flight is then sent as one `addFlight` with its exact participants. Sending
 * `generateFlightProfile` itself as a mutation would let the server and the client shuffle unrated participants
 * differently and disagree.
 *
 * Lives in its own module so it can be tested without importing the modal, which pulls courthive-components.
 */
import { entryStatusConstants, flightConstants } from 'tods-competition-factory';
import { ADD_FLIGHT } from 'constants/mutationConstants';

const { DIRECT_ENTRY_STATUSES } = entryStatusConstants;

const participantIdsOf = (entries: any[] = []) => entries.map(({ participantId }: any) => participantId);

/** Participants in any flight or any draw. */
export function placedParticipantIds({ event, flightProfile }: { event: any; flightProfile?: any }): Set<string> {
  return new Set([
    ...(flightProfile?.flights ?? []).flatMap(({ drawEntries }: any) => participantIdsOf(drawEntries)),
    ...(event?.drawDefinitions ?? []).flatMap(({ entries }: any) => participantIdsOf(entries)),
  ]);
}

/** Entered participants with a direct-acceptance status who are in no flight and no draw. */
export function remainingParticipantIds({ event, flightProfile }: { event: any; flightProfile?: any }): string[] {
  const placed = placedParticipantIds({ event, flightProfile });
  return (event?.entries ?? [])
    .filter(({ entryStatus }: any) => !entryStatus || DIRECT_ENTRY_STATUSES.includes(entryStatus))
    .map(({ participantId }: any) => participantId)
    .filter((participantId: string) => !placed.has(participantId));
}

/** The arguments for generating flights from the remaining participants, from the flight modal's values. */
export function remainingFlightsParams({ eventId, values, existingNames }: any) {
  const drawNames: string[] = values?.drawNames ?? [];
  // a name the event already uses would make two flights look alike: let the factory name them after their numbers
  const namesCollide = drawNames.some((name) => existingNames.includes(name));
  return {
    entriesScope: flightConstants.ENTRIES_SCOPE_UNFLIGHTED,
    ...(values?.scaleRange && { scaleRange: values.scaleRange }),
    ...(!namesCollide && drawNames.length && { drawNames }),
    scaleAttributes: values?.scaleAttributes,
    flightsCount: values?.flightsCount,
    splitMethod: values?.splitMethod,
    appendFlights: true,
    eventId,
  };
}

/** The flights an appended profile has that the existing one does not. */
export function newFlights({ before, after }: { before?: any; after?: any }): any[] {
  const existing = new Set((before?.flights ?? []).map(({ drawId }: any) => drawId));
  return (after?.flights ?? []).filter(({ drawId }: any) => !existing.has(drawId));
}

/** One addFlight per new flight, carrying its exact participants so every engine writes the same flight. */
export function addFlightMethods({ eventId, flights }: { eventId: string; flights: any[] }) {
  return flights
    .filter(({ drawEntries }: any) => drawEntries?.length)
    .map(({ drawId, drawName, drawEntries }: any) => ({
      params: { eventId, drawId, drawName, drawEntries },
      method: ADD_FLIGHT,
    }));
}

/** Participants of these flights already in another flight or draw; asked about before anything is sent. */
export function overlappingParticipantIds({ event, flightProfile, flights }: any): string[] {
  const placed = placedParticipantIds({ event, flightProfile });
  const ids = flights.flatMap(({ drawEntries }: any) => participantIdsOf(drawEntries));
  return [...new Set<string>(ids)].filter((participantId) => placed.has(participantId));
}
