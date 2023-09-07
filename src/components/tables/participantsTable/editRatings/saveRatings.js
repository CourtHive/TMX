import { toggleEditVisibility } from '../../common/toggleEditVisibility';
import { mutationRequest } from 'services/mutation/mutationRequest';

import { ADD_PARTICIPANT_TIME_ITEM } from 'constants/mutationConstants';

export function saveRatings(e, table) {
  toggleEditVisibility({
    columns: ['ratings.wtn.wtnRating', 'ratings.utr.utrRating'],
    className: 'saveRatings',
    visible: false,
    table,
    e
  });

  const rows = table.getData();
  const methods = rows.map((row) => {
    const wtnRating = row.ratings?.wtn?.wtnRating;
    const confidence = wtnRating ? 50 : 0;
    const itemValue = confidence ? { wtnRating, confidence } : undefined;
    return {
      method: ADD_PARTICIPANT_TIME_ITEM,
      params: {
        participantId: row.participantId,
        removePriorValues: true,
        timeItem: {
          itemType: 'SCALE.RATING.SINGLES.WTN',
          itemValue
        }
      }
    };
  });

  const postMutation = (result) => {
    if (!result.success) console.log(result);
  };
  mutationRequest({ methods, callback: postMutation });
}
