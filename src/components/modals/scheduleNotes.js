import { renderForm } from 'components/renderers/renderForm';
import { context } from '../../services/context';

export function editNotes({ notice, notes, callback }) {
  let inputs;
  const content = (elem) => {
    inputs = renderForm(elem, [
      {
        placeholder: 'appears on PDF Header',
        value: notice,
        label: 'Schedule notice',
        field: 'notice'
      },
      {
        placeholder: 'appears on PDF Footer',
        value: notes,
        label: 'Umpire notes',
        field: 'notes'
      }
    ]);
  };
  const submit = () => {
    const updatedNotice = inputs.notice.value;
    const updatedNotes = inputs.notes.value;
    if (typeof callback === 'function') callback({ notice: updatedNotice, notes: updatedNotes });
  };
  const buttons = [
    { label: 'Cancel', intent: 'is-nothing' },
    { label: 'Save', intent: 'is-info', onClick: submit, close: true }
  ];
  context.modal.open({ title: 'Order of play', buttons, content });
}
