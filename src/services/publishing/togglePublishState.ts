import { PUBLISH_EVENT, UNPUBLISH_EVENT } from 'constants/mutationConstants';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';

export function togglePublishState(_, cell) {
  const row = cell.getRow().getData();
  const method = row.published ? UNPUBLISH_EVENT : PUBLISH_EVENT;
  const methods = [{ method, params: { eventId: row.eventId } }];
  const postMutation = (result) => {
    if (result?.success) {
      cell.getRow().update({ published: !row.published });
    } else {
      tmxToast({ message: result.error.message, intent: 'is-danger' });
    }
  };
  mutationRequest({ methods, callback: postMutation });
}
