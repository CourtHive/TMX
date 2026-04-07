/**
 * Create a pair from two selected ungrouped participants in the unified table.
 * Standalone version that doesn't depend on context.tables[UNGROUPED].
 */
import { drawDefinitionConstants, entryStatusConstants, tools } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';

// Constants
import { ADD_EVENT_ENTRY_PAIRS } from 'constants/mutationConstants';

const { ALTERNATE } = entryStatusConstants;
const { MAIN } = drawDefinitionConstants;

export function pairFromUnified(event: any, participantIds: [string, string], callback: (result: any) => void): void {
  const { eventId, gender } = event;
  const participantId = tools.UUID();

  const methods = [
    {
      method: ADD_EVENT_ENTRY_PAIRS,
      params: {
        participantIdPairs: [participantIds],
        allowDuplicateParticipantIdPairs: true,
        entryStatus: ALTERNATE,
        entryStage: MAIN,
        uuids: [participantId],
        eventId,
      },
    },
  ];

  const postMutation = (result: any) => {
    if (result.success) {
      callback(result);
    } else if (result.error?.code === 'ERR_INVALID_PARTICIPANT_IDS') {
      const message = gender === 'MIXED' ? 'Genders must be mixed' : 'Invalid pairing';
      tmxToast({ intent: 'is-danger', message });
    } else {
      console.log({ methods, result });
    }
  };

  mutationRequest({ methods, callback: postMutation });
}
