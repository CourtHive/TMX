import { tournamentEngine, entryStatusConstants, eventConstants } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { mapEntry } from 'Pages/Tournament/Tabs/eventsTab/mapEntry';
import { getParent } from 'services/dom/parentAndChild';
import { context } from 'services/context';

import { DESTROY_PAIR_ENTRIES } from 'constants/mutationConstants';
import { OVERLAY } from 'constants/tmxConstants';
import { toggleOverlay } from 'components/controlBar/toggleOverlay';

const { UNGROUPED } = entryStatusConstants;
const { DOUBLES } = eventConstants;

export const destroySelected = (eventId, drawId) => (table) => {
  const destroyPairs = (table) => {
    const selected = table.getSelectedData();
    const participantIds = selected.filter((p) => !p.events?.length).map(({ participantId }) => participantId);
    const postMutation = (result) => {
      if (!result?.error) {
        table.deleteRow(participantIds);

        const tableClass = getParent(table.element, 'tableClass');
        const controlBar = tableClass.getElementsByClassName('controlBar')?.[0];
        // timeout is necessary to allow table event to trigger
        if (controlBar) setTimeout(() => toggleOverlay(controlBar)(), 100);

        const individualParticipantIds = selected.flatMap(({ participant }) => participant?.individualParticipantIds);
        const { participants } = tournamentEngine.getParticipants({
          participantFilters: { participantIds: individualParticipantIds }
        });
        const entries = participants.map((participant) =>
          mapEntry({
            entry: { participantId: participant.participantId, entryStatus: UNGROUPED },
            eventType: DOUBLES,
            participant
          })
        );
        context.tables[UNGROUPED].updateOrAddData(entries);
      } else {
        table.deselectRow();
      }
    };
    const params = {
      removeGroupParticipant: true,
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
