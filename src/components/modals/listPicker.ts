import { renderMenu } from 'courthive-components';
import { closeModal, openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';

type ListPickerParams = {
  callback?: (result: { selection: any }) => void;
  options?: any[];
  closeOnSelect?: boolean;
};

export function listPicker({ callback, options = [], closeOnSelect = true }: ListPickerParams = {}): void {
  const selectionMade = (selection: any) => {
    if (isFunction(callback) && callback) callback({ selection });
  };
  const items = options.map((opt) => ({ ...opt, onClick: () => selectionMade({ selection: opt }), close: true }));
  const content = (elem: HTMLElement) => renderMenu(elem, [{ items }], () => closeOnSelect && closeModal());
  openModal({ title: 'Select', content, buttons: [] });
}
