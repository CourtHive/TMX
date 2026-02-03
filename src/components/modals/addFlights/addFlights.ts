import { factoryConstants, matchUpTypes, tools, tournamentEngine } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getFlightProfileModal } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';

import { ADD_EVENT_EXTENSION } from 'constants/mutationConstants';

const { SINGLES } = matchUpTypes;

export function addFlights({ eventId, callback }) {
  const event = tournamentEngine.getEvent({ eventId }).event;

  const generateFlightProfile = (values: any) => {
    const scaleAttributes = {
      eventType: event.eventType || SINGLES, // Add eventType from event context
      ...values.scaleAttributes,
    };
    const generateParams = {
      // scaledParticipants: could be added in future
      uuids: tools.UUIDS(values.flightsCount),
      flightsCount: values.flightsCount,
      splitMethod: values.splitMethod,
      drawNames: values.drawNames,
      scaleAttributes,
      eventId,
    };
    const result = tournamentEngine.generateFlightProfile(generateParams);

    if (result.success) {
      const extension = {
        name: factoryConstants.extensionConstants.FLIGHT_PROFILE,
        value: result.flightProfile,
      };
      const method = ADD_EVENT_EXTENSION;
      const methods = [{ method, params: { eventId, extension } }];
      const postMutation = (mutationResult: any) => {
        if (mutationResult.success) {
          tmxToast({ message: 'Flights generated', intent: 'is-success' });
          if (isFunction(callback)) callback({ generated: true, result });
        } else {
          tmxToast({ message: 'Flight profile generation failed', intent: 'is-danger' });
          if (isFunction(callback)) callback({ generated: false, result: mutationResult });
        }
      };
      mutationRequest({ methods, callback: postMutation });
    } else if (isFunction(callback)) {
      callback({ generated: false, result });
    }
  };
  getFlightProfileModal({ eventId, callback: generateFlightProfile });
}
