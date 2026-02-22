/**
 * Create participant pairs for doubles events.
 * Handles pairing of individual participants into doubles teams.
 */
import { getChildrenByClassName, getParent } from 'services/dom/parentAndChild';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { toggleOverlay } from 'courthive-components';
import { mapEntry } from 'pages/tournament/tabs/eventsTab/mapEntry';
import { tmxToast } from 'services/notifications/tmxToast';
import { context } from 'services/context';
import {
  drawDefinitionConstants,
  eventConstants,
  entryStatusConstants,
  tournamentEngine,
  tools,
} from 'tods-competition-factory';

import { ADD_EVENT_ENTRY_PAIRS } from 'constants/mutationConstants';
import { NONE, OVERLAY } from 'constants/tmxConstants';

const { ALTERNATE, UNGROUPED } = entryStatusConstants;
const { MAIN } = drawDefinitionConstants;
const { DOUBLES } = eventConstants;

export const createPair = (event: any, addOnPairing = true): any => {
  const { eventId, eventType, gender } = event;

  const addNewPair = (e: any, table: any) => {
    const selectedParticipantids = table.getSelectedData().map((r: any) => r.participantId);
    if (selectedParticipantids.length !== 2) return;
    const participantId = tools.UUID();
    const uuids = [participantId];

    const methods = [
      {
        method: ADD_EVENT_ENTRY_PAIRS,
        params: {
          participantIdPairs: [selectedParticipantids],
          allowDuplicateParticipantIdPairs: true,
          entryStatus: ALTERNATE,
          entryStage: MAIN,
          eventId,
          uuids,
        },
      },
    ];

    const handleSuccessfulPairing = (result: any) => {
      table.deleteRow(selectedParticipantids);
      table.clearFilter();

      const parentElement = getParent(table.element, 'tableClass');
      if (parentElement) {
        const controlBar = getChildrenByClassName(parentElement, 'controlBar')?.[0];
        if (controlBar) {
          const search = getChildrenByClassName(controlBar, 'search');
          Array.from(search).forEach((el: any) => (el.value = ''));
        }
      }

      const participantIds = result.results[0].newParticipantIds;
      const {
        participants: [participant],
        derivedDrawInfo,
      } = tournamentEngine.getParticipants({
        participantFilters: { participantIds },
        withIndividualParticipants: true,
        withScaleValues: true,
        withDraws: true,
        withISO2: true,
      });

      if (participant) {
        const { event } = tournamentEngine.getEvent({ eventId });
        const categoryName = event?.category?.categoryName ?? event?.category?.ageCategoryCode;
        const newEntry = mapEntry({
          entry: { participantId: participant.participantId, entryStatus: ALTERNATE, entryStage: MAIN },
          derivedDrawInfo,
          eventType: DOUBLES,
          categoryName,
          participant,
          eventId,
        });
        context.tables[ALTERNATE]?.updateOrAddData([newEntry]);
        const tableClass = getParent(e.target, 'tableClass');
        const controlBar = tableClass?.parent?.getElementsByClassName('controlBar')?.[0] as HTMLElement;
        if (controlBar) setTimeout(() => toggleOverlay({ target: controlBar })(), 100);
      } else {
        console.log('participant not found', { participantIds, methods, result });
      }
    };

    const callback = (result: any) => {
      if (result.success) {
        handleSuccessfulPairing(result);
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

  const createPairFromSelected = (selectedRows: any[]) => {
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
