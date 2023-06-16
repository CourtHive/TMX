import { renderForm } from 'components/renderers/renderForm';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

export function enterLink({ title, existingValue, callback, message }) {
  const onClick = () => {
    const newValue = context.modal.attributes?.content.newValue.value;
    if (isFunction(callback)) callback(newValue);
  };

  const content = (elem) =>
    renderForm(elem, [
      { text: message },
      {
        value: existingValue,
        label: 'New value',
        field: 'newValue'
      }
    ]);

  context.modal.open({
    title,
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Update', intent: 'is-primary', onClick, close: true }
    ]
  });
}
