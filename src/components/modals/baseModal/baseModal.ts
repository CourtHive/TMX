import { cModal } from 'courthive-components';
import { t } from 'i18n';

import { NONE } from 'constants/tmxConstants';

export function closeModal() {
  cModal.close();
}

type OpenModal = {
  buttons: { id?: string; disabled?: boolean; label: string; intent?: string; onClick?: () => void; close?: boolean }[];
  onClose?: () => void;
  footer?: string;
  title: string;
  content: any;
  config?: any; // Allow custom config to be passed through
};

export function openModal(params: OpenModal) {
  const { title, content, buttons, footer, onClose, config: customConfig } = params;
  const noPadding = !title && !buttons;
  const config = customConfig || { padding: noPadding ? '' : '.5', maxWidth: 500 };
  return cModal.open({ title, content, footer, buttons, config, onClose });
}

export function informModal({ message, title, okAction }) {
  const buttons = [{ label: 'Ok', onClick: okAction, close: true }];
  return cModal.open({ title, content: message, buttons });
}

type ConfirmModalOptions = {
  title?: string;
  query: any;
  okAction: () => void | Promise<void>;
  cancelAction?: () => void;
  okIntent?: string;
};

export function confirmModal({ title, query, okAction, cancelAction, okIntent }: ConfirmModalOptions) {
  // cModal handles dismissal automatically when close: true, so we leave
  // onClick undefined unless the caller wants a side-effect on cancel.
  const buttons = [
    {
      onClick: cancelAction,
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

  return cModal.open({ title: title || t('act'), content: query, buttons });
}
