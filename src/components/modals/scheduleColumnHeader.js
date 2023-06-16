import { tipster } from 'components/popovers/tipster';
import { lang } from 'services/translator';

export function setScheduleColumnHeader(e, cell, courtInfo) {
  let courtIdentifiers = true;
  const addremove = courtIdentifiers ? lang.tr('remove') : lang.tr('add');

  const options = [
    {
      option: `${addremove} ${lang.tr('settings.courtidentifiers')}`,
      onClick: toggleCourtIdentifiers
    },
    {
      option: lang.tr('rename'),
      onClick: () => console.log('rename court', { courtInfo })
    }
  ];

  const target = e.target;
  tipster({ options, target });

  function toggleCourtIdentifiers() {
    console.log('toggle court identifiers', { cell });
  }
}
