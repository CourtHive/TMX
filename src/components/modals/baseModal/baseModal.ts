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
  // `padding` drives the compact header/footer bars (.5em). The content area,
  // though, needs more breathing room than that — 0.5em all round left body text
  // cramped against the edges. cModal resolves `content.padding` before falling
  // back to `padding`, so give the content its own 1em (cModal's own default)
  // while keeping the tight header/footer.
  const config = customConfig || {
    padding: noPadding ? '' : '.5',
    content: { padding: noPadding ? '' : '1' },
    maxWidth: 500,
  };
  return cModal.open({ title, content, footer, buttons, config, onClose });
}

export function informModal({ message, title, okAction }) {
  const buttons = [{ label: t('ui.ok'), onClick: okAction, close: true }];
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
  // Header, backdrop and Escape dismissal are cancellation too. Settle once even when
  // a footer action closes the modal synchronously before cModal invokes onClose.
  let chosen = false;
  const buttons = [
    {
      onClick: () => {
        chosen = true;
        cancelAction?.();
      },
      label: t('common.cancel'),
      intent: NONE,
      close: true,
    },
    okAction && {
      intent: okIntent || 'is-warning',
      onClick: () => {
        chosen = true;
        return okAction();
      },
      label: t('ui.ok'),
      close: true,
    },
  ].filter(Boolean);

  return cModal.open({
    title: title || t('act'),
    content: query,
    buttons,
    onClose: () => {
      if (!chosen) cancelAction?.();
    },
  });
}
