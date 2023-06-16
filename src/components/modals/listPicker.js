import { renderMenu } from 'components/renderers/renderMenu';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

export function listPicker({ callback, options = [], closeOnSelect = true } = {}) {
  const selectionMade = (selection) => {
    if (isFunction(callback)) callback({ selection });
  };
  const items = options.map((opt) => ({ ...opt, onClick: () => selectionMade({ selection: opt }), close: true }));
  const content = (elem) => renderMenu(elem, [{ items }], () => closeOnSelect && context.modal.close());
  context.modal.open({ title: 'Select', content, buttons: [] });
}
