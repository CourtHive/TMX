import { confirmModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { matchUpTypes, tools } from 'tods-competition-factory';
import { getFlightProfileModal } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import {
  attachFlightProfileMethod,
  flightProfileFailureKey,
  flightProfileWrite,
  REPLACE_PROFILE,
  HAS_DRAWS,
} from './flightProfileMethods';
import {
  overlappingParticipantIds,
  remainingParticipantIds,
  remainingFlightsParams,
  addFlightMethods,
  newFlights,
} from './remainingFlights';

const { SINGLES } = matchUpTypes;

// a rating band and a single flight are offered, so a top flight can be made by rating and the rest flighted later
const editorConfig = () => ({
  labels: {
    ratingMinLabel: t('modals.addFlights.ratingFrom'),
    ratingMaxLabel: t('modals.addFlights.ratingTo'),
  },
  options: { ratingBand: true, minFlights: 1 },
});

const withEventType = (event: any, values: any) => ({
  eventType: event.eventType || SINGLES, // Add eventType from event context
  ...values.scaleAttributes,
});

export function addFlights({ eventId, callback }) {
  const event = tournamentEngine.q.event({ eventId });
  if (!event) return;

  const existingProfile = tournamentEngine.q.flightProfile({ eventId });
  const write = flightProfileWrite({ event, flightProfile: existingProfile });
  if (write === HAS_DRAWS) {
    // flights with draws stay as they are; participants in no flight can still be flighted
    if (remainingParticipantIds({ event, flightProfile: existingProfile }).length) {
      addRemainingFlights({ eventId, callback });
    } else {
      tmxToast({ message: t('modals.addFlights.existingDraws'), intent: 'is-danger' });
    }
    return;
  }

  const generateFlightProfile = (values: any) => {
    const generateParams = {
      // scaledParticipants: could be added in future
      uuids: tools.UUIDS(values.flightsCount),
      ...(values.scaleRange && { scaleRange: values.scaleRange }),
      scaleAttributes: withEventType(event, values),
      flightsCount: values.flightsCount,
      splitMethod: values.splitMethod,
      drawNames: values.drawNames,
      eventId,
    };
    const result = tournamentEngine.generateFlightProfile(generateParams);

    if (result.success) {
      const deleteExisting = write === REPLACE_PROFILE;
      const methods = [attachFlightProfileMethod({ eventId, flightProfile: result.flightProfile, deleteExisting })];
      const postMutation = (mutationResult: any) => {
        if (mutationResult.success) {
          tmxToast({ message: t('modals.addFlights.flightsGenerated'), intent: 'is-success' });
          if (isFunction(callback)) callback({ generated: true, result });
        } else {
          tmxToast({ message: t(flightProfileFailureKey(mutationResult)), intent: 'is-danger' });
          if (isFunction(callback)) callback({ generated: false, result: mutationResult });
        }
      };
      const submit = () => mutationRequest({ methods, callback: postMutation });

      if (deleteExisting) {
        confirmModal({
          query: t('modals.addFlights.replaceExisting', { count: existingProfile?.flights?.length ?? 0 }),
          title: t('modals.addFlights.replaceTitle'),
          okIntent: 'is-danger',
          okAction: submit,
        });
      } else {
        submit();
      }
    } else if (isFunction(callback)) {
      callback({ generated: false, result });
    }
  };
  getFlightProfileModal({ editorConfig: editorConfig(), callback: generateFlightProfile });
}

/**
 * Flights for the participants in no flight and no draw, after the event's existing flights (which are untouched).
 * The split is generated locally and each new flight is sent as one addFlight with its exact participants.
 */
export function addRemainingFlights({ eventId, callback }: { eventId: string; callback?: (result: any) => void }) {
  const event = tournamentEngine.q.event({ eventId });
  const flightProfile = tournamentEngine.q.flightProfile({ eventId });
  if (!event) return;
  if (!remainingParticipantIds({ event, flightProfile }).length) {
    tmxToast({ message: t('modals.addFlights.noneRemaining'), intent: 'is-info' });
    return;
  }

  const generate = (values: any) => {
    const existingNames = (flightProfile?.flights ?? []).map(({ drawName }: any) => drawName);
    const params = remainingFlightsParams({
      values: { ...values, scaleAttributes: withEventType(event, values) },
      existingNames,
      eventId,
    });
    const result = tournamentEngine.generateFlightProfile(params);
    const flights = result.success ? newFlights({ before: flightProfile, after: result.flightProfile }) : [];
    if (!flights.some(({ drawEntries }: any) => drawEntries?.length)) {
      tmxToast({ message: t('modals.addFlights.noneInBand'), intent: 'is-warning' });
      return;
    }

    const postMutation = (mutationResult: any) => {
      if (mutationResult.success) {
        tmxToast({ message: t('modals.addFlights.flightsGenerated'), intent: 'is-success' });
      } else {
        tmxToast({ message: t('modals.addFlights.generationFailed'), intent: 'is-danger' });
      }
      if (isFunction(callback)) callback({ generated: !!mutationResult.success, result: mutationResult });
    };
    const submit = () => mutationRequest({ methods: addFlightMethods({ eventId, flights }), callback: postMutation });

    // a participant already in a flight is named before anything is sent; the TD can add them anyway
    const overlapping = overlappingParticipantIds({ event, flightProfile, flights });
    if (overlapping.length) {
      const names = overlapping
        .map((participantId: string) => tournamentEngine.findParticipant({ participantId })?.participant)
        .map((participant: any) => participant?.participantName)
        .filter(Boolean)
        .join(', ');
      confirmModal({
        query: t('modals.addFlights.alreadyFlighted', { names }),
        title: t('modals.addFlights.remainingTitle'),
        okAction: submit,
      });
    } else {
      submit();
    }
  };

  getFlightProfileModal({ editorConfig: editorConfig(), callback: generate });
}
