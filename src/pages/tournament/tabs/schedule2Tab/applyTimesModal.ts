/**
 * Apply Times modal — confirm/select the scheduling policy before running
 * the Garman scheduler.
 *
 * Reads the currently-attached scheduling policy from the tournament and
 * shows it for confirmation, then offers a radio-button selection over:
 *   - Factory default: POLICY_SCHEDULING_DEFAULT (built into the factory)
 *   - Any user-saved policies stored in localStorage under
 *     `tmx:scheduling-policies` (Array<{ name, definition }>).
 *
 * On Apply, the chosen policy's definition is handed back via onApply.
 * If the user picks the option that matches what's already attached we
 * pass `null` so the caller can skip a redundant attachPolicies round-trip.
 */
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { competitionEngine, fixtures } from 'tods-competition-factory';
import { readSavedPolicies } from './schedulingPolicyEditor';

const POLICY_TYPE_SCHEDULING = 'scheduling';

export interface PolicyChoice {
  id: string;
  label: string;
  definition: Record<string, any>;
  source: 'factory-default' | 'saved';
}

export interface ApplyTimesModalParams {
  onApply: (params: { selected: PolicyChoice; mustAttach: boolean }) => void;
  onCancel?: () => void;
}

/** Quick structural fingerprint so we can spot whether the attached
 *  scheduling policy matches one of our offered choices. JSON stringify is
 *  fine here — policies are small, deterministic, JSON-safe objects. */
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

export function openApplyTimesModal(params: ApplyTimesModalParams): void {
  const factoryDefault = (fixtures as any).policies?.POLICY_SCHEDULING_DEFAULT;
  const factoryDefaultPolicy = factoryDefault?.[POLICY_TYPE_SCHEDULING];

  const choices: PolicyChoice[] = [];
  if (factoryDefaultPolicy) {
    choices.push({
      id: 'factory-default',
      label: 'Factory default (POLICY_SCHEDULING_DEFAULT)',
      definition: factoryDefault,
      source: 'factory-default',
    });
  }
  for (const saved of readSavedPolicies()) {
    choices.push({
      id: `saved:${saved.name}`,
      label: saved.name,
      definition: saved.definition,
      source: 'saved',
    });
  }

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
      for (const choice of choices) {
        const opt = document.createElement('option');
        opt.value = choice.id;
        opt.textContent = choice.label;
        if (choice.id === selectedId) opt.selected = true;
        select.appendChild(opt);
      }
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
