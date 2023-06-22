import { mutationRequest } from 'services/mutation/mutationRequest';

import { DESTROY_PAIR_ENTRIES } from 'constants/mutationConstants';
import { OVERLAY } from 'constants/tmxConstants';

export const destroySelected = (eventId, drawId) => (table) => {
  const destroyPairs = (table) => {
    const selected = table.getSelectedData();
    const participantIds = selected.filter((p) => !p.events?.length).map(({ participantId }) => participantId);
    const postMutation = (result) => {
      console.log({ result });
      if (!result?.error) {
        table.deleteRow(participantIds);
      } else {
        table.deselectRow();
      }
    };
    const params = {
      participantIds,
      eventId,
      drawId
    };

    mutationRequest({ methods: [{ method: DESTROY_PAIR_ENTRIES, params }], callback: postMutation });
  };
  return {
    onClick: () => destroyPairs(table),
    label: 'Destroy pairs',
    intent: 'is-danger',
    location: OVERLAY
  };
};
