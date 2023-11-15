export function getAvoidanceFormItems({ event }) {
  !!event;

  const items = [
    {
      text: 'Select rules'
    },
    {
      label: 'Doubles pairs',
      id: 'avoidancePairs',
      checkbox: true,
      field: 'pairs'
    },
    {
      id: 'avoidanceTeams',
      checkbox: true,
      label: 'Teams',
      field: 'teams'
    },
    {
      id: 'avoidanceCountry',
      label: 'Country',
      checkbox: true,
      field: 'iso'
    },
    {
      id: 'avoidancedCity',
      checkbox: true,
      label: 'City',
      field: 'city'
    },
    {
      id: 'avoidancedState',
      checkbox: true,
      label: 'State',
      field: 'state'
    },
    {
      id: 'avoidancedPostal',
      label: 'Postal code',
      checkbox: true,
      field: 'zip'
    },
    {
      label: 'Postal code digits', // relationship with Postal code
      visible: false,
      field: 'zip'
    },
    {
      divider: true
    },
    {
      text: 'Select Groups'
    }
  ];

  return { items };
}
