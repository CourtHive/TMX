import { openModal, closeModal } from '../baseModal/baseModal';
import { buildConstraintsForm } from './constraintsForm';
import { buildRightPane } from './rightPane';
import { runFormatWizard } from 'services/formatWizard';
import { t } from 'i18n';

// constants and types
import { FORMAT_WIZARD_CONTENT } from 'constants/tmxConstants';
import { ConstraintsFormHandle, ConstraintsFormState } from './constraintsForm';
import { RightPaneHandle } from './rightPane';

export interface OpenFormatWizardModalOptions {
  onConstraintsChange?: (state: ConstraintsFormState) => void;
  initialScaleName?: string;
}

const MODAL_MAX_WIDTH = 1000;
const MODAL_MIN_HEIGHT = 480;

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

// Opens the format wizard modal. The modal owns its own recompute
// loop: every form change triggers `runFormatWizard` and pushes
// the result into the right pane. Engine is sub-millisecond so no
// debounce; the prior-art research recommends live re-projection
// as the canonical UX for this kind of tool.
export function openFormatWizardModal(options: OpenFormatWizardModalOptions = {}): ConstraintsFormHandle {
  const formHandle = buildConstraintsForm({ initialScaleName: options.initialScaleName });
  const rightPane = buildRightPane();

  formHandle.setOnChange((state) => {
    recompute(state, rightPane);
    if (options.onConstraintsChange) options.onConstraintsChange(state);
  });

  openModal({
    title: t('formatWizard.title'),
    content: buildContent(formHandle, rightPane),
    buttons: [{ label: t('close'), close: true }],
    onClose: () => formHandle.setOnChange(() => undefined),
    config: { padding: '0', maxWidth: MODAL_MAX_WIDTH },
  });

  // Initial render so the user sees plans (or an empty-state hint)
  // before they touch the form.
  recompute(formHandle.getState(), rightPane);

  return formHandle;
}

export { closeModal as closeFormatWizardModal };
