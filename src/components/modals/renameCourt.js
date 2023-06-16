import { renderForm } from 'components/renderers/renderForm';
import { context } from 'services/context';
import { save } from 'services/storage/save';

export function renameCourt({ location, index }) {
  let identifier = location && location.identifiers && location.identifiers.split(',')[index - 1];
  let value = (identifier && identifier.replace(/['"]+/g, '')) || index;

  const content = (elem) =>
    renderForm(elem, [
      {
        value,
        label: 'Court Name',
        field: 'courtName'
      }
    ]);

  context.modal.open({
    title: 'Rename Court',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Rename', intent: 'is-primary', onClick: setNewName, close: true }
    ],
    onClose: () => console.log('triggerUpdate')
  });

  function setNewName() {
    const newValue = context.modal.attributes?.content.courtName.value;
    let identifiers = (location.identifiers || '').split(',');
    if (index) identifiers[index - 1] = newValue;
    location.identifiers = identifiers.join(',');
    save.local();
  }
}
