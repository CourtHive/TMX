/**
 * Venue form configuration and value extraction.
 * Provides form fields for venue name, abbreviation, court count, and operating hours with validation.
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
      value: values.courtNameBase || '',
      label: t('pages.venues.addVenue.courtNameBase'),
      placeholder: t('pages.venues.addVenue.courtNameBasePlaceholder'),
      field: 'courtNameBase',
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
    {
      error: t('pages.venues.addVenue.timeOrderError'),
      value: toDisplayTime(values.defaultStartTime) || '8:00 AM',
      label: t('pages.venues.addVenue.openingTime'),
      placeholder: t('pages.venues.addVenue.openingTime'),
      field: 'defaultStartTime',
      id: 'venueStartTime',
      onChange,
    },
    {
      error: t('pages.venues.addVenue.timeOrderError'),
      value: toDisplayTime(values.defaultEndTime) || '8:00 PM',
      label: t('pages.venues.addVenue.closingTime'),
      placeholder: t('pages.venues.addVenue.closingTime'),
      field: 'defaultEndTime',
      id: 'venueEndTime',
      onChange,
    },
  ];
}

export function getVenueFormValues(content: any): any {
  return {
    venueAbbreviation: content?.venueAbbreviation.value,
    courtNameBase: content?.courtNameBase?.value || '',
    defaultStartTime: content?.defaultStartTime?.value,
    defaultEndTime: content?.defaultEndTime?.value,
    courtsCount: content?.courtsCount.value,
    venueName: content?.venueName.value,
  };
}

/**
 * Derive the common name base from existing court names.
 * e.g. ["GHC 1", "GHC 2", "GHC 3"] → "GHC"
 * Returns empty string if no common pattern is found.
 */
export function deriveCourtNameBase(courts: any[]): string {
  if (!courts?.length) return '';
  const bases = courts.map((c: any) => {
    const name = c.courtName || '';
    const match = name.match(/^(.+?)\s+\d+$/);
    return match ? match[1] : '';
  });
  const first = bases[0];
  if (first && bases.every((b: string) => b === first)) return first;
  return '';
}

/** Convert military time (e.g. "08:00", "20:00") to 12h display (e.g. "8:00 AM", "8:00 PM"). */
export function toDisplayTime(value?: string): string {
  if (!value) return '';
  const parts = value.split(':');
  const hours = Number(parts[0]);
  const minutes = parts[1] || '00';
  if (isNaN(hours)) return value;
  if (hours === 0) return `12:${minutes} AM`;
  if (hours === 12) return `12:${minutes} PM`;
  if (hours > 12) return `${hours - 12}:${minutes} PM`;
  return `${hours}:${minutes} AM`;
}
