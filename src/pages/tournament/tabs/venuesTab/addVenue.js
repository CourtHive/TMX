import { getVenueFormValues, venueForm } from 'components/forms/venue';
import { nameValidator } from 'components/validators/nameValidator';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderButtons } from 'components/renderers/renderButtons';
import { tournamentEngine, tools } from 'tods-competition-factory';
import { renderForm } from 'components/renderers/renderForm';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { ADD_COURTS, ADD_VENUE } from 'constants/mutationConstants';
import { RIGHT } from 'constants/tmxConstants';

const saveVenue = (callback) => {
  const values = getVenueFormValues(context.drawer.attributes.content);
  const { venueName, venueAbbreviation, courtsCount } = values;
  const venueId = tools.UUID();
  if (!venueName || !venueAbbreviation || !courtsCount) {
    tmxToast({ message: 'Invalid values', intent: 'is-danger' });
    return;
  }

  const methods = [
    {
      params: { venue: { venueName, venueAbbreviation, venueId }, returnDetails: true },
      method: ADD_VENUE,
    },
    { params: { courtsCount: parseInt(courtsCount), venueId, venueAbbreviationRoot: true }, method: ADD_COURTS },
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

  const numberValidator = (value) => value && !isNaN(value);
  const enableSubmit = ({ inputs }) => {
    const isValid = !!(
      nameValidator(2, 6)(inputs['venueAbbreviation'].value) &&
      numberValidator(inputs['courtsCount'].value) &&
      nameValidator(5)(inputs['venueName'].value)
    );
    const saveButton = document.getElementById('addVenueButton');
    if (saveButton) saveButton.disabled = !isValid;
  };
  const relationships = [
    {
      control: 'venueAbbreviation',
      onInput: enableSubmit,
    },
    {
      control: 'courtsCount',
      onInput: enableSubmit,
    },
    {
      control: 'venueName',
      onInput: enableSubmit,
    },
  ];

  const content = (elem) => renderForm(elem, venueForm({ values: {}, valueChange }), relationships);
  const footer = (elem, close) =>
    renderButtons(
      elem,
      [
        { label: 'Cancel', close: true },
        {
          onClick: () => saveVenue(callback),
          id: 'addVenueButton',
          intent: 'is-info',
          disabled: true,
          label: 'Add',
          close: true,
        },
      ],
      close,
    );

  context.drawer.open({
    title: `<b style='larger'>Add venue</b>`,
    width: '300px',
    side: RIGHT,
    content,
    footer,
  });
}
