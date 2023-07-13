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
    return {
      method: ADD_PARTICIPANT_TIME_ITEM,
      params: {
        participantId: row.participantId,
        removePriorValues: true,
        timeItem: {
          itemType: 'SCALE.RATING.SINGLES.WTN',
          itemValue: {
            wtnRating: row.ratings.wtn.wtnRating,
            confidence: 50
          }
        }
      }
    };
  });

  const postMutation = (result) => {
    if (!result.success) console.log(result);
  };
  mutationRequest({ methods, callback: postMutation });
}
