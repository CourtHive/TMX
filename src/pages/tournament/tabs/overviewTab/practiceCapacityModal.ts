/**
 * Manage tournament-wide PRACTICE default capacity.
 *
 * Edits `tournament.scheduling.practice.defaultCapacity` via the
 * factory's setPracticeDefaultCapacity mutation. Per the Phase 1
 * decision, the value is:
 *   null  — unlimited (cleared field)
 *   0     — closed
 *   int>0 — cap on simultaneous CONFIRMED registrations per overlap
 *
 * The UI lets the operator pick "Unlimited" (clears) or "Cap"
 * with a numeric input.
 */

import { resolveCurrentPracticeDefaultCapacity, parseCapacityInput } from './practiceCapacityModal.logic';
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

import { SET_PRACTICE_DEFAULT_CAPACITY } from 'constants/mutationConstants';

type OpenArgs = { onSave?: () => void };

const WARNING_INTENT = 'is-warning';

export function openPracticeCapacityModal({ onSave }: OpenArgs = {}): void {
  const current = resolveCurrentPracticeDefaultCapacity();

  // Local mutable state — mirrors the form inputs.
  const state: { mode: 'unlimited' | 'capped'; capValue: string } = {
    mode: current === null ? 'unlimited' : 'capped',
    capValue: current === null ? '4' : String(current),
  };

  let modalHandle: any;

  const content = (elem: HTMLElement) => {
    elem.appendChild(buildBody(state, () => modalHandle));
  };

  const submit = () => {
    const parsed = parseCapacityInput(state);
    if (!parsed.ok) {
      tmxToast({ message: t(parsed.errorKey), intent: WARNING_INTENT });
      return;
    }
    mutationRequest({
      methods: [{ method: SET_PRACTICE_DEFAULT_CAPACITY, params: { defaultCapacity: parsed.value } }],
      callback: (result: any) => {
        if (result?.success) {
          tmxToast({ message: t('modals.practiceCapacity.saved'), intent: 'is-success' });
          closeModal();
          onSave?.();
        }
      },
    });
  };

  modalHandle = openModal({
    title: t('modals.practiceCapacity.title'),
    content,
    buttons: [
      { label: t('common.cancel'), close: true },
      { id: 'savePracticeCapacity', label: t('common.save'), intent: 'is-primary', onClick: submit },
    ],
  });
}

function buildBody(
  state: { mode: 'unlimited' | 'capped'; capValue: string },
  getModalHandle: () => any,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display: flex; flex-direction: column; gap: 12px; min-width: 340px;';

  const help = document.createElement('div');
  help.style.cssText = 'font-size: 12px; color: var(--sp-muted, #888);';
  help.textContent = t('modals.practiceCapacity.help');
  wrap.appendChild(help);

  const radios = document.createElement('div');
  radios.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  const capInput = document.createElement('input');
  capInput.type = 'number';
  capInput.min = '0';
  capInput.step = '1';
  capInput.className = 'input is-small';
  capInput.style.width = '6rem';
  capInput.value = state.capValue;
  capInput.addEventListener('change', () => (state.capValue = capInput.value));
  capInput.addEventListener('input', () => (state.capValue = capInput.value));

  const unlimitedRow = buildRadioRow({
    label: t('modals.practiceCapacity.unlimited'),
    value: 'unlimited',
    state,
    onChange: () => {
      capInput.disabled = state.mode !== 'capped';
      getModalHandle()?.setButtonState?.('savePracticeCapacity', { disabled: false });
    },
  });
  radios.appendChild(unlimitedRow);

  const cappedRow = buildRadioRow({
    label: t('modals.practiceCapacity.capped'),
    value: 'capped',
    state,
    onChange: () => {
      capInput.disabled = state.mode !== 'capped';
      capInput.focus();
      getModalHandle()?.setButtonState?.('savePracticeCapacity', { disabled: false });
    },
    extra: capInput,
  });
  radios.appendChild(cappedRow);

  // initial disabled state for the cap input
  capInput.disabled = state.mode !== 'capped';

  wrap.appendChild(radios);
  return wrap;
}

function buildRadioRow({
  label,
  value,
  state,
  onChange,
  extra,
}: {
  label: string;
  value: 'unlimited' | 'capped';
  state: { mode: 'unlimited' | 'capped' };
  onChange: () => void;
  extra?: HTMLElement;
}): HTMLElement {
  const row = document.createElement('label');
  row.style.cssText = 'display: flex; align-items: center; gap: 10px; cursor: pointer;';

  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'practice-capacity-mode';
  radio.value = value;
  radio.checked = state.mode === value;
  radio.addEventListener('change', () => {
    if (radio.checked) {
      state.mode = value;
      onChange();
    }
  });
  row.appendChild(radio);

  const txt = document.createElement('span');
  txt.textContent = label;
  row.appendChild(txt);

  if (extra) row.appendChild(extra);

  return row;
}
