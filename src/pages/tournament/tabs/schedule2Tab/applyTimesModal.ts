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
import { competitionEngine, fixtures } from 'tods-competition-factory';

import { openModal, closeModal } from 'components/modals/baseModal/baseModal';

const STORAGE_KEY = 'tmx:scheduling-policies';
const POLICY_TYPE_SCHEDULING = 'scheduling';

export interface SavedSchedulingPolicy {
  name: string;
  definition: Record<string, any>;
}

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

function readSavedPolicies(): SavedSchedulingPolicy[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is SavedSchedulingPolicy =>
        p && typeof p.name === 'string' && p.definition && typeof p.definition === 'object',
    );
  } catch {
    return [];
  }
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
    root.style.cssText = 'display: flex; flex-direction: column; gap: 12px; font-size: 13px;';

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

    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
    for (const choice of choices) {
      const label = document.createElement('label');
      label.style.cssText =
        'display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid var(--tmx-border-primary); border-radius: 6px; cursor: pointer;';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'applyTimes-policy';
      input.value = choice.id;
      input.checked = choice.id === selectedId;
      input.addEventListener('change', () => {
        if (input.checked) selectedId = choice.id;
      });
      const text = document.createElement('span');
      text.textContent = choice.label;
      label.appendChild(input);
      label.appendChild(text);
      list.appendChild(label);
    }
    if (!choices.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color: var(--tmx-text-muted); font-style: italic;';
      empty.textContent = 'No scheduling policies available.';
      list.appendChild(empty);
    }
    root.appendChild(list);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size: 11px; color: var(--tmx-text-muted);';
    hint.textContent = `Saved policies are read from localStorage key "${STORAGE_KEY}".`;
    root.appendChild(hint);
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
