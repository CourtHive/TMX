import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';
import { lang } from 'services/translator';

export function modifyGroupName({ bracket }) {
  let value = bracket?.name || '';
  const submitRRname = ({ content }) => {
    const name = content?.newName.value;
    bracket.name = name;
    // mutationRequest({
  };

  const content = (elem) =>
    renderForm(elem, [
      {
        value,
        label: 'New name',
        field: 'newName',
      },
    ]);

  openModal({
    title: lang.tr('nm'),
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Update', intent: 'is-primary', onClick: submitRRname, close: true },
    ],
  });
}
