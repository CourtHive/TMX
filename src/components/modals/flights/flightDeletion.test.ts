/**
 * Deleting draws and flights, through the real engine: a deleted draw keeps its flight, a never-generated flight needs
 * no reason, and all flights can be deleted only while none has a draw.
 */
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import {
  deleteDrawsKeepFlightsMethod,
  deleteAllFlightsMethod,
  deletionNeedsReason,
  canDeleteAllFlights,
  deleteFlightMethods,
  deletableFlights,
} from './flightDeletion';

function flightedEvent(flightsCount = 3) {
  const {
    eventIds: [eventId],
  } = mocksEngine.generateTournamentRecord({
    eventProfiles: [{ participantsProfile: { participantsCount: 24 } }],
    setState: true,
  });
  const result: any = tournamentEngine.generateFlightProfile({ eventId, flightsCount, attachFlightProfile: true });
  expect(result.success).toEqual(true);
  return { eventId, flights: result.flightProfile.flights };
}

function generateDraw(eventId: string, flight: any) {
  const { drawDefinition }: any = tournamentEngine.generateDrawDefinition({
    drawEntries: flight.drawEntries,
    drawName: flight.drawName,
    drawId: flight.drawId,
    eventId,
  });
  expect(tournamentEngine.addDrawDefinition({ eventId, drawDefinition, flight }).success).toEqual(true);
}

const state = (eventId: string) => ({
  flightProfile: tournamentEngine.q.flightProfile({ eventId }),
  event: tournamentEngine.q.event({ eventId }),
});
const flightIds = (eventId: string) => (state(eventId).flightProfile?.flights ?? []).map(({ drawId }: any) => drawId);
const drawIds = (eventId: string) => (state(eventId).event?.drawDefinitions ?? []).map(({ drawId }: any) => drawId);
const run = (methods: any[]) => tournamentEngine.executionQueue(methods, true) as any;
const auditData = { auditReason: 'entered in the wrong event' };

describe('deleting draws and flights', () => {
  it('lists generated draws, then flights that have no draw', () => {
    const { eventId, flights } = flightedEvent();
    generateDraw(eventId, flights[1]);

    expect(deletableFlights(state(eventId))).toEqual([
      { drawId: flights[1].drawId, drawName: flights[1].drawName, generated: true },
      { drawId: flights[0].drawId, drawName: flights[0].drawName, generated: false },
      { drawId: flights[2].drawId, drawName: flights[2].drawName, generated: false },
    ]);
  });

  it('asks for a reason only when a generated draw would be deleted', () => {
    const { eventId, flights } = flightedEvent();
    generateDraw(eventId, flights[0]);
    const { event } = state(eventId);

    expect(deletionNeedsReason({ event, drawIds: [flights[1].drawId, flights[2].drawId] })).toEqual(false);
    expect(deletionNeedsReason({ event, drawIds: [flights[1].drawId, flights[0].drawId] })).toEqual(true);
  });

  it('deletes a draw and keeps its flight, which can be generated again', () => {
    const { eventId, flights } = flightedEvent();
    generateDraw(eventId, flights[0]);

    expect(run([deleteDrawsKeepFlightsMethod({ eventId, drawIds: [flights[0].drawId], auditData })]).success).toEqual(
      true,
    );
    expect(drawIds(eventId)).toEqual([]);
    expect(flightIds(eventId)).toContain(flights[0].drawId);

    const kept = state(eventId).flightProfile?.flights?.find(({ drawId }: any) => drawId === flights[0].drawId);
    generateDraw(eventId, kept);
    expect(drawIds(eventId)).toEqual([flights[0].drawId]);
  });

  it('deletes a never-generated flight without a reason', () => {
    const { eventId, flights } = flightedEvent();

    expect(run(deleteFlightMethods({ eventId, drawIds: [flights[2].drawId] })).success).toEqual(true);
    expect(flightIds(eventId)).toEqual([flights[0].drawId, flights[1].drawId]);
  });

  it('deletes a draw and its flight together', () => {
    const { eventId, flights } = flightedEvent();
    generateDraw(eventId, flights[0]);

    expect(run(deleteFlightMethods({ eventId, drawIds: [flights[0].drawId], auditData })).success).toEqual(true);
    expect(drawIds(eventId)).toEqual([]);
    expect(flightIds(eventId)).not.toContain(flights[0].drawId);
  });

  it('deletes all flights only while no flight has a draw', () => {
    const { eventId, flights } = flightedEvent();
    expect(canDeleteAllFlights(state(eventId))).toEqual(true);

    generateDraw(eventId, flights[0]);
    expect(canDeleteAllFlights(state(eventId))).toEqual(false);

    expect(run(deleteFlightMethods({ eventId, drawIds: [flights[0].drawId], auditData })).success).toEqual(true);
    expect(canDeleteAllFlights(state(eventId))).toEqual(true);

    expect(run([deleteAllFlightsMethod(eventId)]).success).toEqual(true);
    expect(state(eventId).flightProfile).toBeUndefined();
    expect(canDeleteAllFlights(state(eventId))).toEqual(false);
  });
});
