import { renderMenu } from 'components/renderers/renderMenu';
import { closeModal, openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';

export function listPicker({ callback, options = [], closeOnSelect = true } = {}) {
  const selectionMade = (selection) => {
    if (isFunction(callback)) callback({ selection });
  };
  const items = options.map((opt) => ({ ...opt, onClick: () => selectionMade({ selection: opt }), close: true }));
  const content = (elem) => renderMenu(elem, [{ items }], () => closeOnSelect && closeModal());
  openModal({ title: 'Select', content, buttons: [] });
}
