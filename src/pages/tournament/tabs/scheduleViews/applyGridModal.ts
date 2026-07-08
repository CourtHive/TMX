/**
 * Apply Grid modal — pick a scheduling policy (or "No policy") before
 * running the pro scheduler.
 *
 * Mirrors `applyTimesModal` (the Garman flow) and shares selection/identity/
 * compare logic via `schedulingPolicyChoices.ts`. The pro scheduler is
 * policy-blind by default; selecting a scheduling policy here enables
 * per-participant daily-limit enforcement (`defaultDailyLimits`) for that run.
 *
 * Unlike Apply Times, this modal defaults to "No policy" to preserve the
 * intentional unconstrained grid behavior — the attached policy is offered as
 * a first-class selectable entry, but the operator must opt into it.
 *
 * Creating or editing scheduling policies lives on the `/policies` page.
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

const NO_POLICY_ID = '__no_policy__';

export interface ApplyGridModalParams {
  onApply: (params: { selected: PolicyChoice | null; mustAttach: boolean }) => void;
  onCancel?: () => void;
}

export async function openApplyGridModal(params: ApplyGridModalParams): Promise<void> {
  const choices = await loadSchedulingChoices();

  const attached = getAttachedSchedulingPolicy();
  const matchingChoiceId = resolveAttachedChoiceId(attached, choices);
  const matchedLabel = matchingChoiceId ? choices.find((c) => c.id === matchingChoiceId)?.label ?? null : null;
  const attachedChoice = attached ? buildAttachedChoice(attached, matchedLabel) : null;

  const allChoices: PolicyChoice[] = attachedChoice ? [attachedChoice, ...choices] : choices;

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

    if (attachedChoice) {
      const summary = document.createElement('div');
      summary.style.cssText =
        'padding: 8px 12px; background: var(--tmx-bg-secondary, rgba(0,0,0,0.04)); border-radius: 6px; font-size: 0.75rem;';
      const attachedLabel = matchedLabel ?? 'Custom policy (not from this list)';
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

    appendChoiceGroup(select, 'Attached', allChoices, 'attached', selectedId);
    appendChoiceGroup(select, 'Built-in', allChoices, 'builtin', selectedId);
    appendChoiceGroup(select, 'Saved', allChoices, 'user', selectedId);
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
