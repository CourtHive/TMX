/**
 * Get avoidance policy form items with checkboxes.
 * Provides form configuration for selecting avoidance rules (pairs, teams, country, city, etc.).
 */
import { getAttachedAvoidances } from './getAttachedAvoidances';
import { avoidanceRules } from './avoidanceRules';
import { t } from 'i18n';

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
      text: t('avoidances.selectRules'),
    },
    {
      checked: selected.includes('pairs'),
      label: t('avoidances.doublesPairs'),
      id: 'avoidancePairs',
      checkbox: true,
      field: 'pairs',
    },
    {
      checked: selected.includes('groups'),
      id: 'avoidanceGroups',
      checkbox: true,
      label: t('pages.participants.groups'),
      field: 'groups',
    },
    {
      checked: selected.includes('teams'),
      id: 'avoidanceTeams',
      checkbox: true,
      label: t('events.teams'),
      field: 'teams',
    },
    {
      checked: selected.includes('iso'),
      id: 'avoidanceCountry',
      label: t('tables.participants.country'),
      checkbox: true,
      field: 'iso',
    },
    {
      checked: selected?.includes('city'),
      id: 'avoidancedCity',
      checkbox: true,
      label: t('pages.venues.editVenue.cityLabel'),
      field: 'city',
    },
    {
      checked: selected.includes('state'),
      id: 'avoidancedState',
      checkbox: true,
      label: t('officials.columns.state'),
      field: 'state',
    },
    {
      checked: selected.includes('zip'),
      id: 'avoidancedPostal',
      label: t('pages.venues.editVenue.postalCodeLabel'),
      checkbox: true,
      field: 'zip',
    },
    {
      label: t('avoidances.postalCodeDigits'),
      visible: false,
      field: 'zip',
    },
  ];

  return { items };
}
