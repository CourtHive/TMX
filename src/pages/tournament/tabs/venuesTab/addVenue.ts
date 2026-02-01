/**
 * Add venue drawer with form validation.
 * Creates venue with name, abbreviation, and court count via mutation.
 */
import { validators, renderButtons, renderForm } from 'courthive-components';
import { getVenueFormValues, venueForm } from 'components/forms/venue';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine, tools } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { ADD_COURTS, ADD_VENUE } from 'constants/mutationConstants';
import { RIGHT } from 'constants/tmxConstants';

const saveVenue = (callback?: (result: any) => void) => {
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

  const postMutation = (result: any) => {
    if (result?.success && isFunction(callback) && callback) {
      const { venue } = tournamentEngine.findVenue({ venueId });
      if (venue) callback({ ...result, venue });
    }
  };
  mutationRequest({ methods, callback: postMutation });
};

export function addVenue(callback?: (result: any) => void): void {
  const valueChange = () => {
    // console.log('value change');
  };

  const numberValidator = (value: string) => value && !isNaN(Number(value));
  const enableSubmit = ({ inputs }: any) => {
    const isValid = !!(
      validators.nameValidator(2, 6)(inputs['venueAbbreviation'].value) &&
      numberValidator(inputs['courtsCount'].value) &&
      validators.nameValidator(5)(inputs['venueName'].value)
    );
    const saveButton = document.getElementById('addVenueButton');
    if (saveButton) (saveButton as HTMLButtonElement).disabled = !isValid;
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

  const content = (elem: HTMLElement) => renderForm(elem, venueForm({ values: {}, valueChange }), relationships);
  const footer = (elem: HTMLElement, close: () => void) =>
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
