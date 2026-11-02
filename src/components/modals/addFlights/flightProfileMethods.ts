/**
 * How the Add flights modal writes a generated flight profile.
 *
 * Through `attachFlightProfile`, never as a raw `flightProfile` event extension: the factory reads the first-class
 * `event.flightProfile` before the extension, so an extension write on an event that already has the field reports
 * success and changes nothing. `attachFlightProfile` writes the field, and refuses to replace a profile unless told
 * to, or once the event has a draw.
 *
 * Lives in its own module so it can be tested without importing the modal, which pulls courthive-components.
 */
import { ATTACH_FLIGHT_PROFILE } from 'constants/mutationConstants';
import { errorConditionConstants } from 'tods-competition-factory';

const { EXISTING_DRAW_DEFINITIONS, EXISTING_PROFILE } = errorConditionConstants;

export const NEW_PROFILE = 'NEW_PROFILE';
export const REPLACE_PROFILE = 'REPLACE_PROFILE';
export const HAS_DRAWS = 'HAS_DRAWS';

type FlightProfileWrite = typeof NEW_PROFILE | typeof REPLACE_PROFILE | typeof HAS_DRAWS;

/**
 * What writing a new profile to this event would do. Any draw blocks it, flighted or not: `attachFlightProfile`
 * refuses EXISTING_DRAW_DEFINITIONS whenever `event.drawDefinitions` is non-empty, even with `deleteExisting`.
 */
export function flightProfileWrite({ event, flightProfile }: { event: any; flightProfile?: any }): FlightProfileWrite {
  if (event?.drawDefinitions?.length) return HAS_DRAWS;
  return flightProfile ? REPLACE_PROFILE : NEW_PROFILE;
}

export function attachFlightProfileMethod({
  deleteExisting,
  flightProfile,
  eventId,
}: {
  deleteExisting?: boolean;
  flightProfile: any;
  eventId: string;
}) {
  const params: any = { eventId, flightProfile };
  if (deleteExisting) params.deleteExisting = true;
  return { method: ATTACH_FLIGHT_PROFILE, params };
}

/** The i18n key for a failed write. The refusals can still arrive from the server when the record changed under us. */
export function flightProfileFailureKey(result: any): string {
  const code = result?.error?.code;
  if (code === EXISTING_DRAW_DEFINITIONS.code) return 'modals.addFlights.existingDraws';
  if (code === EXISTING_PROFILE.code) return 'modals.addFlights.existingProfile';
  return 'modals.addFlights.generationFailed';
}
