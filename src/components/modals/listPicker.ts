import { closeModal, openModal } from './baseModal/baseModal';
import { renderMenu } from 'courthive-components';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

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
    // Select-then-confirm mode: highlight selected item, confirm with button
    let selected: any = null;

    const content = (elem: HTMLElement) => {
      const items = options.map((opt) => ({
        ...opt,
        close: false,
        onClick: () => {
          selected = { selection: opt };
          // Update visual selection
          const anchors = elem.querySelectorAll('.menu-list a');
          anchors.forEach((a: Element) => a.classList.remove('is-active'));
          const idx = options.indexOf(opt);
          anchors[idx]?.classList.add('is-active');
        },
      }));
      renderMenu(elem, [{ items }]);
    };

    const buttons = [
      {
        label: actionLabel,
        intent: actionIntent || 'is-success',
        onClick: () => {
          if (selected) selectionMade(selected);
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
