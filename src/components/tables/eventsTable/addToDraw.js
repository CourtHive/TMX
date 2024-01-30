import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';

import { ADD_DRAW_ENTRIES } from 'constants/mutationConstants';
import { OVERLAY } from 'constants/tmxConstants';

const { DIRECT_ACCEPTANCE } = entryStatusConstants;
const { MAIN } = drawDefinitionConstants;

const addTo = (table, eventId, drawId) => {
  const selected = table.getSelectedData();
  const participantIds = selected.filter((p) => !p.events?.length).map(({ participantId }) => participantId);

  const methods = [
    {
      method: ADD_DRAW_ENTRIES,
      params: {
        entryStatus: DIRECT_ACCEPTANCE,
        ignoreStageSpace: true,
        entryStage: MAIN,
        participantIds,
        eventId,
        drawId,
      },
    },
  ];
  const postMutation = (result) => {
    if (result.success) {
      table.deselectRow();
    } else {
      console.log(result.error);
    }
  };
  mutationRequest({ methods, callback: postMutation });
};

export const addToDraw = (event, drawId) => (table) => {
  const options = (event.drawDefinitions || []).filter(Boolean).map(({ drawName, drawId }) => ({
    onClick: () => addTo(table, event.eventId, drawId),
    stateChange: true,
    label: drawName,
    value: drawId,
    close: true,
  }));

  return {
    hide: !event.drawDefinitions?.length || drawId,
    label: 'Add to draw',
    location: OVERLAY,
    options,
  };
};
