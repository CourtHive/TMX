/**
 * Flights for the participants not yet in a flight or draw, through the real engine: generated locally, written with
 * one addFlight each, existing flights and draws untouched.
 */
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import {
  overlappingParticipantIds,
  remainingParticipantIds,
  remainingFlightsParams,
  addFlightMethods,
  newFlights,
} from './remainingFlights';

const state = (eventId: string) => ({
  flightProfile: tournamentEngine.q.flightProfile({ eventId }),
  event: tournamentEngine.q.event({ eventId }),
});

/** 24 entries in 3 flights; flight 1 has its draw, flight 3 (no draw) is deleted, so its 8 participants remain. */
function eventWithRemaining() {
  const {
    eventIds: [eventId],
  } = mocksEngine.generateTournamentRecord({
    eventProfiles: [{ participantsProfile: { participantsCount: 24 } }],
    setState: true,
  });
  let result: any = tournamentEngine.generateFlightProfile({ eventId, flightsCount: 3, attachFlightProfile: true });
  const [first, , third] = result.flightProfile.flights;
  const { drawDefinition }: any = tournamentEngine.generateDrawDefinition({
    drawEntries: first.drawEntries,
    drawName: first.drawName,
    drawId: first.drawId,
    eventId,
  });
  expect(tournamentEngine.addDrawDefinition({ eventId, drawDefinition, flight: first }).success).toEqual(true);
  result = tournamentEngine.deleteFlightAndFlightDraw({ eventId, drawId: third.drawId });
  expect(result.success).toEqual(true);
  return { eventId, first, freed: third.drawEntries.map(({ participantId }: any) => participantId) };
}

function generateRemaining(eventId: string, values: any) {
  const before = state(eventId).flightProfile;
  const existingNames = (before?.flights ?? []).map(({ drawName }: any) => drawName);
  const result: any = tournamentEngine.generateFlightProfile(
    remainingFlightsParams({ eventId, values, existingNames }),
  );
  expect(result.success).toEqual(true);
  return newFlights({ before, after: result.flightProfile });
}

describe('flights for the remaining participants', () => {
  it('finds the participants in no flight and no draw', () => {
    const { eventId, freed } = eventWithRemaining();
    expect(remainingParticipantIds(state(eventId)).sort()).toEqual([...freed].sort());
  });

  it('adds flights for them only, leaving the flight with a draw untouched', () => {
    const { eventId, first, freed } = eventWithRemaining();

    const flights = generateRemaining(eventId, { flightsCount: 2, drawNames: ['Gold', 'Silver'] });
    expect(flights.map(({ drawName }: any) => drawName)).toEqual(['Gold', 'Silver']);
    expect(overlappingParticipantIds({ ...state(eventId), flights })).toEqual([]);

    const result: any = tournamentEngine.executionQueue(addFlightMethods({ eventId, flights }), true);
    expect(result.success).toEqual(true);

    const after = state(eventId);
    expect(remainingParticipantIds(after)).toEqual([]);
    expect(after.flightProfile?.flights.map(({ drawName }: any) => drawName)).toEqual([
      first.drawName,
      expect.any(String),
      'Gold',
      'Silver',
    ]);
    const added = (after.flightProfile?.flights ?? []).slice(2).flatMap(({ drawEntries }: any) => drawEntries);
    expect(added.map(({ participantId }: any) => participantId).sort()).toEqual([...freed].sort());
    expect(after.event?.drawDefinitions?.map(({ drawId }: any) => drawId)).toEqual([first.drawId]);
  });

  it('lets the factory name the flights when a chosen name is already used', () => {
    const { eventId, first } = eventWithRemaining();
    const flights = generateRemaining(eventId, { flightsCount: 1, drawNames: [first.drawName] });
    expect(flights[0].drawName).not.toEqual(first.drawName);
  });

  it('names participants who are already placed, before anything is sent', () => {
    const { eventId, first } = eventWithRemaining();
    const flights = [{ drawId: 'x', drawName: 'X', drawEntries: first.drawEntries.slice(0, 2) }];
    expect(overlappingParticipantIds({ ...state(eventId), flights })).toEqual(
      first.drawEntries.slice(0, 2).map(({ participantId }: any) => participantId),
    );
  });

  it('sends one addFlight per flight with participants, and none for an empty one', () => {
    expect(
      addFlightMethods({
        flights: [
          { drawId: 'a', drawName: 'A', drawEntries: [{ participantId: 'p1' }] },
          { drawId: 'b', drawName: 'B', drawEntries: [] },
        ],
        eventId: 'e',
      }),
    ).toEqual([
      {
        method: 'addFlight',
        params: { eventId: 'e', drawId: 'a', drawName: 'A', drawEntries: [{ participantId: 'p1' }] },
      },
    ]);
  });
});
