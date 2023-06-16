export function venueForm({ values, valueChange, isValid }) {
  if (isValid) {
    // function to call with current validity of form values
  }
  const nameValidator = (minLength, maxLength) => (value) =>
    value.length >= minLength && (!maxLength || (maxLength && value.length <= maxLength));
  const numberValidator = (value) => !isNaN(value);
  const onChange = (e) => valueChange(e);

  return [
    {
      placeholder: 'Venue name',
      value: values.venueName || '',
      label: 'Venue name',
      field: 'venueName',
      error: 'Please enter a name of at least 5 characters',
      validator: nameValidator(5),
      onChange
    },
    {
      value: values.venueAbbreviation || '',
      label: 'Abbreviation',
      field: 'venueAbbreviation',
      error: 'Please enter an abbreviation of 2-6 characters',
      validator: nameValidator(2, 6),
      onChange
    },
    {
      value: values.courtsCount || '',
      label: 'Number of courts',
      field: 'courtsCount',
      error: 'Must be a whole number',
      validator: numberValidator,
      onChange
    }
  ];
}

export function getVenueFormValues(content) {
  return {
    venueAbbreviation: content?.venueAbbreviation.value,
    courtsCount: content?.courtsCount.value,
    venueName: content?.venueName.value
  };
}
