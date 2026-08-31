import { saveSeedingValues } from './saveSeedingValues';
import { hideSaveSeeding } from './hideSaveSeeding';

import { RIGHT } from 'constants/tmxConstants';
import { t } from 'i18n';

export const saveSeeding = (event: any) => (table: any) => {
  const onClick = (e: any) => {
    hideSaveSeeding(e, table);
    const rows = table.getData();
    saveSeedingValues({ event, rows });
  };

  return {
    label: t('entries.saveSeeding'),
    class: 'saveSeeding',
    intent: 'is-info',
    location: RIGHT,
    visible: false,
    onClick,
  };
};
