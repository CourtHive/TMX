import { renameCourt } from 'components/modals/renameCourt';
import { tipster } from 'components/popovers/tipster';
import { t } from 'i18n';

export function setScheduleColumnHeader(e: any, column: any, courtInfo: any): void {
  const courtIdentifiers = true;
  const addremove = courtIdentifiers ? t('remove') : t('add');

  const options = [
    {
      option: `${addremove} court identifiers`,
      onClick: toggleCourtIdentifiers,
    },
    {
      option: t('rename'),
      onClick: () => renameCourt({ column, courtInfo }),
    },
  ];

  const target = e.target;
  tipster({ options, target });

  function toggleCourtIdentifiers() {
    console.log('toggle court identifiers', { column });
  }
}
