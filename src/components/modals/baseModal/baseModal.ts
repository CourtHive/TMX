import { cModal } from 'courthive-components';
import { lang } from 'services/translator';

import { NONE } from 'constants/tmxConstants';

export function closeModal() {
  cModal.close();
}

type OpenModal = {
  buttons: { label: string; intent?: string; onClick?: () => void; close?: boolean }[];
  content: (elem: HTMLElement) => void;
  onClose?: () => void;
  footer?: string;
  title: string;
};

export function openModal(params: OpenModal) {
  const { title, content, buttons, footer, onClose } = params;
  const noPadding = !title && !buttons;
  const config = { padding: noPadding ? '' : '.5', maxWidth: 500 };
  return cModal.open({ title, content, footer, buttons, config, onClose });
}

export function informModal({ message, title, okAction }) {
  const buttons = [{ label: 'Ok', onClick: okAction, close: true }];
  return cModal.open({ title, content: message, buttons });
}

export function confirmModal({ title, query, okAction, cancelAction, okIntent }) {
  const buttons = [
    {
      onClick: cancelAction || cModal.close,
      label: 'Cancel',
      intent: NONE,
      close: true,
    },
    okAction && {
      intent: okIntent || 'is-warning',
      onClick: okAction,
      label: 'Ok',
      close: true,
    },
  ].filter(Boolean);

  return cModal.open({ title: title || lang.tr('act'), content: query, buttons });
}
