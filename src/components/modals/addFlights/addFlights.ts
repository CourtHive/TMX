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

const { SINGLES } = matchUpTypes;

export function addFlights({ eventId, callback }) {
  const event = tournamentEngine.q.event({ eventId });
  if (!event) return;

  const existingProfile = tournamentEngine.q.flightProfile({ eventId });
  const write = flightProfileWrite({ event, flightProfile: existingProfile });
  if (write === HAS_DRAWS) {
    tmxToast({ message: t('modals.addFlights.existingDraws'), intent: 'is-danger' });
    return;
  }

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
  getFlightProfileModal({ callback: generateFlightProfile });
}
