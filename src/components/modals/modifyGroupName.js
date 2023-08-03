import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';
import { context } from 'services/context';
import { save } from 'services/storage/save';
import { lang } from 'services/translator';

export function modifyGroupName({ bracket }) {
  let value = bracket?.name || '';
  const submitRRname = () => {
    const name = context.modal.attributes?.content.newName.value;
    bracket.name = name;
    // context.rr_draw.options({ matchFormat: e.matchFormat }).data(e.draw);
    // context.rr_draw.updateBracket(d.bracket);
    save.local();
  };

  const content = (elem) =>
    renderForm(elem, [
      {
        value,
        label: 'New name',
        field: 'newName'
      }
    ]);

  openModal({
    title: lang.tr('nm'),
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Update', intent: 'is-primary', onClick: submitRRname, close: true }
    ]
  });
}
