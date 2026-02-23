/**
 * Add venue drawer with form validation.
 * Creates venue with name, abbreviation, court count, and operating hours via mutation.
 * Optionally shows an External Lookup button when the provider supports facility services.
 */
import { validators, renderButtons, renderForm } from 'courthive-components';
import { getVenueFormValues, venueForm } from 'components/forms/venue';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine, tools } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { t } from 'i18n';

import { attachTimePicker, createTimeOrderValidator, toMilitaryTime } from './venueTimeHelpers';
import { ADD_COURTS, ADD_VENUE } from 'constants/mutationConstants';
import { RIGHT } from 'constants/tmxConstants';

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

const saveVenue = (callback?: (result: any) => void) => {
  const values = getVenueFormValues(context.drawer.attributes.content);
  const { venueName, venueAbbreviation, courtsCount, defaultStartTime, defaultEndTime } = values;
  const venueId = tools.UUID();
  if (!venueName || !venueAbbreviation || !courtsCount) {
    tmxToast({ message: t('pages.venues.invalidValues'), intent: 'is-danger' });
    return;
  }

  const venue: any = { venueName, venueAbbreviation, venueId };
  if (defaultStartTime) venue.defaultStartTime = toMilitaryTime(defaultStartTime);
  if (defaultEndTime) venue.defaultEndTime = toMilitaryTime(defaultEndTime);

  const methods = [
    {
      params: { venue, returnDetails: true },
      method: ADD_VENUE,
    },
    { params: { courtsCount: Number.parseInt(courtsCount), venueId, venueAbbreviationRoot: true }, method: ADD_COURTS },
  ];

  const postMutation = (result: any) => {
    if (result?.success) {
      if (isFunction(callback) && callback) {
        const { venue } = tournamentEngine.findVenue({ venueId });
        if (venue) callback({ ...result, venue });
      }
    } else if (result?.error) {
      tmxToast({ intent: 'is-warning', message: result.error?.message || t('common.error') });
    }
  };
  mutationRequest({ methods, callback: postMutation });
};

// ---------------------------------------------------------------------------
// External lookup
// ---------------------------------------------------------------------------

function hasFacilityService(): boolean {
  const provider = context.provider;
  return !!(provider?.facilityService && provider?.facilityLookup);
}

function createExternalLookupButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'button is-fullwidth is-outlined is-info';
  button.style.marginBottom = '1em';
  button.textContent = t('pages.venues.addVenue.externalLookup');
  button.addEventListener('click', () => {
    // TODO: hand over to facility lookup modal populated by 3rd party service
    const { facilityLookup } = context.provider || {};
    console.log('External facility lookup triggered', facilityLookup);
  });
  return button;
}

// ---------------------------------------------------------------------------
// Form + relationships
// ---------------------------------------------------------------------------

export function addVenue(callback?: (result: any) => void): void {
  const valueChange = () => {};

  const numberValidator = (value: string) => value && !Number.isNaN(Number(value));

  const enableSubmit = ({ inputs }: any) => {
    const timeError =
      inputs?.defaultStartTime?.classList.contains('is-danger') ||
      inputs?.defaultEndTime?.classList.contains('is-danger');
    const isValid =
      !timeError &&
      !!(
        validators.nameValidator(2, 6)(inputs['venueAbbreviation'].value) &&
        numberValidator(inputs['courtsCount'].value) &&
        validators.nameValidator(5)(inputs['venueName'].value)
      );
    const saveButton = document.getElementById('addVenueButton');
    if (saveButton) (saveButton as HTMLButtonElement).disabled = !isValid;
  };

  const validateTimeOrder = createTimeOrderValidator(enableSubmit);

  const relationships = [
    { control: 'venueAbbreviation', onInput: enableSubmit },
    { control: 'courtsCount', onInput: enableSubmit },
    { control: 'venueName', onInput: enableSubmit },
    { control: 'defaultStartTime', onInput: validateTimeOrder },
    { control: 'defaultEndTime', onInput: validateTimeOrder },
  ];

  const content = (elem: HTMLElement) => {
    if (hasFacilityService()) {
      elem.appendChild(createExternalLookupButton());
    }
    const inputs = renderForm(elem, venueForm({ values: {}, valueChange }), relationships);

    if (inputs?.defaultStartTime) attachTimePicker(inputs.defaultStartTime as HTMLInputElement);
    if (inputs?.defaultEndTime) attachTimePicker(inputs.defaultEndTime as HTMLInputElement);

    return inputs;
  };

  const footer = (elem: HTMLElement, close: () => void) =>
    renderButtons(
      elem,
      [
        { label: t('common.cancel'), close: true },
        {
          onClick: () => saveVenue(callback),
          id: 'addVenueButton',
          intent: 'is-info',
          disabled: true,
          label: t('add'),
          close: true,
        },
      ],
      close,
    );

  context.drawer.open({
    title: `<b style='larger'>${t('pages.venues.addVenue.title')}</b>`,
    width: '300px',
    side: RIGHT,
    content,
    footer,
  });
}
