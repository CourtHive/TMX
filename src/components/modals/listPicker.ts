import { closeModal, openModal } from './baseModal/baseModal';
import { renderMenu } from 'courthive-components';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

function clearActiveAnchors(anchors: NodeListOf<Element>) {
  anchors.forEach((a: Element) => a.classList.remove('is-active'));
}

function handleOptionClick(
  elem: HTMLElement,
  options: any[],
  opt: any,
  selectionRef: { current: any },
) {
  selectionRef.current = { selection: opt };
  const anchors = elem.querySelectorAll('.menu-list a');
  clearActiveAnchors(anchors);
  const idx = options.indexOf(opt);
  anchors[idx]?.classList.add('is-active');
}

type ListPickerParams = {
  callback?: (result: { selection: any }) => void;
  title?: string;
  actionLabel?: string;
  actionIntent?: string;
  options?: any[];
  closeOnSelect?: boolean;
};

export function listPicker({
  callback,
  title,
  actionLabel,
  actionIntent,
  options = [],
  closeOnSelect = true,
}: ListPickerParams = {}): void {
  const selectionMade = (selection: any) => {
    if (isFunction(callback)) callback({ selection });
  };

  if (actionLabel) {
    // Select-then-confirm mode: highlight selected item, confirm with button.
    // Selection lives on a ref object so the inner click handler can write to
    // it without nesting another arrow level.
    const selectionRef: { current: any } = { current: null };

    const content = (elem: HTMLElement) => {
      const items = options.map((opt) => ({
        ...opt,
        close: false,
        onClick: () => handleOptionClick(elem, options, opt, selectionRef),
      }));
      renderMenu(elem, [{ items }]);
    };

    const buttons = [
      {
        label: actionLabel,
        intent: actionIntent || 'is-success',
        onClick: () => {
          if (selectionRef.current) selectionMade(selectionRef.current);
        },
        close: true,
      },
    ];

    openModal({ title: title || t('modals.listPicker.title'), content, buttons });
  } else {
    // Original click-to-select mode
    const items = options.map((opt) => ({ ...opt, onClick: () => selectionMade({ selection: opt }), close: true }));
    const content = (elem: HTMLElement) => renderMenu(elem, [{ items }], () => closeOnSelect && closeModal());
    openModal({ title: title || t('modals.listPicker.title'), content, buttons: [] });
  }
}
