import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';

export function enterLink({ title, existingValue, callback, message }) {
  const onClick = ({ content }) => {
    const newValue = content?.newValue.value;
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

  openModal({
    title,
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Update', intent: 'is-primary', onClick, close: true }
    ]
  });
}
