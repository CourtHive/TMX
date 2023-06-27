import { getVenueFormValues, venueForm } from 'components/forms/venue';
import { tournamentEngine, utilities } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderButtons } from 'components/renderers/renderButtons';
import { renderForm } from 'components/renderers/renderForm';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { ADD_COURTS, ADD_VENUE } from 'constants/mutationConstants';
import { RIGHT } from 'constants/tmxConstants';

const saveVenue = (callback) => {
  const values = getVenueFormValues(context.drawer.attributes.content);
  const { venueName, venueAbbreviation, courtsCount } = values;
  const venueId = utilities.UUID();
  if (!venueName || !venueAbbreviation || !courtsCount) {
    tmxToast({ message: 'Invalid values', intent: 'is-danger' });
    return;
  }

  const methods = [
    {
      params: { venue: { venueName, venueAbbreviation, venueId }, returnDetails: true },
      method: ADD_VENUE
    },
    { params: { courtsCount: parseInt(courtsCount), venueId, venueAbbreviationRoot: true }, method: ADD_COURTS }
  ];

  const postMutation = (result) => {
    if (result?.success && isFunction(callback)) {
      const { venue } = tournamentEngine.findVenue({ venueId });
      venue && callback({ ...result, venue });
    }
  };
  mutationRequest({ methods, callback: postMutation });
};

export function addVenue(callback) {
  const valueChange = () => {
    // console.log('value change');
  };
  const content = (elem) => renderForm(elem, venueForm({ values: {}, valueChange }));
  const footer = (elem, close) =>
    renderButtons(
      elem,
      [
        { label: 'Cancel', close: true },
        { label: 'Save', onClick: () => saveVenue(callback), close: true, intent: 'is-info' }
      ],
      close
    );

  context.drawer.open({
    title: `<b style='larger'>Add venue</b>`,
    context: 'tournament',
    width: '300px',
    side: RIGHT,
    content,
    footer
  });
}
