/**
 * DEMO MODE — simulate any lockdown posture without touching the server.
 *
 * Reached from the avatar menu (`initLoginToggle`). Three tiers, top to bottom:
 * a preset picker, the raw capability grid, and the honesty legend.
 *
 * The preset picker **sets the checkboxes** and is then done — it never becomes
 * a second code path. Ticking any box afterwards flips the posture to `custom`.
 *
 * Every control writes through `demoState`, which composes inside
 * `providerConfig`'s accessors — the same path production uses. There is no
 * demo-only branch anywhere in the gating code (standard A1).
 *
 * ## Honesty
 *
 * Each row carries a coverage badge from `capabilityCoverage`. A key that gates
 * nothing renders as `—` with a warning, because a checkbox that looks like it
 * works while changing nothing would mislead whoever is being demonstrated to.
 */
import { BOOLEAN_PERMISSION_KEYS } from '@courthive/provider-config';

import { clearDemoOverlay, getDemoOverlay, setDemoOverlay, setDemoPermission } from 'services/demoMode/demoState';
import { DEMO_PRESET_IDS, overridesForPreset } from 'services/demoMode/demoPresets';
import { coverageFor } from 'services/capability/capabilityCoverage';
import { renderDemoAffordance } from 'services/demoMode/demoAffordance';
import { context } from 'services/context';
import { t } from 'i18n';

import type { DemoPresetId } from 'services/demoMode/demoPresets';
import type { ProviderPermissions } from '@courthive/provider-config';
import { RIGHT } from 'constants/tmxConstants';

type Key = keyof ProviderPermissions;

/** Grouping mirrors the ProviderPermissions declaration order. */
const GROUPS: { labelKey: string; keys: Key[] }[] = [
  {
    labelKey: 'participants',
    keys: [
      'canCreateCompetitors',
      'canCreateOfficials',
      'canDeleteParticipants',
      'canImportParticipants',
      'canEditParticipantDetails',
      'canModifyEntries',
      'canModifyRatings',
    ],
  },
  { labelKey: 'events', keys: ['canCreateEvents', 'canDeleteEvents', 'canModifyEventFormat'] },
  {
    labelKey: 'draws',
    keys: [
      'canCreateDraws',
      'canDeleteDraws',
      'canAssignPositions',
      'canModifyStructures',
      'canUseDraftPositioning',
      'canUseManualPositioning',
    ],
  },
  { labelKey: 'scheduling', keys: ['canModifySchedule', 'canUseBulkScheduling', 'canModifyScheduleScenarios'] },
  {
    labelKey: 'venues',
    keys: ['canCreateVenues', 'canDeleteVenues', 'canModifyCourtAvailability', 'canManagePracticeCourts'],
  },
  { labelKey: 'scoring', keys: ['canEnterScores', 'canModifyCompletedScores'] },
  { labelKey: 'publishing', keys: ['canPublish', 'canUnpublish'] },
  {
    labelKey: 'settings',
    keys: ['canModifyTournamentDetails', 'canModifyPolicies', 'canLinkTournaments', 'canAccessProviderAdmin'],
  },
  { labelKey: 'communication', keys: ['canUseChat'] },
];

function isKeyAllowed(key: Key): boolean {
  return getDemoOverlay()?.permissions[key] !== false;
}

function badgeElement(key: Key): HTMLElement {
  const coverage = coverageFor(key);
  const span = document.createElement('span');
  span.className = `tmx-demo-badge tmx-demo-badge-${coverage}`;
  span.textContent = coverage === 'both' ? 'UI+MUT' : coverage === 'ui' ? 'UI' : coverage === 'mutation' ? 'MUT' : '—';
  span.title =
    coverage === 'none'
      ? t('demoMode.badge.none')
      : coverage === 'ui'
        ? t('demoMode.badge.ui')
        : coverage === 'mutation'
          ? t('demoMode.badge.mutation')
          : t('demoMode.badge.both');
  return span;
}

export function demoModeDrawer(): void {
  const content = document.createElement('div');
  content.className = 'tmx-demo-panel';

  const warning = document.createElement('div');
  warning.className = 'tmx-demo-warning';
  warning.textContent = t('demoMode.clientOnly');
  content.appendChild(warning);

  // ── Posture ──
  const postureHeading = document.createElement('div');
  postureHeading.className = 'tmx-demo-heading';
  postureHeading.textContent = t('demoMode.posture');
  content.appendChild(postureHeading);

  const rerender = () => {
    context.drawer.close();
    demoModeDrawer();
    renderDemoAffordance();
  };

  for (const preset of DEMO_PRESET_IDS) {
    const row = document.createElement('label');
    row.className = 'tmx-demo-preset';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'tmx-demo-preset';
    radio.checked = (getDemoOverlay()?.preset ?? 'providerDefaults') === preset;
    radio.addEventListener('change', () => {
      const overrides = overridesForPreset(preset as DemoPresetId);
      if (!overrides) clearDemoOverlay();
      else setDemoOverlay({ v: 1, preset, permissions: overrides });
      rerender();
    });
    const text = document.createElement('span');
    text.textContent = t(`demoMode.presets.${preset}`);
    row.append(radio, text);
    content.appendChild(row);
  }

  // ── Capabilities ──
  const capsHeading = document.createElement('div');
  capsHeading.className = 'tmx-demo-heading';
  capsHeading.textContent = t('demoMode.capabilities');
  content.appendChild(capsHeading);

  const known = new Set<string>(BOOLEAN_PERMISSION_KEYS);
  for (const group of GROUPS) {
    const groupLabel = document.createElement('div');
    groupLabel.className = 'tmx-demo-group';
    groupLabel.textContent = t(`demoMode.groups.${group.labelKey}`);
    content.appendChild(groupLabel);

    for (const key of group.keys) {
      if (!known.has(key)) continue; // key retired upstream — skip rather than render a dead row
      const row = document.createElement('label');
      row.className = 'tmx-demo-row';

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = isKeyAllowed(key);
      box.addEventListener('change', () => {
        setDemoPermission(key, box.checked);
        renderDemoAffordance();
      });

      const label = document.createElement('span');
      label.className = 'tmx-demo-label';
      label.textContent = key;

      row.append(box, label, badgeElement(key));
      content.appendChild(row);
    }
  }

  const legend = document.createElement('div');
  legend.className = 'tmx-demo-legend';
  legend.textContent = t('demoMode.legend');
  content.appendChild(legend);

  const footer = document.createElement('div');
  const exit = document.createElement('button');
  exit.className = 'button is-warning';
  exit.textContent = t('demoMode.exit');
  exit.addEventListener('click', () => {
    clearDemoOverlay();
    context.drawer.close();
    renderDemoAffordance();
  });
  footer.appendChild(exit);

  context.drawer.open({ title: t('demoMode.title'), content, footer, side: RIGHT, width: '420px' });
}
