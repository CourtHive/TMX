import { modifyEntriesStatus } from './modifyEntriesStatus';
import { context } from 'services/context';

import { OVERLAY } from 'constants/tmxConstants';

const moveTo = (table, group, eventId, drawId) => {
  const selected = table.getSelectedData();
  const participantIds = selected.filter((p) => !p.events?.length).map(({ participantId }) => participantId);

  const callback = (result) => {
    if (result?.success) {
      const data = table.getData();
      const targetRows = data.filter(({ participantId }) => participantIds.includes(participantId));
      context.tables[group].updateOrAddData(targetRows);
      table.deleteRow(participantIds);
    } else {
      table.deselectRow();
    }
  };
  modifyEntriesStatus({ participantIds, group, eventId, drawId, callback });
};

export const moveSelected = (groups, eventId, drawId) => (table) => {
  const options = groups.map((group) => ({
    onClick: () => moveTo(table, group, eventId, drawId),
    stateChange: true,
    label: group,
    value: group,
    close: true
  }));

  return {
    location: OVERLAY,
    label: 'Move selected participants',
    options
  };
};
