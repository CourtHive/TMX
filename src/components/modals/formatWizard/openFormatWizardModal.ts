import { openModal, closeModal, confirmModal } from '../baseModal/baseModal';
import { buildConstraintsForm } from './constraintsForm';
import { buildRightPane } from './rightPane';
import {
  applyFormatPlan,
  buildApplyMethods,
  getTournamentCapacity,
  readWizardState,
  runFormatWizard,
  writeWizardState,
} from 'services/formatWizard';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

// constants and types
import { FORMAT_WIZARD_CONTENT } from 'constants/tmxConstants';
import { ConstraintsFormHandle, ConstraintsFormState } from './constraintsForm';
import { RankedPlan } from 'tods-competition-factory';
import { RightPaneHandle } from './rightPane';

export interface OpenFormatWizardModalOptions {
  onConstraintsChange?: (state: ConstraintsFormState) => void;
  initialScaleName?: string;
}

const MODAL_MAX_WIDTH = 1000;
const MODAL_MIN_HEIGHT = 480;
const PERSIST_DEBOUNCE_MS = 500;

function buildContent(formHandle: ConstraintsFormHandle, rightPane: RightPaneHandle): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.id = FORMAT_WIZARD_CONTENT;
  wrapper.className = 'tmx-format-wizard-content';
  wrapper.style.cssText = `display: flex; min-height: ${MODAL_MIN_HEIGHT}px;`;
  wrapper.appendChild(formHandle.element);
  wrapper.appendChild(rightPane.element);
  return wrapper;
}

function recompute(formState: ConstraintsFormState, rightPane: RightPaneHandle): void {
  const result = runFormatWizard({
    constraints: formState.constraints,
    scaleName: formState.scaleName,
  });
  if (result.error === 'INSUFFICIENT_RATED_PARTICIPANTS' && result.totalParticipants === 0) {
    rightPane.setEmpty(t('formatWizard.summary.loadTournament'));
    return;
  }
  rightPane.setData(result);
}

function handleApply(plan: RankedPlan, scaleName: string): void {
  const preview = buildApplyMethods({ plan, scaleName });
  if (preview.eventCount === 0) {
    tmxToast({ message: t('formatWizard.apply.errorEmpty'), intent: 'is-warning' });
    return;
  }

  const lines: string[] = [
    t('formatWizard.apply.confirmBody', {
      eventCount: preview.eventCount,
      participantCount: preview.participantCount,
    }),
  ];
  if (preview.unsupported.length > 0) {
    lines.push(t('formatWizard.apply.confirmBodyUnsupported', { unsupportedCount: preview.unsupported.length }));
  }

  confirmModal({
    title: t('formatWizard.apply.confirmTitle'),
    query: lines.join(' '),
    okIntent: 'is-primary',
    // cancelAction defaults in baseModal to `cModal.close`, which is
    // a no-op stacked alongside the button's own close:true — net
    // effect is that two modals get popped, closing the wizard
    // underneath. Pass an explicit no-op so only the confirm modal
    // closes on cancel.
    cancelAction: () => undefined,
    okAction: () =>
      applyFormatPlan({
        plan,
        scaleName,
        callback: (result) => {
          if (result.success) {
            closeModal();
            tmxToast({
              message: t('formatWizard.apply.success', { eventCount: result.eventIds.length }),
              intent: 'is-success',
            });
            return;
          }
          tmxToast({ message: t('formatWizard.apply.errorEvents'), intent: 'is-danger' });
        },
      }),
  });
}

// Opens the format wizard modal. The modal owns its own recompute
// loop: every form change triggers `runFormatWizard` and pushes
// the result into the right pane. Engine is sub-millisecond so no
// debounce; the prior-art research recommends live re-projection
// as the canonical UX for this kind of tool.
export function openFormatWizardModal(options: OpenFormatWizardModalOptions = {}): ConstraintsFormHandle {
  // Hydrate from the persisted formatWizard tournament extension so
  // navigating away and back keeps the TD's last-used constraints.
  const persisted = readWizardState();
  const formHandle = buildConstraintsForm({
    initialScaleName: options.initialScaleName ?? persisted?.scaleName,
    initialConstraints: persisted?.constraints,
  });
  const rightPane = buildRightPane();

  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  function schedulePersist(state: ConstraintsFormState): void {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      writeWizardState({ scaleName: state.scaleName, constraints: state.constraints });
      persistTimer = undefined;
    }, PERSIST_DEBOUNCE_MS);
  }

  rightPane.setOnApply((plan) => {
    handleApply(plan, formHandle.getState().scaleName);
  });

  // Capture the live tournament capacity once on open and feed it
  // to the form so the courts-input cue can render. The cue
  // rerenders on every courts-input change.
  formHandle.setCapacity(getTournamentCapacity());

  formHandle.setOnChange((state) => {
    recompute(state, rightPane);
    schedulePersist(state);
    if (options.onConstraintsChange) options.onConstraintsChange(state);
  });

  openModal({
    title: t('formatWizard.title'),
    content: buildContent(formHandle, rightPane),
    buttons: [{ label: t('close'), close: true }],
    onClose: () => {
      // Flush a pending debounced save so the most-recent edit makes
      // it into the extension even if the user closes fast.
      if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = undefined;
        const state = formHandle.getState();
        writeWizardState({ scaleName: state.scaleName, constraints: state.constraints });
      }
      formHandle.setOnChange(() => undefined);
    },
    config: { padding: '0', maxWidth: MODAL_MAX_WIDTH },
  });

  // Initial render so the user sees plans (or an empty-state hint)
  // before they touch the form.
  recompute(formHandle.getState(), rightPane);

  return formHandle;
}

export { closeModal as closeFormatWizardModal };
