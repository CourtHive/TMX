/**
 * Destroy pair entries action (unified entries table).
 * Removes the selected PAIR participants from the event and returns their
 * individuals to UNGROUPED status. The factory `destroyPairEntries` mutation
 * does the entry rewiring; the UI just re-reads via the unified refresh.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { participantConstants } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';

import { DESTROY_PAIR_ENTRIES } from 'constants/mutationConstants';
import { OVERLAY } from 'constants/tmxConstants';

const { PAIR } = participantConstants;

export const destroySelected =
  (eventId: string, onRefresh: () => void, drawId?: string) =>
  (table: any): any => ({
    onClick: () => destroyPairs(table, eventId, onRefresh, drawId),
    label: 'Destroy pairs',
    intent: 'is-danger',
    location: OVERLAY,
  });

function isDestroyablePair(row: any) {
  // A pair can be destroyed (its individuals returned to UNGROUPED) only when it
  // is not placed in a draw. Individuals placed in a draw keep a drawPosition.
  return row.participant?.participantType === PAIR && !row.drawPosition;
}

function pickParticipantId({ participantId }: any) {
  return participantId;
}

function destroyPairs(table: any, eventId: string, onRefresh: () => void, drawId?: string) {
  const selected = table.getSelectedData().filter((r: any) => !r._isSeparator);
  const participantIds = selected.filter(isDestroyablePair).map(pickParticipantId);

  if (!participantIds.length) {
    table.deselectRow();
    tmxToast({ message: 'No destroyable pairs selected', intent: 'is-warning' });
    return;
  }

  const params = { removeGroupParticipant: true, participantIds, eventId, drawId };
  mutationRequest({
    methods: [{ method: DESTROY_PAIR_ENTRIES, params }],
    callback: (result: any) => {
      table.deselectRow();
      if (!result?.error) {
        onRefresh();
        return;
      }
      const message = result.error[0]?.message ?? result.error?.message ?? 'Error destroying pair';
      tmxToast({ message, intent: 'is-danger' });
    },
  });
}
