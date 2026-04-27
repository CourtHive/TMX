/**
 * Destroy pair entries action.
 * Removes selected pair participants and returns individuals to ungrouped status.
 */
import { tournamentEngine, entryStatusConstants, eventConstants } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { toggleOverlay } from 'courthive-components';
import { mapEntry } from 'pages/tournament/tabs/eventsTab/mapEntry';
import { getParent } from 'services/dom/parentAndChild';
import { context } from 'services/context';

import { DESTROY_PAIR_ENTRIES } from 'constants/mutationConstants';
import { OVERLAY } from 'constants/tmxConstants';
import { tmxToast } from 'services/notifications/tmxToast';

const { UNGROUPED } = entryStatusConstants;
const { DOUBLES } = eventConstants;

export const destroySelected = (eventId: string, drawId?: string) => (table: any): any => ({
  onClick: () => destroyPairs(table, eventId, drawId),
  label: 'Destroy pairs',
  intent: 'is-danger',
  location: OVERLAY,
});

function hasNoEvents(p: any) {
  return !p.events?.length;
}

function pickParticipantId({ participantId }: any) {
  return participantId;
}

function pickIndividualIds({ participant }: any) {
  return participant?.individualParticipantIds;
}

function toUngroupedEntry(participant: any) {
  return (mapEntry as any)({
    entry: { participantId: participant.participantId, entryStatus: UNGROUPED },
    eventType: DOUBLES,
    participant,
  });
}

function applyDestroyPairsSuccess(table: any, selected: any[], participantIds: string[]) {
  table.deleteRow(participantIds);
  const tableClass = getParent(table.element, 'tableClass');
  const controlBar = tableClass?.parent?.getElementsByClassName('controlBar')?.[0];
  if (controlBar) setTimeout(() => (toggleOverlay as any)({ table, target: controlBar })(), 100);
  const individualParticipantIds = selected.flatMap(pickIndividualIds);
  const { participants } = tournamentEngine.getParticipants({
    participantFilters: { participantIds: individualParticipantIds },
  });
  context.tables[UNGROUPED].updateOrAddData(participants.map(toUngroupedEntry));
}

function destroyPairs(table: any, eventId: string, drawId?: string) {
  const selected = table.getSelectedData();
  const participantIds = selected.filter(hasNoEvents).map(pickParticipantId);
  const params = { removeGroupParticipant: true, participantIds, eventId, drawId };
  mutationRequest({
    methods: [{ method: DESTROY_PAIR_ENTRIES, params }],
    callback: (result: any) => {
      if (!result?.error) {
        applyDestroyPairsSuccess(table, selected, participantIds);
        return;
      }
      table.deselectRow();
      tmxToast({ message: result.error[0]?.message ?? 'Error destroying pair', intent: 'is-danger' });
    },
  });
}
