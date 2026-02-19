/**
 * Rename court modal with form input.
 * Updates court name via mutation and refreshes column title.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

import { MODIFY_COURT } from 'constants/mutationConstants';

export function renameCourt({ column, courtInfo }: { column: any; courtInfo: any }): void {
  const courtId = courtInfo.courtId;

  const setNewName = ({ content }: any) => {
    const value = content?.courtName.value;
    if (value.length && value !== courtInfo.courtName) {
      const postMutation = (result: any) => {
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

  const content = (elem: HTMLElement) =>
    renderForm(elem, [
      {
        value: courtInfo.courtName,
        label: t('modals.renameCourt.courtNameLabel'),
        field: 'courtName',
      },
    ]);

  openModal({
    title: t('modals.renameCourt.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('rename'), intent: 'is-primary', onClick: setNewName as any, close: true },
    ],
  });
}
