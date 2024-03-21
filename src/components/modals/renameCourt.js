import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';

// constants
import { MODIFY_COURT } from 'constants/mutationConstants';

export function renameCourt({ column, courtInfo }) {
  const courtId = courtInfo.courtId;

  const setNewName = ({ content }) => {
    const value = content?.courtName.value;
    if (value.length && value !== courtInfo.courtName) {
      const postMutation = (result) => {
        if (result.success) {
          column.updateDefinition({ title: value });
        } else {
          console.log({ result });
        }
      };
      const methods = [{ method: MODIFY_COURT, params: { courtId, modifications: { courtName: value } } }];
      mutationRequest({ methods, callback: postMutation });
    }
  };

  const content = (elem) =>
    renderForm(elem, [
      {
        value: courtInfo.courtName,
        label: 'Court Name',
        field: 'courtName',
      },
    ]);

  openModal({
    title: 'Rename Court',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Rename', intent: 'is-primary', onClick: setNewName, close: true },
    ],
  });
}
