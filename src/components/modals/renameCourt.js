import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';

export function renameCourt({ courtInfo }) {
  const setNewName = ({ content }) => {
    const newValue = content?.courtName.value;
    if (newValue && newValue !== courtInfo.courtName) {
      console.log({ newValue });
    }
  };

  const content = (elem) =>
    renderForm(elem, [
      {
        value: courtInfo.courtName,
        label: 'Court Name',
        field: 'courtName'
      }
    ]);

  openModal({
    title: 'Rename Court',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Rename', intent: 'is-primary', onClick: setNewName, close: true }
    ]
  });
}
