import { getChildrenByClassName, getParent } from 'services/dom/parentAndChild';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { toggleOverlay } from 'components/controlBar/toggleOverlay';
import { mapEntry } from 'pages/tournament/tabs/eventsTab/mapEntry';
import { tmxToast } from 'services/notifications/tmxToast';
import { context } from 'services/context';
import {
  drawDefinitionConstants,
  eventConstants,
  entryStatusConstants,
  tournamentEngine,
} from 'tods-competition-factory';

import { ADD_EVENT_ENTRY_PAIRS } from 'constants/mutationConstants';
import { NONE, OVERLAY } from 'constants/tmxConstants';

const { ALTERNATE, UNGROUPED } = entryStatusConstants;
const { MAIN } = drawDefinitionConstants;
const { DOUBLES } = eventConstants;

export const createPair = (event, addOnPairing = true) => {
  const { eventId, eventType, gender } = event;

  const addNewPair = (e, table) => {
    const selectedParticipantids = table.getSelectedData().map((r) => r.participantId);
    if (selectedParticipantids.length !== 2) return;

    const methods = [
      {
        method: ADD_EVENT_ENTRY_PAIRS,
        params: {
          participantIdPairs: [selectedParticipantids],
          entryStatus: ALTERNATE,
          entryStage: MAIN,
          eventId,
        },
      },
    ];

    const callback = (result) => {
      if (result.success) {
        table.deleteRow(selectedParticipantids);
        table.clearFilter();

        const parentElement = getParent(table.element, 'tableClass');
        if (parentElement) {
          const controlBar = getChildrenByClassName(parentElement, 'controlBar')?.[0];
          if (controlBar) {
            const search = getChildrenByClassName(controlBar, 'search');
            Array.from(search).forEach((el) => (el.value = ''));
          }
        }

        const participantIds = result.results[0].newParticipantIds;
        const {
          participants: [participant],
        } = tournamentEngine.getParticipants({
          participantFilters: { participantIds },
          withIndividualParticipants: true,
          withISO2: true,
        });

        if (participant) {
          const newEntry = mapEntry({
            entry: { participantId: participant.participantId, entryStatus: ALTERNATE },
            eventType: DOUBLES,
            participant,
          });
          context.tables[ALTERNATE].updateOrAddData([newEntry]);
          const tableClass = getParent(e.target, 'tableClass');
          const controlBar = tableClass.getElementsByClassName('controlBar')?.[0];
          // timeout is necessary to allow table event to trigger
          if (controlBar) setTimeout(() => toggleOverlay({ table, target: controlBar })(), 100);
        } else {
          console.log('participant not found', { participantIds, methods, result });
        }
      } else if (result.error?.code === 'ERR_INVALID_PARTICIPANT_IDS') {
        const message = gender === 'MIXED' ? 'Genders must be mixed' : 'Invalid pairing';
        tmxToast({ intent: 'is-danger', message });
        table.deselectRow();
      } else {
        console.log({ methods, result });
      }
    };
    mutationRequest({ methods, callback });
  };

  const createPairButton = {
    hide: eventType !== DOUBLES,
    label: 'Create pair',
    onClick: addNewPair,
    intent: 'is-info',
    location: OVERLAY,
    id: 'create-pair',
    visible: false,
  };

  const createPairFromSelected = (selectedRows) => {
    const pairSelected = selectedRows?.length === 2;
    if (pairSelected && addOnPairing) {
      const ungroupedTable = context.tables[UNGROUPED];
      addNewPair({ target: ungroupedTable.element }, ungroupedTable);
    } else {
      const createPairButton = document.getElementById('create-pair');
      if (createPairButton) createPairButton.style.display = pairSelected ? '' : NONE;
    }
  };

  return { createPairButton, createPairFromSelected };
};
