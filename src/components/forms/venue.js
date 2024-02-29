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
      error: 'Please enter a name of at least 5 characters',
      placeholder: 'Venue name',
      value: values.venueName || '',
      validator: nameValidator(5),
      label: 'Venue name',
      field: 'venueName',
      focus: true,
      onChange,
    },
    {
      error: 'Please enter an abbreviation of 2-6 characters',
      value: values.venueAbbreviation || '',
      validator: nameValidator(2, 6),
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

export function getVenueFormValues(content) {
  return {
    venueAbbreviation: content?.venueAbbreviation.value,
    courtsCount: content?.courtsCount.value,
    venueName: content?.venueName.value,
  };
}
