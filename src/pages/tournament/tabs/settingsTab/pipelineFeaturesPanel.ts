/**
 * Settings → Pipeline features: the factory's exit-propagation options, for testing.
 *
 * Offered only where `isPipelineEligible` holds (logged out, or a mock tournament). Disabled outright when the
 * tournament carries a scoring policy of its own, because that policy decides the per-call options and the panel
 * could only pretend to. The logic — the gate, what each control means, which mutation it makes — lives in
 * `services/pipeline/pipelineFeatures`; this file only draws it.
 */
import { pipelineConfig, PIPELINE_CALL_KEYS } from 'config/pipelineConfig';
import { persistConfigToStorage } from 'services/settings/settingsStorage';
import { syncPipelineBadge } from 'components/popovers/tournamentHeader';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getLoginState } from 'services/authentication/loginState';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { policyConstants } from 'tods-competition-factory';
import { t } from 'i18n';
import {
  PIPELINE_POLICY_KEYS,
  hasForeignPolicy,
  isPipelineActive,
  policyMutation,
  readPolicySettings,
} from 'services/pipeline/pipelineFeatures';

import type { PipelinePolicyType, PipelinePolicySettings } from 'services/pipeline/pipelineFeatures';
import type { PipelineSetting } from 'config/pipelineConfig';

const { POLICY_TYPE_SCORING, POLICY_TYPE_PROGRESSION } = policyConstants;

export const PIPELINE_FEATURES_PANEL_ID = 'pipelineFeaturesPanel';

const SETTINGS: PipelineSetting[] = ['default', 'on', 'off'];
const MUTED = 'margin: 0 0 10px 0; color: var(--tmx-text-secondary); font-size: 0.85rem;';

export function buildPipelineFeaturesPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.id = PIPELINE_FEATURES_PANEL_ID;
  panel.className = 'settings-panel panel-orange';
  panel.style.gridColumn = '1 / -1';
  renderPanelContents(panel);
  return panel;
}

function renderPanelContents(panel: HTMLElement): void {
  const record = tournamentEngine.q.tournament();
  const active = isPipelineActive(record, !!getLoginState());

  panel.innerHTML = `<h3><i class="fa-solid fa-diagram-project"></i> ${t('settings.pipelineFeatures.title')}</h3>`;
  panel.appendChild(paragraph(active ? t('settings.pipelineFeatures.intro') : t('settings.pipelineFeatures.disabled')));
  if (!active) return;

  const refresh = () => {
    renderPanelContents(panel);
    syncPipelineBadge();
  };

  // Per call: device settings, applied by mutationRequest to every setMatchUpStatus.
  panel.appendChild(heading(t('settings.pipelineFeatures.perCall')));
  for (const key of PIPELINE_CALL_KEYS) {
    panel.appendChild(
      settingRow(key, pipelineConfig.get()[key], false, (setting) => {
        pipelineConfig.set({ [key]: setting });
        persistConfigToStorage();
        syncPipelineBadge();
      }),
    );
  }

  // Attached: a marked policy on the tournament, since the factory never reads these from the call.
  panel.appendChild(heading(t('settings.pipelineFeatures.policy')));
  for (const policyType of [POLICY_TYPE_SCORING, POLICY_TYPE_PROGRESSION] as PipelinePolicyType[]) {
    const locked = policyType === POLICY_TYPE_PROGRESSION && hasForeignPolicy(record, policyType);
    if (locked) panel.appendChild(paragraph(t('settings.pipelineFeatures.progressionLocked')));
    const settings = readPolicySettings(record, policyType);
    for (const key of PIPELINE_POLICY_KEYS[policyType]) {
      panel.appendChild(
        settingRow(key, settings[key], locked, (setting) =>
          applyPolicySetting(policyType, { ...settings, [key]: setting }, refresh),
        ),
      );
    }
  }
}

function applyPolicySetting(policyType: PipelinePolicyType, settings: PipelinePolicySettings, refresh: () => void) {
  const method = policyMutation(tournamentEngine.q.tournament(), policyType, settings);
  if (!method) return refresh();
  mutationRequest({
    methods: [method],
    callback: (result: any) => {
      if (!result?.success) tmxToast({ message: t('common.error'), intent: 'is-danger' });
      refresh();
    },
  });
}

function settingRow(
  key: string,
  value: PipelineSetting,
  disabled: boolean,
  onChange: (setting: PipelineSetting) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 4px 0;';

  const label = document.createElement('label');
  label.htmlFor = `pipeline-${key}`;
  label.textContent = t(`settings.pipelineFeatures.options.${key}`);

  const select = document.createElement('select');
  select.className = 'input is-small';
  select.id = `pipeline-${key}`;
  select.dataset.pipelineOption = key;
  select.style.cssText = 'max-width: 120px;';
  select.disabled = disabled;
  for (const setting of SETTINGS) {
    const option = new Option(t(`settings.pipelineFeatures.${setting}`), setting);
    option.selected = setting === value;
    select.add(option);
  }
  select.addEventListener('change', () => onChange(select.value as PipelineSetting));

  row.append(label, select);
  return row;
}

function heading(text: string): HTMLElement {
  const element = document.createElement('h4');
  element.style.cssText = 'margin: 12px 0 4px 0; font-size: 0.9rem; font-weight: 600;';
  element.textContent = text;
  return element;
}

function paragraph(text: string): HTMLElement {
  const element = document.createElement('p');
  element.style.cssText = MUTED;
  element.textContent = text;
  return element;
}
