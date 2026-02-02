import { factoryConstants, matchUpTypes, tools, tournamentEngine } from 'tods-competition-factory';
import { getFlightProfileModal } from 'courthive-components';
import { isFunction } from 'functions/typeOf';

import { ADD_EVENT_EXTENSION } from 'constants/mutationConstants';
import { mutationRequest } from 'services/mutation/mutationRequest';

const { SINGLES } = matchUpTypes;

export function addFlights({ eventId, callback }) {
  const event = tournamentEngine.getEvent({ eventId }).event;

  const generateFlightProfile = (values: any) => {
    const generateParams = {
      uuids: tools.UUIDS(values.flightsCount),
      flightsCount: values.flightsCount,
      splitMethod: values.splitMethod,
      drawNames: values.drawNames,
      scaleAttributes: {
        ...values.scaleAttributes,
        eventType: event.eventType || SINGLES, // Add eventType from event context
      },
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
        if (isFunction(callback)) callback({ generated: true, result: mutationResult });
      };
      mutationRequest({ methods, callback: postMutation });
    } else if (isFunction(callback)) {
      callback({ generated: false, result });
    }
  };
  getFlightProfileModal({ eventId, callback: generateFlightProfile });
}
