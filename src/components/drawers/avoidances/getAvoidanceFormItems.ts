/**
 * Get avoidance policy form items with checkboxes.
 * Provides form configuration for selecting avoidance rules (pairs, teams, country, city, etc.).
 */
import { getAttachedAvoidances } from './getAttachedAvoidances';
import { avoidanceRules } from './avoidanceRules';

export function getAvoidanceFormItems({ event }: { event: any }): { items: any[] } {
  const policyAttributes = getAttachedAvoidances({ eventId: event.eventId });

  const selected =
    policyAttributes
      ?.map((attribute: any) =>
        Object.keys(avoidanceRules).find((key) => {
          const rules = avoidanceRules[key];
          return rules.some(
            (rule: any) =>
              (rule.directive && rule.directive === attribute.directive) || (rule.key && rule.key === attribute.key),
          );
        }),
      )
      .filter(Boolean) ?? [];

  const items = [
    {
      text: 'Select rules',
    },
    {
      checked: selected.includes('pairs'),
      label: 'Doubles pairs',
      id: 'avoidancePairs',
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
      label: 'Postal code digits',
      visible: false,
      field: 'zip',
    },
  ];

  return { items };
}
