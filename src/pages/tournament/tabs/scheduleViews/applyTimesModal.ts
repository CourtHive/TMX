/**
 * Apply Times modal — confirm/select the scheduling policy before running
 * the Garman scheduler.
 *
 * Reads the currently-attached scheduling policy from the tournament and
 * offers it as the default, pre-selected choice ("Attached — …"), then lists
 * the policies registered with the `/policies` page (factory built-ins plus
 * any user policies persisted via `policyBridge.saveUserPolicy`) for switching.
 *
 * Selection/identity/compare logic is shared with the Apply Grid modal in
 * `schedulingPolicyChoices.ts`. Creating or editing a scheduling policy is out
 * of scope here — that lives on the `/policies` page.
 */
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';

import {
  ATTACHED_POLICY_ID,
  PolicyChoice,
  appendChoiceGroup,
  buildAttachedChoice,
  getAttachedSchedulingPolicy,
  loadSchedulingChoices,
  resolveAttachedChoiceId,
} from './schedulingPolicyChoices';

export type { PolicyChoice } from './schedulingPolicyChoices';

export interface ApplyTimesModalParams {
  onApply: (params: { selected: PolicyChoice; mustAttach: boolean }) => void;
  onCancel?: () => void;
}

export async function openApplyTimesModal(params: ApplyTimesModalParams): Promise<void> {
  const choices = await loadSchedulingChoices();

  const attached = getAttachedSchedulingPolicy();
  const matchingChoiceId = resolveAttachedChoiceId(attached, choices);
  const matchedLabel = matchingChoiceId ? choices.find((c) => c.id === matchingChoiceId)?.label ?? null : null;
  const attachedChoice = attached ? buildAttachedChoice(attached, matchedLabel) : null;

  // Everything the operator can pick, in display order: the attached policy
  // first (when present), then the catalog.
  const allChoices: PolicyChoice[] = attachedChoice ? [attachedChoice, ...choices] : choices;

  // Default: the attached policy (iterative re-apply is a no-op), else the
  // matching catalog choice, else the first option.
  let selectedId = attachedChoice?.id ?? matchingChoiceId ?? choices[0]?.id ?? '';

  const content = (root: HTMLElement) => {
    root.style.cssText = 'display: flex; flex-direction: column; gap: 12px; padding: 16px; font-size: 0.8125rem;';

    const summary = document.createElement('div');
    summary.style.cssText =
      'padding: 8px 12px; background: var(--tmx-bg-secondary, rgba(0,0,0,0.04)); border-radius: 6px; font-size: 0.75rem;';
    if (attachedChoice) {
      const attachedLabel = matchedLabel ?? 'Custom policy (not from this list)';
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
    if (allChoices.length) {
      appendChoiceGroup(select, 'Attached', allChoices, 'attached', selectedId);
      appendChoiceGroup(select, 'Built-in', allChoices, 'builtin', selectedId);
      appendChoiceGroup(select, 'Saved', allChoices, 'user', selectedId);
      select.addEventListener('change', () => {
        selectedId = select.value;
      });
    } else {
      const opt = document.createElement('option');
      opt.textContent = 'No scheduling policies available';
      opt.disabled = true;
      opt.selected = true;
      select.appendChild(opt);
      select.disabled = true;
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
        disabled: !allChoices.length,
        onClick: () => {
          const selected = allChoices.find((c) => c.id === selectedId);
          if (!selected) {
            closeModal();
            return;
          }
          // The "Attached" entry and the catalog choice that equals the
          // attached policy both re-apply what's already there → no re-attach.
          const mustAttach = selected.id !== ATTACHED_POLICY_ID && selected.id !== matchingChoiceId;
          params.onApply({ selected, mustAttach });
        },
      },
    ],
  });
}
