/**
 * Venue form configuration and value extraction.
 * Provides form fields for venue name, abbreviation, and court count with validation.
 */
import { validators } from 'courthive-components';
import { t } from 'i18n';

export function venueForm({ values, valueChange, isValid }: { values: any; valueChange: (e: Event) => void; isValid?: boolean }): any[] {
  if (isValid) {
    // function to call with current validity of form values
  }
  const numberValidator = (value: string) => !isNaN(Number(value));
  const onChange = (e: Event) => valueChange(e);

  return [
    {
      error: t('pages.venues.addVenue.venueNameError'),
      placeholder: t('pages.venues.addVenue.venueName'),
      value: values.venueName || '',
      validator: validators.nameValidator(5),
      label: t('pages.venues.addVenue.venueName'),
      field: 'venueName',
      focus: true,
      onChange,
    },
    {
      error: t('pages.venues.addVenue.abbreviationError'),
      value: values.venueAbbreviation || '',
      validator: validators.nameValidator(2, 6),
      field: 'venueAbbreviation',
      label: t('pages.venues.addVenue.abbreviation'),
      onChange,
    },
    {
      error: t('pages.venues.addVenue.numberOfCourtsError'),
      value: values.courtsCount || '',
      validator: numberValidator,
      label: t('pages.venues.addVenue.numberOfCourts'),
      field: 'courtsCount',
      onChange,
    },
  ];
}

export function getVenueFormValues(content: any): any {
  return {
    venueAbbreviation: content?.venueAbbreviation.value,
    courtsCount: content?.courtsCount.value,
    venueName: content?.venueName.value,
  };
}
