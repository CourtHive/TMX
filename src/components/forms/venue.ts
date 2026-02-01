/**
 * Venue form configuration and value extraction.
 * Provides form fields for venue name, abbreviation, and court count with validation.
 */
import { validators } from 'courthive-components';

export function venueForm({ values, valueChange, isValid }: { values: any; valueChange: (e: Event) => void; isValid?: boolean }): any[] {
  if (isValid) {
    // function to call with current validity of form values
  }
  const numberValidator = (value: string) => !isNaN(Number(value));
  const onChange = (e: Event) => valueChange(e);

  return [
    {
      error: 'Please enter a name of at least 5 characters',
      placeholder: 'Venue name',
      value: values.venueName || '',
      validator: validators.nameValidator(5),
      label: 'Venue name',
      field: 'venueName',
      focus: true,
      onChange,
    },
    {
      error: 'Please enter an abbreviation of 2-6 characters',
      value: values.venueAbbreviation || '',
      validator: validators.nameValidator(2, 6),
      field: 'venueAbbreviation',
      label: 'Abbreviation',
      onChange,
    },
    {
      error: 'Must be a whole number',
      value: values.courtsCount || '',
      validator: numberValidator,
      label: 'Number of courts',
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
