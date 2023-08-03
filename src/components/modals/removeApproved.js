import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';
import { lang } from 'services/translator';

const NO_SELECTION = '-';

export function removeApproved({ teams, callback }) {
  const options = [].concat(
    { label: lang.tr('allteams'), value: NO_SELECTION },
    ...teams.map((t) => ({ label: t.name, value: t.id || t.uuid }))
  );

  const content = (elem) =>
    renderForm(elem, [
      {
        value: NO_SELECTION,
        label: 'Select team(s) to remove',
        field: 'selection',
        options
      }
    ]);

  const removeSelection = ({ content }) => {
    const selected = content?.selection.value;
    callback({ selected });
  };

  openModal({
    title: 'Remove approved',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Remove', intent: 'is-danger', onClick: removeSelection, close: true }
    ],
    onClose: () => console.log('update approved')
  });
}
