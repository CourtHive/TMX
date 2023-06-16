import { mutationRequest } from 'services/mutation/mutationRequest';

import { MODIFY_ENTRIES_STATUS } from 'constants/mutationConstants';
import { OVERLAY } from 'constants/tmxConstants';

const modifyStatus = (table, group) => {
  const selected = table.getSelectedData();
  const participantIds = selected.filter((p) => !p.events?.length).map(({ participantId }) => participantId);
  console.log({ group, participantIds });

  const params = { participantIds };
  const callback = (result) => {
    table.deselectRow();
    console.log({ result });
  };
  mutationRequest({ methods: [{ method: MODIFY_ENTRIES_STATUS, params }], callback });
};

export const changeEntryStatus = (groups) => (table) => {
  const options = groups.map((group) => ({
    onClick: () => modifyStatus(table, group),
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
