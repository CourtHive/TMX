/**
 * Deleting draws and flights. A flight is a planned draw: its name and participants, with or without a generated draw.
 *
 * - Deleting a draw keeps its flight, which returns as an ungenerated flight that can be generated again.
 * - Deleting a flight removes the flight and its draw, if it has one; its participants stay entered in the event.
 * - Deleting a generated draw asks for a reason (it is audited); a flight that never had a draw asks only for
 *   confirmation (CA 2026-11-01).
 * - Deleting all flights is offered only while no flight has a draw: draws are deleted explicitly first.
 *
 * Lives in its own module so it can be tested without importing the modals, which pull courthive-components.
 */
import { sortByDrawOrder } from 'functions/drawOrder';

import { DELETE_DRAW_DEFINITIONS, DELETE_FLIGHT_AND_DRAW, DELETE_FLIGHT_PROFILE } from 'constants/mutationConstants';

export type DeletableFlight = { drawId: string; drawName?: string; generated: boolean };

const generatedDrawIds = (event: any) => new Set((event?.drawDefinitions ?? []).map(({ drawId }: any) => drawId));

/** Every draw and every flight of the event, in draw order (flights that were never ordered follow the draws). */
export function deletableFlights({ event, flightProfile }: { event: any; flightProfile?: any }): DeletableFlight[] {
  const generated = (event?.drawDefinitions ?? []).map(({ drawId, drawName }: any) => ({
    generated: true,
    drawName,
    drawId,
  }));
  const drawIds = generatedDrawIds(event);
  const ungenerated = (flightProfile?.flights ?? [])
    .filter(({ drawId }: any) => !drawIds.has(drawId))
    .map(({ drawId, drawName }: any) => ({ generated: false, drawName, drawId }));
  return sortByDrawOrder({ items: [...generated, ...ungenerated], event, flightProfile });
}

/** A reason is asked for only when a generated draw would be deleted. */
export function deletionNeedsReason({ event, drawIds }: { event: any; drawIds: string[] }): boolean {
  const generated = generatedDrawIds(event);
  return drawIds.some((drawId) => generated.has(drawId));
}

const withAudit = (params: any, auditData?: any) => (auditData ? { ...params, auditData } : params);

/** Delete flights and, where they have one, their draws. */
export function deleteFlightMethods({
  auditData,
  eventId,
  drawIds,
}: {
  auditData?: any;
  eventId: string;
  drawIds: string[];
}) {
  return drawIds.map((drawId) => ({
    params: withAudit({ eventId, drawId, force: true }, auditData),
    method: DELETE_FLIGHT_AND_DRAW,
  }));
}

/** Delete draws and keep their flights, so each can be generated again. */
export function deleteDrawsKeepFlightsMethod({
  auditData,
  eventId,
  drawIds,
}: {
  auditData?: any;
  eventId: string;
  drawIds: string[];
}) {
  return { method: DELETE_DRAW_DEFINITIONS, params: withAudit({ eventId, drawIds, force: true }, auditData) };
}

export function canDeleteAllFlights({ event, flightProfile }: { event: any; flightProfile?: any }): boolean {
  const flights = flightProfile?.flights ?? [];
  const drawIds = generatedDrawIds(event);
  return flights.length > 0 && !flights.some(({ drawId }: any) => drawIds.has(drawId));
}

export function deleteAllFlightsMethod(eventId: string) {
  return { method: DELETE_FLIGHT_PROFILE, params: { eventId } };
}
