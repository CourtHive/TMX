import { renameCourt } from 'components/modals/renameCourt';
import { tipster } from 'components/popovers/tipster';
import { lang } from 'services/translator';

export function setScheduleColumnHeader(e, column, courtInfo) {
  let courtIdentifiers = true;
  const addremove = courtIdentifiers ? lang.tr('remove') : lang.tr('add');

  const options = [
    {
      option: `${addremove} court identifiers`,
      onClick: toggleCourtIdentifiers,
    },
    {
      option: lang.tr('rename'),
      onClick: () => renameCourt({ column, courtInfo }),
    },
  ];

  const target = e.target;
  tipster({ options, target });

  function toggleCourtIdentifiers() {
    console.log('toggle court identifiers', { column });
  }
}
