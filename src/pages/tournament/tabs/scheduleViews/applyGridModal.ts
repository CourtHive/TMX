/**
 * Apply Grid modal — pick a scheduling policy (or "No policy") before
 * running the pro scheduler.
 *
 * Mirrors `applyTimesModal` (used by the Garman flow). The pro scheduler
 * is policy-blind by default; selecting a scheduling policy here enables
 * per-participant daily-limit enforcement (`defaultDailyLimits` from the
 * policy) for that run only.
 *
 * Creating or editing scheduling policies lives on the `/policies` page
 * and persists through `policyBridge`.
 */
import { competitionEngine } from 'services/factory/engine';
import { PolicyCatalogItem } from 'courthive-components';

import { getBuiltinPolicies, loadUserPolicies } from 'pages/policies/policyBridge';
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';

const POLICY_TYPE_SCHEDULING = 'scheduling';
const NO_POLICY_ID = '__no_policy__';

export interface PolicyChoice {
  id: string;
  label: string;
  /** attachPolicies({ policyDefinitions }) input shape: `{ scheduling: {...} }`. */
  definition: Record<string, any>;
  source: 'builtin' | 'user';
}

export interface ApplyGridModalParams {
  onApply: (params: { selected: PolicyChoice | null; mustAttach: boolean }) => void;
  onCancel?: () => void;
}

function fingerprint(policy: Record<string, any> | undefined | null): string {
  if (!policy) return '';
  try {
    return JSON.stringify(policy);
  } catch {
    return '';
  }
}

function getAttachedSchedulingPolicy(): Record<string, any> | null {
  try {
    const result: any = competitionEngine.findPolicy?.({ policyType: POLICY_TYPE_SCHEDULING });
    return result?.policy ?? null;
  } catch {
    return null;
  }
}

function toChoice(item: PolicyCatalogItem): PolicyChoice {
  return {
    id: item.id,
    label: item.name,
    definition: { [POLICY_TYPE_SCHEDULING]: item.policyData },
    source: item.source === 'builtin' ? 'builtin' : 'user',
  };
}

export async function openApplyGridModal(params: ApplyGridModalParams): Promise<void> {
  const builtins = getBuiltinPolicies().filter((p) => p.policyType === POLICY_TYPE_SCHEDULING);
  let userPolicies: PolicyCatalogItem[] = [];
  try {
    const all = await loadUserPolicies();
    userPolicies = all.filter((p) => p.policyType === POLICY_TYPE_SCHEDULING);
  } catch (err) {
    console.error('loadUserPolicies failed', err);
  }

  const choices: PolicyChoice[] = [...builtins.map(toChoice), ...userPolicies.map(toChoice)];

  const attached = getAttachedSchedulingPolicy();
  const attachedFp = fingerprint(attached ?? undefined);

  const matchingChoiceId = (() => {
    if (!attachedFp) return null;
    for (const c of choices) {
      if (fingerprint(c.definition[POLICY_TYPE_SCHEDULING]) === attachedFp) return c.id;
    }
    return null;
  })();

  // Default to "No policy" so the legacy unconstrained behavior is preserved
  // unless the operator explicitly opts into limits.
  let selectedId = NO_POLICY_ID;

  const content = (root: HTMLElement) => {
    root.style.cssText = 'display: flex; flex-direction: column; gap: 12px; padding: 16px; font-size: 0.8125rem;';

    const intro = document.createElement('div');
    intro.innerHTML =
      'The pro scheduler places matchUps on the court grid <em>without</em> assigning times. ' +
      'Selecting a scheduling policy applies its per-participant daily limits to this run; ' +
      'choose <strong>No policy</strong> to keep the current unrestricted behavior.';
    intro.style.cssText = 'line-height: 1.45;';
    root.appendChild(intro);

    if (attached) {
      const summary = document.createElement('div');
      summary.style.cssText =
        'padding: 8px 12px; background: var(--tmx-bg-secondary, rgba(0,0,0,0.04)); border-radius: 6px; font-size: 0.75rem;';
      const attachedLabel = matchingChoiceId
        ? choices.find((c) => c.id === matchingChoiceId)?.label ?? 'Custom policy'
        : 'Custom policy (not from this list)';
      summary.innerHTML = `<strong>Currently attached:</strong> ${attachedLabel}`;
      root.appendChild(summary);
    }

    const fieldRow = document.createElement('label');
    fieldRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';
    const fieldLabel = document.createElement('span');
    fieldLabel.style.cssText = 'flex: 0 0 auto; font-size: 0.75rem;';
    fieldLabel.textContent = 'Policy:';
    const select = document.createElement('select');
    select.style.cssText = [
      'flex: 1',
      'padding: 5px 8px',
      'font-size: 0.8125rem',
      'border-radius: 4px',
      'border: 1px solid var(--tmx-border-primary)',
      'background: var(--tmx-bg-primary)',
      'color: var(--tmx-color-primary)',
      'cursor: pointer',
    ].join('; ');

    // Always offer the "No policy" choice first.
    const noneOpt = document.createElement('option');
    noneOpt.value = NO_POLICY_ID;
    noneOpt.textContent = 'No policy (do not enforce daily limits)';
    noneOpt.selected = true;
    select.appendChild(noneOpt);

    appendChoiceGroup(select, 'Built-in', choices, 'builtin', selectedId);
    appendChoiceGroup(select, 'Saved', choices, 'user', selectedId);
    select.addEventListener('change', () => {
      selectedId = select.value;
    });

    fieldRow.appendChild(fieldLabel);
    fieldRow.appendChild(select);
    root.appendChild(fieldRow);
  };

  openModal({
    title: 'Apply Grid — Scheduling Policy',
    content,
    buttons: [
      {
        label: 'Cancel',
        intent: 'none',
        close: true,
        onClick: () => params.onCancel?.(),
      },
      {
        label: 'Apply',
        intent: 'is-primary',
        close: true,
        onClick: () => {
          if (selectedId === NO_POLICY_ID) {
            params.onApply({ selected: null, mustAttach: false });
            return;
          }
          const selected = choices.find((c) => c.id === selectedId);
          if (!selected) {
            closeModal();
            return;
          }
          params.onApply({
            selected,
            mustAttach: selected.id !== matchingChoiceId,
          });
        },
      },
    ],
  });
}

function appendChoiceGroup(
  select: HTMLSelectElement,
  label: string,
  choices: PolicyChoice[],
  source: 'builtin' | 'user',
  selectedId: string,
): void {
  const filtered = choices.filter((c) => c.source === source);
  if (!filtered.length) return;
  const group = document.createElement('optgroup');
  group.label = label;
  for (const choice of filtered) {
    const opt = document.createElement('option');
    opt.value = choice.id;
    opt.textContent = choice.label;
    if (choice.id === selectedId) opt.selected = true;
    group.appendChild(opt);
  }
  select.appendChild(group);
}
