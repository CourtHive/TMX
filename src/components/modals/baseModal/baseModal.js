import { cModal } from 'courthive-components';
import { lang } from 'services/translator';

import { NONE } from 'constants/tmxConstants';

export function closeModal() {
  cModal.close();
}
export function openModal({ title, content, buttons, footer, onClose } = {}) {
  const noPadding = !title && !buttons;
  const config = { padding: noPadding ? '' : '.5', maxWidth: 500 };
  cModal.open({ title, content, footer, buttons, config, onClose });
}

export function informModal({ message, title, okAction }) {
  const buttons = [{ label: 'Ok', onClick: okAction, close: true }];
  cModal.open({ title, content: message, buttons });
}

export function confirmModal({ title, query, okAction, cancelAction, okIntent }) {
  const buttons = [
    {
      onClick: cancelAction || cModal.close,
      label: 'Cancel',
      intent: NONE,
      close: true
    },
    okAction && {
      intent: okIntent || 'is-warning',
      onClick: okAction,
      label: 'Ok',
      close: true
    }
  ].filter(Boolean);

  cModal.open({ title: title || lang.tr('act'), content: query, buttons });
}
