import { getAttachedAvoidances } from './getAttachedAvoidances';
import { avoidanceRules } from './avoidanceRules';

export function getAvoidanceFormItems({ event }) {
  const policyAttributes = getAttachedAvoidances({ eventId: event.eventId });

  const selected =
    policyAttributes
      ?.map((attribute) =>
        Object.keys(avoidanceRules).find((key) => {
          const rules = avoidanceRules[key];
          return rules.some(
            (rule) =>
              (rule.directive && rule.directive === attribute.directive) || (rule.key && rule.key === attribute.key),
          );
        }),
      )
      .filter(Boolean) ?? [];

  // TODO: if Teams or Groups checked, display button [All teams], [All groups]
  // clicking the button launches modal to select the teams to be included in the avoidance
  // and when only a few teams or groups are selected, [1 Team], [3 Groups]

  const items = [
    {
      text: 'Select rules',
    },
    {
      checked: selected.includes('pairs'),
      label: 'Doubles pairs',
      id: 'avoidancePairs', // necessary to differentiate the checkbox elements
      checkbox: true,
      field: 'pairs',
    },
    {
      checked: selected.includes('groups'),
      id: 'avoidanceGroups',
      checkbox: true,
      label: 'Groups',
      field: 'groups',
    },
    {
      checked: selected.includes('teams'),
      id: 'avoidanceTeams',
      checkbox: true,
      label: 'Teams',
      field: 'teams',
    },
    {
      checked: selected.includes('iso'),
      id: 'avoidanceCountry',
      label: 'Country',
      checkbox: true,
      field: 'iso',
    },
    {
      checked: selected?.includes('city'),
      id: 'avoidancedCity',
      checkbox: true,
      label: 'City',
      field: 'city',
    },
    {
      checked: selected.includes('state'),
      id: 'avoidancedState',
      checkbox: true,
      label: 'State',
      field: 'state',
    },
    {
      checked: selected.includes('zip'),
      id: 'avoidancedPostal',
      label: 'Postal code',
      checkbox: true,
      field: 'zip',
    },
    {
      label: 'Postal code digits', // relationship with Postal code
      // options: [5,4,3,2,1]
      visible: false,
      field: 'zip',
      /*
    },
    {
      divider: true
      // here be buttons!
      */
    },
  ];

  return { items };
}
