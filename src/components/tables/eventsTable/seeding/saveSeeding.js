import { saveSeedingValues } from './saveSeedingValues';
import { hideSaveSeeding } from './hideSaveSeeding';

import { RIGHT } from 'constants/tmxConstants';

export const saveSeeding = (event) => (table) => {
  const onClick = (e) => {
    hideSaveSeeding(e, table);
    const rows = table.getData();
    saveSeedingValues({ event, rows });
  };

  return {
    label: 'Save seeding',
    class: 'saveSeeding',
    intent: 'is-info',
    location: RIGHT,
    visible: false,
    onClick
  };
};
