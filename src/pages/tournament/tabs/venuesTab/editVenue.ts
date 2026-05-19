/**
 * Edit venue drawer with form validation.
 * Modifies venue name, abbreviation, and operating hours via mutation.
 */
import { validators, renderButtons, renderForm } from 'courthive-components';
import { toDisplayTime, deriveCourtNameBase } from 'components/forms/venue';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { fixtures } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { t } from 'i18n';

import { ADD_ONLINE_RESOURCE, MODIFY_VENUE, REMOVE_ONLINE_RESOURCE } from 'constants/mutationConstants';
import { attachTimePicker, createTimeOrderValidator, toMilitaryTime } from './venueTimeHelpers';
import { RIGHT } from 'constants/tmxConstants';

const VENUE_IMAGE_RESOURCE_NAME = 'venueImage';
const VENUE_WEBSITE_RESOURCE_NAME = 'venueWebsite';

function findResource(resources: any[] | undefined, name: string): any {
  if (!Array.isArray(resources)) return undefined;
  return resources.find((r) => r?.name === name);
}

export function editVenue({
  venue,
  callback,
}: { venue?: any; callback?: (result: any) => void } = {}): void {
  // Get current venue details including courts and times
  const { venue: venueDetails } = tournamentEngine.findVenue({ venueId: venue.venueId });
  const courts = venueDetails?.courts || [];

  // Derive existing courtNameBase from court names if they follow a pattern
  const existingCourtNameBase = deriveCourtNameBase(courts);

  const existingImageResource = findResource(venueDetails?.onlineResources, VENUE_IMAGE_RESOURCE_NAME);
  const existingWebsiteResource = findResource(venueDetails?.onlineResources, VENUE_WEBSITE_RESOURCE_NAME);
  const existingImageURL = existingImageResource?.identifier || '';
  const existingWebsiteURL = existingWebsiteResource?.identifier || '';

  const existingAddress = (venueDetails?.addresses && venueDetails.addresses[0]) || {};

  const countryList = fixtures.countries
    .filter((c: any) => c.iso)
    .map((c: any) => ({
      label: fixtures.countryToFlag(c.iso) + ' ' + c.label,
      value: c.iso,
    }));
  let selectedCountryCode: string = existingAddress.countryCode || '';
  const onCountryCodeChange = (value: string) => {
    selectedCountryCode = (value || '').toUpperCase();
  };

  const values: any = {
    venueName: venue?.venueName || '',
    venueAbbreviation: venue?.venueAbbreviation || '',
    courtNameBase: existingCourtNameBase,
    defaultStartTime: venueDetails?.defaultStartTime || '',
    defaultEndTime: venueDetails?.defaultEndTime || '',
    venueWebsiteURL: existingWebsiteURL,
    venueImageURL: existingImageURL,
    addressLine1: existingAddress.addressLine1 || '',
    city: existingAddress.city || '',
    state: existingAddress.state || '',
    postalCode: existingAddress.postalCode || '',
    countryCode: existingAddress.countryCode || '',
    updateCourtNames: false,
  };

  const previewImage = document.createElement('img');
  previewImage.style.cssText = 'max-width: 100%; max-height: 160px; margin-top: 8px; border-radius: 4px;';
  previewImage.style.display = existingImageURL ? '' : 'none';
  if (existingImageURL) previewImage.src = existingImageURL;
  previewImage.onerror = () => {
    previewImage.style.display = 'none';
  };
  previewImage.onload = () => {
    previewImage.style.display = '';
  };

  const valueChange = () => {
    // Placeholder for future functionality
  };

  const enableSubmit = ({ inputs }: any) => {
    const timeError =
      inputs?.defaultStartTime?.classList.contains('is-danger') ||
      inputs?.defaultEndTime?.classList.contains('is-danger');
    const isValid =
      !timeError &&
      !!(
        validators.nameValidator(2, 6)(inputs['venueAbbreviation'].value) &&
        validators.nameValidator(5)(inputs['venueName'].value)
      );
    const saveButton = document.getElementById('saveVenueButton');
    if (saveButton) (saveButton as HTMLButtonElement).disabled = !isValid;
  };

  const validateTimeOrder = createTimeOrderValidator(enableSubmit);

  const onImageURLChange = ({ inputs }: any) => {
    const url = inputs?.venueImageURL?.value?.trim();
    if (url) {
      previewImage.src = url;
    } else {
      previewImage.removeAttribute('src');
      previewImage.style.display = 'none';
    }
  };

  const relationships = [
    { control: 'venueAbbreviation', onInput: enableSubmit },
    { control: 'venueName', onInput: enableSubmit },
    { control: 'defaultStartTime', onInput: validateTimeOrder },
    { control: 'defaultEndTime', onInput: validateTimeOrder },
    { control: 'venueImageURL', onInput: onImageURLChange },
  ];

  const content = (elem: HTMLElement) => {
    const inputs = renderForm(
      elem,
      [
        {
          error: t('pages.venues.editVenue.venueNameError'),
          validator: validators.nameValidator(5),
          placeholder: t('pages.venues.editVenue.venueNamePlaceholder'),
          value: values.venueName,
          onChange: valueChange,
          selectOnFocus: true,
          label: t('pages.venues.editVenue.venueNameLabel'),
          field: 'venueName',
          focus: true,
        },
        {
          error: t('pages.venues.editVenue.abbreviationError'),
          validator: validators.nameValidator(2, 6),
          placeholder: t('pages.venues.editVenue.abbreviationPlaceholder'),
          value: values.venueAbbreviation,
          onChange: valueChange,
          selectOnFocus: true,
          label: t('pages.venues.editVenue.abbreviationLabel'),
          field: 'venueAbbreviation',
        },
        {
          value: values.courtNameBase || '',
          label: t('pages.venues.addVenue.courtNameBase'),
          placeholder: t('pages.venues.addVenue.courtNameBasePlaceholder'),
          field: 'courtNameBase',
          onChange: valueChange,
        },
        {
          label: t('pages.venues.editVenue.updateCourtNames'),
          field: 'updateCourtNames',
          id: 'updateCourtNames',
          checkbox: true,
          checked: values.updateCourtNames,
        },
        {
          error: t('pages.venues.editVenue.timeOrderError'),
          value: toDisplayTime(values.defaultStartTime) || '8:00 AM',
          label: t('pages.venues.editVenue.openingTime'),
          placeholder: t('pages.venues.editVenue.openingTime'),
          field: 'defaultStartTime',
          onChange: valueChange,
        },
        {
          error: t('pages.venues.editVenue.timeOrderError'),
          value: toDisplayTime(values.defaultEndTime) || '8:00 PM',
          label: t('pages.venues.editVenue.closingTime'),
          placeholder: t('pages.venues.editVenue.closingTime'),
          field: 'defaultEndTime',
          onChange: valueChange,
        },
        {
          value: values.venueWebsiteURL,
          label: t('pages.venues.editVenue.websiteLabel'),
          placeholder: 'https://example.com',
          field: 'venueWebsiteURL',
          onChange: valueChange,
        },
        {
          value: values.venueImageURL,
          label: t('pages.venues.editVenue.imageLabel'),
          placeholder: 'https://example.com/image.jpg',
          field: 'venueImageURL',
          onChange: valueChange,
        },
        {
          value: values.addressLine1,
          label: t('pages.venues.editVenue.addressLine1Label'),
          field: 'addressLine1',
          onChange: valueChange,
        },
        {
          value: values.city,
          label: t('pages.venues.editVenue.cityLabel'),
          field: 'city',
          onChange: valueChange,
        },
        {
          value: values.state,
          label: t('pages.venues.editVenue.stateLabel'),
          field: 'state',
          onChange: valueChange,
        },
        {
          value: values.postalCode,
          label: t('pages.venues.editVenue.postalCodeLabel'),
          field: 'postalCode',
          onChange: valueChange,
        },
        {
          typeAhead: { list: countryList, callback: onCountryCodeChange, currentValue: values.countryCode },
          label: t('pages.venues.editVenue.countryCodeLabel'),
          placeholder: t('pages.venues.editVenue.countryCodePlaceholder'),
          field: 'countryCode',
        },
      ],
      relationships,
    );

    if (inputs?.defaultStartTime) attachTimePicker(inputs.defaultStartTime as HTMLInputElement);
    if (inputs?.defaultEndTime) attachTimePicker(inputs.defaultEndTime as HTMLInputElement);

    if (inputs?.venueImageURL?.parentElement) {
      inputs.venueImageURL.parentElement.appendChild(previewImage);
    } else {
      elem.appendChild(previewImage);
    }

    return inputs;
  };

  const saveVenue = () => {
    const venueName = context.drawer.attributes.content.venueName.value;
    const venueAbbreviation = context.drawer.attributes.content.venueAbbreviation.value;
    const courtNameBase = context.drawer.attributes.content.courtNameBase?.value || '';
    const updateCourtNames = context.drawer.attributes.content.updateCourtNames.checked;
    const defaultStartTime = context.drawer.attributes.content.defaultStartTime?.value;
    const defaultEndTime = context.drawer.attributes.content.defaultEndTime?.value;

    // Validation
    if (!venueName || venueName.length < 5) {
      tmxToast({ message: t('pages.venues.editVenue.venueNameRequired'), intent: 'is-danger' });
      return;
    }

    if (!venueAbbreviation || venueAbbreviation.length < 2 || venueAbbreviation.length > 6) {
      tmxToast({ message: t('pages.venues.editVenue.abbreviationRequired'), intent: 'is-danger' });
      return;
    }

    const venueUpdates: any = { venueName, venueAbbreviation };

    if (defaultStartTime) venueUpdates.defaultStartTime = toMilitaryTime(defaultStartTime);
    if (defaultEndTime) venueUpdates.defaultEndTime = toMilitaryTime(defaultEndTime);

    const addressLine1 = (context.drawer.attributes.content.addressLine1?.value || '').trim();
    const city = (context.drawer.attributes.content.city?.value || '').trim();
    const state = (context.drawer.attributes.content.state?.value || '').trim();
    const postalCode = (context.drawer.attributes.content.postalCode?.value || '').trim();
    const countryCode = (selectedCountryCode || '').trim().toUpperCase();

    const addressChanged =
      addressLine1 !== (existingAddress.addressLine1 || '') ||
      city !== (existingAddress.city || '') ||
      state !== (existingAddress.state || '') ||
      postalCode !== (existingAddress.postalCode || '') ||
      countryCode !== (existingAddress.countryCode || '');

    if (addressChanged) {
      const nextAddress: any = { ...existingAddress };
      if (addressLine1) nextAddress.addressLine1 = addressLine1;
      else delete nextAddress.addressLine1;
      if (city) nextAddress.city = city;
      else delete nextAddress.city;
      if (state) nextAddress.state = state;
      else delete nextAddress.state;
      if (postalCode) nextAddress.postalCode = postalCode;
      else delete nextAddress.postalCode;
      if (countryCode) nextAddress.countryCode = countryCode;
      else delete nextAddress.countryCode;
      venueUpdates.addresses = [nextAddress, ...(venueDetails?.addresses?.slice(1) || [])];
    }

    // Update court names when checkbox is selected and the naming root changed
    const nameRoot = courtNameBase || venueAbbreviation;
    const previousRoot = existingCourtNameBase || venue.venueAbbreviation;
    const rootChanged = nameRoot !== previousRoot;
    if (updateCourtNames && rootChanged && courts.length > 0) {
      venueUpdates.courts = courts.map((court: any, index: number) => ({
        courtId: court.courtId,
        courtName: `${nameRoot} ${index + 1}`,
      }));
    }

    const courtsUpdated = updateCourtNames && rootChanged && courts.length > 0;

    const websiteURL = (context.drawer.attributes.content.venueWebsiteURL?.value || '').trim();
    const imageURL = (context.drawer.attributes.content.venueImageURL?.value || '').trim();

    const venueId = venue.venueId;
    const methods: any[] = [{ method: MODIFY_VENUE, params: { venueId, modifications: venueUpdates } }];

    const resourceMutation = (
      name: string,
      resourceSubType: string,
      currentURL: string,
      previousResource: any,
    ) => {
      const previousURL = previousResource?.identifier || '';
      if (currentURL === previousURL) return;
      if (currentURL) {
        methods.push({
          method: ADD_ONLINE_RESOURCE,
          params: {
            venueId,
            onlineResource: { name, resourceType: 'URL', resourceSubType, identifier: currentURL },
          },
        });
      } else if (previousResource) {
        methods.push({
          method: REMOVE_ONLINE_RESOURCE,
          params: {
            venueId,
            onlineResource: {
              resourceType: previousResource.resourceType,
              resourceSubType: previousResource.resourceSubType,
              identifier: previousResource.identifier,
            },
          },
        });
      }
    };

    resourceMutation(VENUE_WEBSITE_RESOURCE_NAME, 'WEBSITE', websiteURL, existingWebsiteResource);
    resourceMutation(VENUE_IMAGE_RESOURCE_NAME, 'IMAGE', imageURL, existingImageResource);

    const postMutation = (result: any) => {
      if (result.success) {
        if (isFunction(callback)) {
          callback({
            ...result,
            venueUpdates: { ...venueUpdates, venueWebsiteURL: websiteURL, venueImageURL: imageURL },
            courtsUpdated,
          });
        }
      } else if (result.error) {
        tmxToast({ intent: 'is-warning', message: result.error?.message || t('common.error') });
        if (isFunction(callback)) callback(result);
      }
    };

    mutationRequest({ methods, callback: postMutation });
  };

  const isValidForSave = () => {
    const venueName = context.drawer.attributes.content.venueName.value;
    const venueAbbreviation = context.drawer.attributes.content.venueAbbreviation.value;
    return (
      venueName &&
      venueName.length >= 5 &&
      venueAbbreviation &&
      venueAbbreviation.length >= 2 &&
      venueAbbreviation.length <= 6
    );
  };

  const footer = (elem: HTMLElement, close: () => void) =>
    renderButtons(
      elem,
      [
        { label: t('common.cancel'), close: true },
        {
          onClick: saveVenue,
          id: 'saveVenueButton',
          intent: 'is-info',
          disabled: !isValidForSave(),
          label: t('common.save'),
          close: true,
        },
      ],
      close,
    );

  context.drawer.open({
    title: `<b style='larger'>${t('pages.venues.editVenue.title')}</b>`,
    width: '300px',
    side: RIGHT,
    content,
    footer,
  });
}

