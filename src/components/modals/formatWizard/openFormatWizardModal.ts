import { openModal, closeModal } from '../baseModal/baseModal';
import { buildConstraintsForm } from './constraintsForm';
import { t } from 'i18n';

// constants and types
import { FORMAT_WIZARD_CONTENT, FORMAT_WIZARD_RIGHT_PANE } from 'constants/tmxConstants';
import { ConstraintsFormHandle, ConstraintsFormState } from './constraintsForm';

export interface OpenFormatWizardModalOptions {
  onConstraintsChange?: (state: ConstraintsFormState) => void;
  initialScaleName?: string;
}

const MODAL_MAX_WIDTH = 1000;
const MODAL_MIN_HEIGHT = 480;

const RIGHT_PANE_PLACEHOLDER_STYLE =
  'flex: 1; padding: 24px; display: flex; align-items: center; justify-content: center; color: var(--tmx-text-muted, #999); font-style: italic; min-height: 320px;';

function buildContent(formHandle: ConstraintsFormHandle): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.id = FORMAT_WIZARD_CONTENT;
  wrapper.className = 'tmx-format-wizard-content';
  wrapper.style.cssText = `display: flex; min-height: ${MODAL_MIN_HEIGHT}px;`;
  wrapper.appendChild(formHandle.element);

  const rightPane = document.createElement('div');
  rightPane.id = FORMAT_WIZARD_RIGHT_PANE;
  rightPane.className = 'tmx-format-wizard-right-pane';
  rightPane.style.cssText = RIGHT_PANE_PLACEHOLDER_STYLE;
  rightPane.textContent = t('formatWizard.placeholder');
  wrapper.appendChild(rightPane);

  return wrapper;
}

// Opens the format wizard modal. Phase 1.C.2 ships only the
// scaffold + constraints form (left pane) — the right pane is a
// placeholder until 1.C.3 adds the distribution chart and plan
// cards. The caller can subscribe to constraint changes via
// `onConstraintsChange`; in 1.C.3 the modal owns its own
// recompute and that callback becomes optional.
export function openFormatWizardModal(options: OpenFormatWizardModalOptions = {}): ConstraintsFormHandle {
  const formHandle = buildConstraintsForm({
    initialScaleName: options.initialScaleName,
  });

  if (options.onConstraintsChange) {
    formHandle.setOnChange(options.onConstraintsChange);
  }

  openModal({
    title: t('formatWizard.title'),
    content: buildContent(formHandle),
    buttons: [{ label: t('close'), close: true }],
    onClose: () => formHandle.setOnChange(() => undefined),
    config: { padding: '0', maxWidth: MODAL_MAX_WIDTH },
  });

  return formHandle;
}

export { closeModal as closeFormatWizardModal };
