import { mutationRequest } from 'services/mutation/mutationRequest';

import { MODIFY_ENTRIES_STATUS } from 'constants/mutationConstants';
import { OVERLAY, entryStatusMapping } from 'constants/tmxConstants';

const modifyStatus = (table, group, eventId, drawId) => {
  const selected = table.getSelectedData();
  const participantIds = selected.filter((p) => !p.events?.length).map(({ participantId }) => participantId);
  const [entryStage, entryStatus] = group.split('.');

  const params = {
    ignoreAssignment: true,
    participantIds,
    entryStatus,
    entryStage,
    eventId,
    drawId
  };

  const callback = (result) => {
    table.deselectRow();

    if (result.success) {
      const rows = table.getRows();
      for (const row of rows) {
        const data = row.getData();
        if (participantIds.includes(data.participantId)) {
          data.status = entryStatusMapping[entryStatus];
          row.update(data);
        }
      }
    } else {
      console.log(result.error);
    }
  };

  mutationRequest({ methods: [{ method: MODIFY_ENTRIES_STATUS, params }], callback });
};

export const changeEntryStatus = (groups, eventId, drawId) => (table) => {
  const options = groups.map((group) => ({
    onClick: () => modifyStatus(table, group, eventId, drawId),
    label: group,
    value: group,
    close: true
  }));
  return {
    location: OVERLAY,
    label: 'Change status',
    options
  };
};
