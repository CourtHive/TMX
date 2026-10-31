/**
 * The Add flights modal used to write the generated profile as a raw `flightProfile` event extension. The factory
 * reads the first-class `event.flightProfile` first, and writes it whenever it touches a profile (attaching one,
 * adding a flight's draw), so on those events the extension write reported success and changed nothing.
 * These run both writes through the real engine.
 */
import { factoryConstants, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { ADD_EVENT_EXTENSION } from 'constants/mutationConstants';
import { describe, expect, it } from 'vitest';

import {
  attachFlightProfileMethod,
  flightProfileFailureKey,
  flightProfileWrite,
  REPLACE_PROFILE,
  NEW_PROFILE,
  HAS_DRAWS,
} from './flightProfileMethods';

const { FLIGHT_PROFILE } = factoryConstants.extensionConstants;

const extensionWrite = (eventId: string, flightProfile: any) => ({
  method: ADD_EVENT_EXTENSION,
  params: { eventId, extension: { name: FLIGHT_PROFILE, value: flightProfile } },
});

function generateFlights(eventId: string, flightsCount: number) {
  const result: any = tournamentEngine.generateFlightProfile({ eventId, flightsCount });
  expect(result.success).toEqual(true);
  return result.flightProfile;
}

function flightedEvent() {
  const {
    eventIds: [eventId],
  } = mocksEngine.generateTournamentRecord({
    eventProfiles: [{ eventName: 'Flighted', participantsProfile: { participantsCount: 16 } }],
    setState: true,
  });
  return eventId;
}

function eventWithExtensionFlights() {
  const eventId = flightedEvent();
  const flightProfile = generateFlights(eventId, 2);
  expect(tournamentEngine.executionQueue([extensionWrite(eventId, flightProfile)], true).success).toEqual(true);
  return { eventId, flightProfile };
}

function eventWithFirstClassFlights() {
  const eventId = flightedEvent();
  const result: any = tournamentEngine.generateFlightProfile({ eventId, flightsCount: 2, attachFlightProfile: true });
  expect(result.success).toEqual(true);
  return { eventId, flightProfile: result.flightProfile };
}

function addFirstFlightDraw(eventId: string, flightProfile: any) {
  const [flight] = flightProfile.flights;
  const { drawDefinition }: any = tournamentEngine.generateDrawDefinition({
    drawEntries: flight.drawEntries,
    drawId: flight.drawId,
    eventId,
  });
  expect(tournamentEngine.addDrawDefinition({ eventId, drawDefinition, flight }).success).toEqual(true);
  return flight.drawId;
}

const flightDrawIds = (eventId: string) =>
  tournamentEngine.q.flightProfile({ eventId })?.flights?.map(({ drawId }: any) => drawId);
const storedExtension = (eventId: string) =>
  tournamentEngine.q.event({ eventId })?.extensions?.find(({ name }: any) => name === FLIGHT_PROFILE);
const drawIdsOf = (flightProfile: any) => flightProfile.flights.map(({ drawId }: any) => drawId);
const writeFor = (eventId: string) =>
  flightProfileWrite({
    flightProfile: tournamentEngine.q.flightProfile({ eventId }),
    event: tournamentEngine.q.event({ eventId }),
  });
// what the modal sends for this event's state
const modalWrite = (eventId: string, flightProfile: any) =>
  attachFlightProfileMethod({ eventId, flightProfile, deleteExisting: writeFor(eventId) === REPLACE_PROFILE });

describe('the raw extension write (the old Add flights write)', () => {
  it('is shadowed on an event whose profile is first-class: success, nothing changes', () => {
    const { eventId, flightProfile } = eventWithFirstClassFlights();

    const result: any = tournamentEngine.executionQueue([extensionWrite(eventId, generateFlights(eventId, 3))], true);

    expect(result.success).toEqual(true);
    expect(storedExtension(eventId)?.value?.flights).toHaveLength(3);
    expect(flightDrawIds(eventId)).toEqual(drawIdsOf(flightProfile));
  });

  it("is shadowed once a flight has a draw, even on TMX's own extension-only record", () => {
    const { eventId, flightProfile } = eventWithExtensionFlights();
    expect(tournamentEngine.q.event({ eventId })?.flightProfile).toBeUndefined();

    addFirstFlightDraw(eventId, flightProfile);
    // adding the flight's draw rewrites the profile as first-class
    expect(tournamentEngine.q.event({ eventId })?.flightProfile).toBeDefined();

    const result: any = tournamentEngine.executionQueue([extensionWrite(eventId, generateFlights(eventId, 3))], true);

    expect(result.success).toEqual(true);
    expect(flightDrawIds(eventId)).toEqual(drawIdsOf(flightProfile));
  });
});

describe('the Add flights write through attachFlightProfile', () => {
  it('sends deleteExisting only when asked', () => {
    expect(attachFlightProfileMethod({ eventId: 'e1', flightProfile: { flights: [] } })).toEqual({
      method: 'attachFlightProfile',
      params: { eventId: 'e1', flightProfile: { flights: [] } },
    });
    expect(attachFlightProfileMethod({ eventId: 'e1', flightProfile: {}, deleteExisting: true }).params).toEqual({
      flightProfile: {},
      deleteExisting: true,
      eventId: 'e1',
    });
  });

  it('writes the first-class profile on an event with none', () => {
    const eventId = flightedEvent();
    expect(writeFor(eventId)).toEqual(NEW_PROFILE);

    const flightProfile = generateFlights(eventId, 2);
    const result: any = tournamentEngine.executionQueue([modalWrite(eventId, flightProfile)], true);

    expect(result.success).toEqual(true);
    expect(tournamentEngine.q.event({ eventId })?.flightProfile).toBeDefined();
    expect(flightDrawIds(eventId)).toEqual(drawIdsOf(flightProfile));
  });

  it('replaces a first-class profile once confirmed', () => {
    const { eventId } = eventWithFirstClassFlights();
    expect(writeFor(eventId)).toEqual(REPLACE_PROFILE);

    const replacement = generateFlights(eventId, 3);
    const result: any = tournamentEngine.executionQueue([modalWrite(eventId, replacement)], true);

    expect(result.success).toEqual(true);
    expect(flightDrawIds(eventId)).toEqual(drawIdsOf(replacement));
  });

  it("replaces TMX's own extension-only profile and leaves no extension behind", () => {
    const { eventId } = eventWithExtensionFlights();
    expect(writeFor(eventId)).toEqual(REPLACE_PROFILE);

    const replacement = generateFlights(eventId, 3);
    const result: any = tournamentEngine.executionQueue([modalWrite(eventId, replacement)], true);

    expect(result.success).toEqual(true);
    expect(flightDrawIds(eventId)).toEqual(drawIdsOf(replacement));
    expect(storedExtension(eventId)).toBeUndefined();
  });

  it('is refused without deleteExisting when a profile exists', () => {
    const { eventId, flightProfile } = eventWithFirstClassFlights();

    const method = attachFlightProfileMethod({ eventId, flightProfile: generateFlights(eventId, 3) });
    const result: any = tournamentEngine.executionQueue([method], true);

    expect(result.success).not.toEqual(true);
    expect(flightProfileFailureKey(result)).toEqual('modals.addFlights.existingProfile');
    expect(flightDrawIds(eventId)).toEqual(drawIdsOf(flightProfile));
  });

  it('is refused once the event has a draw, even with deleteExisting', () => {
    const { eventId, flightProfile } = eventWithExtensionFlights();
    addFirstFlightDraw(eventId, flightProfile);
    expect(writeFor(eventId)).toEqual(HAS_DRAWS);

    const replacement = generateFlights(eventId, 3);
    const method = attachFlightProfileMethod({ eventId, flightProfile: replacement, deleteExisting: true });
    const result: any = tournamentEngine.executionQueue([method], true);

    expect(result.success).not.toEqual(true);
    expect(flightProfileFailureKey(result)).toEqual('modals.addFlights.existingDraws');
    expect(flightDrawIds(eventId)).toEqual(drawIdsOf(flightProfile));
  });

  it('falls back to the generic message for any other failure', () => {
    expect(flightProfileFailureKey({ error: { code: 'ERR_SOMETHING_ELSE' } })).toEqual(
      'modals.addFlights.generationFailed',
    );
    expect(flightProfileFailureKey(undefined)).toEqual('modals.addFlights.generationFailed');
  });
});
