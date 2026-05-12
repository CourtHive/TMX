/**
 * Apply Times modal — confirm/select the scheduling policy before running
 * the Garman scheduler.
 *
 * Reads the currently-attached scheduling policy from the tournament and
 * shows it for confirmation, then offers a <select> over the policies
 * registered with the `/policies` page: factory built-ins plus any user
 * policies persisted to IndexedDB via `policyBridge.saveUserPolicy`.
 *
 * Creating or editing a scheduling policy is out of scope here — that
 * lives on the `/policies` page and persists through `policyBridge`.
 */
import { competitionEngine } from 'tods-competition-factory';
import { PolicyCatalogItem } from 'courthive-components';

import { getBuiltinPolicies, loadUserPolicies } from 'pages/policies/policyBridge';
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';

const POLICY_TYPE_SCHEDULING = 'scheduling';

export interface PolicyChoice {
  id: string;
  label: string;
  /** attachPolicies({ policyDefinitions }) input shape: `{ scheduling: {...} }`. */
  definition: Record<string, any>;
  source: 'builtin' | 'user';
}

export interface ApplyTimesModalParams {
  onApply: (params: { selected: PolicyChoice; mustAttach: boolean }) => void;
  onCancel?: () => void;
}

/** JSON fingerprint to compare a choice against the currently-attached
 *  scheduling policy. JSON.stringify is fine — policies are small,
 *  deterministic, JSON-safe objects. */
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
    // policyBridge stores policyData as the INNER block (not wrapped in
    // a `{ scheduling: ... }` key); attachPolicies expects the wrapper.
    definition: { [POLICY_TYPE_SCHEDULING]: item.policyData },
    source: item.source === 'builtin' ? 'builtin' : 'user',
  };
}

export async function openApplyTimesModal(params: ApplyTimesModalParams): Promise<void> {
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

  // Identify which choice matches what's already attached (if any).
  const matchingChoiceId = (() => {
    if (!attachedFp) return null;
    for (const c of choices) {
      if (fingerprint(c.definition[POLICY_TYPE_SCHEDULING]) === attachedFp) return c.id;
    }
    return null;
  })();

  // Default selection: the matching choice if any, else the first option.
  let selectedId = matchingChoiceId ?? choices[0]?.id ?? '';

  const content = (root: HTMLElement) => {
    root.style.cssText = 'display: flex; flex-direction: column; gap: 12px; padding: 16px; font-size: 13px;';

    const summary = document.createElement('div');
    summary.style.cssText =
      'padding: 8px 12px; background: var(--tmx-bg-secondary, rgba(0,0,0,0.04)); border-radius: 6px; font-size: 12px;';
    if (attached) {
      const attachedLabel = matchingChoiceId
        ? choices.find((c) => c.id === matchingChoiceId)?.label ?? 'Custom policy'
        : 'Custom policy (not from this list)';
      summary.innerHTML = `<strong>Currently attached:</strong> ${attachedLabel}`;
    } else {
      summary.innerHTML =
        '<strong>Currently attached:</strong> none — the Garman scheduler will use the factory default fallback.';
    }
    root.appendChild(summary);

    const intro = document.createElement('div');
    intro.textContent = 'Select the scheduling policy to use for Apply Times:';
    root.appendChild(intro);

    const fieldRow = document.createElement('label');
    fieldRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';
    const fieldLabel = document.createElement('span');
    fieldLabel.style.cssText = 'flex: 0 0 auto; font-size: 12px;';
    fieldLabel.textContent = 'Policy:';
    const select = document.createElement('select');
    select.style.cssText = [
      'flex: 1',
      'padding: 5px 8px',
      'font-size: 13px',
      'border-radius: 4px',
      'border: 1px solid var(--tmx-border-primary)',
      'background: var(--tmx-bg-primary)',
      'color: var(--tmx-color-primary)',
      'cursor: pointer',
    ].join('; ');
    if (!choices.length) {
      const opt = document.createElement('option');
      opt.textContent = 'No scheduling policies available';
      opt.disabled = true;
      opt.selected = true;
      select.appendChild(opt);
      select.disabled = true;
    } else {
      appendChoiceGroup(select, 'Built-in', choices, 'builtin', selectedId);
      appendChoiceGroup(select, 'Saved', choices, 'user', selectedId);
      select.addEventListener('change', () => {
        selectedId = select.value;
      });
    }
    fieldRow.appendChild(fieldLabel);
    fieldRow.appendChild(select);
    root.appendChild(fieldRow);
  };

  openModal({
    title: 'Apply Times — Scheduling Policy',
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
        disabled: !choices.length,
        onClick: () => {
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

/** Append a labelled `<optgroup>` for one source ("builtin" or "user")
 *  containing only choices from that source. Empty groups are skipped so
 *  the select doesn't show an empty "Saved" header when there are none. */
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
