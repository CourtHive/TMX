/**
 * Tournament seeding-policy panel.
 *
 * Binds a seeding policy to the tournamentRecord, which is where seeding compliance belongs: every
 * draw in the competition then seeds by the same rule, including one regenerated a week later, and
 * the add-draw form's existing "Inherited" option is already the path that reads it.
 *
 * The catalog side of this already existed — a seeding editor in courthive-components, a `/policies`
 * page that persists what it produces. This panel is the missing link between a policy sitting in
 * that catalog and a draw actually being seeded by it.
 */
import {
  ATTACHED_POLICY_ID,
  NO_POLICY_ID,
  SeedingPolicyChoice,
  buildAttachedChoice,
  describeThresholds,
  loadSeedingChoices,
  resolveAttachedChoiceId,
} from 'services/policies/seedingPolicyChoices';
import { ATTACH_POLICIES, REMOVE_POLICY } from 'constants/mutationConstants';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { providerConfig } from 'config/providerConfig';
import { policyConstants } from 'tods-competition-factory';
import { t } from 'i18n';

const { POLICY_TYPE_SEEDING } = policyConstants;

export const SEEDING_POLICY_PANEL_ID = 'seedingPolicyPanel';

/** The seeding policy attached to the tournamentRecord, or null. */
function attachedPolicy(): Record<string, any> | null {
  const result: any = tournamentEngine.getPolicyDefinitions({ policyTypes: [POLICY_TYPE_SEEDING] });
  return result?.policyDefinitions?.[POLICY_TYPE_SEEDING] ?? null;
}

export function buildSeedingPolicyPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.id = SEEDING_POLICY_PANEL_ID;
  panel.className = 'settings-panel panel-indigo';
  panel.style.gridColumn = '1 / -1';
  void renderPanelContents(panel);
  return panel;
}

async function renderPanelContents(panel: HTMLElement): Promise<void> {
  const attached = attachedPolicy();
  const choices = await loadSeedingChoices();
  const matchedId = resolveAttachedChoiceId(attached, choices);
  const locked = providerConfig.isSeedingPolicyLocked();

  // An attached policy that matches no catalog entry would otherwise be unrepresentable in the
  // select — it would silently display as whatever sits first, and saving would replace it.
  const options = attached
    ? [buildAttachedChoice(attached, choices.find((choice) => choice.id === matchedId)?.label ?? null), ...choices]
    : choices;

  panel.innerHTML = `<h3><i class="fa-solid fa-list-ol"></i> ${t('settings.seedingPolicy.title')}</h3>`;

  const description = document.createElement('p');
  description.style.cssText = 'margin: 0 0 12px 0; color: var(--tmx-text-secondary); font-size: 0.85rem;';
  description.textContent = locked ? t('settings.seedingPolicy.locked') : t('settings.seedingPolicy.intro');
  panel.appendChild(description);

  const select = document.createElement('select');
  select.className = 'input';
  select.style.cssText = 'max-width: 420px;';
  select.disabled = locked && options.length <= 1;
  for (const choice of options) {
    const option = new Option(choice.label, choice.id);
    option.selected = attached ? choice.id === ATTACHED_POLICY_ID : choice.id === NO_POLICY_ID;
    select.add(option);
  }
  panel.appendChild(select);

  const thresholds = document.createElement('div');
  thresholds.style.cssText =
    'margin: 10px 0 0 0; color: var(--tmx-text-secondary); font-size: 0.8rem; font-family: var(--tmx-font-mono, monospace);';
  const paintThresholds = () => {
    const selected = options.find((choice) => choice.id === select.value);
    const pairs = describeThresholds(selected?.definition?.[POLICY_TYPE_SEEDING]);
    // Naming a policy does not say how deeply it seeds; the threshold table does.
    thresholds.textContent = pairs.length ? `${t('settings.seedingPolicy.thresholds')}  ${pairs.join('   ')}` : '';
  };
  paintThresholds();
  select.addEventListener('change', paintThresholds);
  panel.appendChild(thresholds);

  const actions = document.createElement('div');
  actions.style.cssText = 'margin-top: 12px; display: flex; gap: 8px;';
  const save = document.createElement('button');
  save.className = 'button is-info is-small';
  save.textContent = t('common.save');
  save.onclick = () => applySelection(options, select.value, () => void renderPanelContents(panel));
  actions.appendChild(save);
  panel.appendChild(actions);
}

function applySelection(choices: SeedingPolicyChoice[], selectedId: string, refresh: () => void): void {
  // Re-selecting what is already attached is a no-op, not a re-attach: attaching rewrites the
  // extension and would churn the tournamentRecord for no change.
  if (selectedId === ATTACHED_POLICY_ID) return;

  const choice = choices.find((entry) => entry.id === selectedId);
  if (!choice) return;

  const methods = choice.definition
    ? [
        {
          method: ATTACH_POLICIES,
          params: { policyDefinitions: choice.definition, allowReplacement: true },
        },
      ]
    : [{ method: REMOVE_POLICY, params: { policyType: POLICY_TYPE_SEEDING } }];

  mutationRequest({
    methods,
    callback: (result: any) => {
      if (result?.success) {
        refresh();
      } else {
        tmxToast({ message: t('common.error'), intent: 'is-danger' });
      }
    },
  });
}
