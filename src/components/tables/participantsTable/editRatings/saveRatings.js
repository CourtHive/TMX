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
  const methods = rows.flatMap((row) => {
    const existingRating = row.ratings?.wtn;
    const wtnRating = existingRating?.wtnRating;
    const wtnConfidence = existingRating?.confidence || wtnRating ? 50 : 0;
    let itemValue = wtnConfidence ? { ...existingRating, wtnRating, confidence: wtnConfidence } : undefined;
    const wtnMethod = {
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
    const utrRating = row.ratings?.utr?.utrRating;
    const confidence = utrRating ? 50 : 0;
    itemValue = confidence ? { utrRating, confidence } : undefined;
    const utrMethod = {
      method: ADD_PARTICIPANT_TIME_ITEM,
      params: {
        participantId: row.participantId,
        removePriorValues: true,
        timeItem: {
          itemType: 'SCALE.RATING.SINGLES.UTR',
          itemValue
        }
      }
    };
    return [wtnMethod, utrMethod];
  });

  const postMutation = (result) => {
    if (!result.success) console.log(result);
  };
  mutationRequest({ methods, callback: postMutation });
}
