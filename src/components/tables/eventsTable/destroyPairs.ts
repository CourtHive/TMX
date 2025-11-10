/**
 * Destroy pair entries action.
 * Removes selected pair participants and returns individuals to ungrouped status.
 */
import { tournamentEngine, entryStatusConstants, eventConstants } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { toggleOverlay } from 'components/controlBar/toggleOverlay';
import { mapEntry } from 'pages/tournament/tabs/eventsTab/mapEntry';
import { getParent } from 'services/dom/parentAndChild';
import { context } from 'services/context';

import { DESTROY_PAIR_ENTRIES } from 'constants/mutationConstants';
import { OVERLAY } from 'constants/tmxConstants';
import { tmxToast } from 'services/notifications/tmxToast';

const { UNGROUPED } = entryStatusConstants;
const { DOUBLES } = eventConstants;

export const destroySelected = (eventId: string, drawId?: string) => (table: any): any => {
  const destroyPairs = (table: any) => {
    const selected = table.getSelectedData();
    const participantIds = selected.filter((p: any) => !p.events?.length).map(({ participantId }: any) => participantId);
    const postMutation = (result: any) => {
      if (!result?.error) {
        table.deleteRow(participantIds);

        const tableClass = getParent(table.element, 'tableClass');
        const controlBar = tableClass?.parent?.getElementsByClassName('controlBar')?.[0];
        if (controlBar) setTimeout(() => (toggleOverlay as any)({ table, target: controlBar })(), 100);

        const individualParticipantIds = selected.flatMap(({ participant }: any) => participant?.individualParticipantIds);
        const { participants } = tournamentEngine.getParticipants({
          participantFilters: { participantIds: individualParticipantIds },
        });
        const entries = participants.map((participant: any) =>
          (mapEntry as any)({
            entry: { participantId: participant.participantId, entryStatus: UNGROUPED },
            eventType: DOUBLES,
            participant,
          }),
        );
        context.tables[UNGROUPED].updateOrAddData(entries);
      } else {
        table.deselectRow();
        tmxToast({ message: result.error[0]?.message ?? 'Error destroying pair', intent: 'is-danger' });
      }
    };
    const params = {
      removeGroupParticipant: true,
      participantIds,
      eventId,
      drawId,
    };

    mutationRequest({ methods: [{ method: DESTROY_PAIR_ENTRIES, params }], callback: postMutation });
  };
  return {
    onClick: () => destroyPairs(table),
    label: 'Destroy pairs',
    intent: 'is-danger',
    location: OVERLAY,
  };
};
