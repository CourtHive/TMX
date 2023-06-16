import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';

import { MODIFY_ENTRIES_STATUS } from 'constants/mutationConstants';
import { ACCEPTED } from 'constants/tmxConstants';

const { MAIN, QUALIFYING } = drawDefinitionConstants;
const { DIRECT_ACCEPTANCE } = entryStatusConstants;

export function modifyEntriesStatus({ participantIds, group, eventId, drawId, callback }) {
  const entryStatus = (group === ACCEPTED && DIRECT_ACCEPTANCE) || (group === QUALIFYING && DIRECT_ACCEPTANCE) || group;
  const entryStage = group === QUALIFYING ? QUALIFYING : MAIN;

  const params = {
    autoEntryPositions: true,
    participantIds,
    entryStatus,
    entryStage,
    eventId,
    drawId
  };

  mutationRequest({ methods: [{ method: MODIFY_ENTRIES_STATUS, params }], callback });
}
