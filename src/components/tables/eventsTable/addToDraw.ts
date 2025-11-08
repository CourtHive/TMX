/**
 * Add selected participants to event draws.
 * Provides dropdown menu of available draws with direct acceptance entry status.
 */
import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';

import { ADD_DRAW_ENTRIES } from 'constants/mutationConstants';
import { OVERLAY } from 'constants/tmxConstants';

const { DIRECT_ACCEPTANCE } = entryStatusConstants;
const { MAIN } = drawDefinitionConstants;

const addTo = (table: any, eventId: string, drawId: string): void => {
  const selected = table.getSelectedData();
  const participantIds = selected.filter((p: any) => !p.events?.length).map(({ participantId }: any) => participantId);

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
  const postMutation = (result: any) => {
    if (result.success) {
      table.deselectRow();
    } else {
      console.log(result.error);
    }
  };
  mutationRequest({ methods, callback: postMutation });
};

export const addToDraw = (event: any, drawId?: string) => (table: any): any => {
  const options = (event.drawDefinitions || []).filter(Boolean).map(({ drawName, drawId }: any) => ({
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
