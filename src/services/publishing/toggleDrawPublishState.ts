import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';

// constants
import { PUBLISH_EVENT } from 'constants/mutationConstants';

export const toggleDrawPublishState = (eventRow) => (_, cell) => {
  const row = cell.getRow().getData();
  const drawIdsToRemove = row.published ? [row.drawId] : undefined;
  const drawIdsToAdd = !row.published ? [row.drawId] : undefined;

  const method = PUBLISH_EVENT;
  const methods = [{ method, params: { eventId: row.eventId, drawIdsToAdd, drawIdsToRemove } }];
  const postMutation = (result) => {
    if (result?.success) {
      cell.getRow().update({ published: !row.published });
      const eventId = eventRow.getData().eventId;
      const publishState = tournamentEngine.getPublishState({ eventId }).publishState;
      const published = publishState?.status?.published;
      eventRow.update({ published });
    } else {
      tmxToast({ message: result.error.message, intent: 'is-danger' });
    }
  };
  mutationRequest({ methods, callback: postMutation });
};
