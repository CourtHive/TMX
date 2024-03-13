import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';

// constants
import { PUBLISH_EVENT, UNPUBLISH_EVENT } from 'constants/mutationConstants';

export const toggleEventPublishState = (nestedTables) => (_, cell) => {
  const row = cell.getRow().getData();
  const eventId = row.eventId;
  const published = !row.published;
  const method = row.published ? UNPUBLISH_EVENT : PUBLISH_EVENT;
  const drawsRows = nestedTables.get(eventId).getRows();
  drawsRows.forEach((drawRow) => drawRow.update({ published }));
  const methods = [
    {
      method,
      params: {
        eventId,
        eventDataParams: {
          // in the case of publishing, add additional parameters
          participantsProfile: { withScaleValues: true },
          pressureRating: true,
          refreshResults: true,
        },
      },
    },
  ];
  const postMutation = (result) => {
    if (result?.success) {
      cell.getRow().update({ published: !row.published });
    } else {
      tmxToast({ message: result.error.message, intent: 'is-danger' });
    }
  };
  mutationRequest({ methods, callback: postMutation });
};
