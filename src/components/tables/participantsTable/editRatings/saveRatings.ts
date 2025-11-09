import { toggleEditVisibility } from '../../common/toggleEditVisibility';
import { mutationRequest } from 'services/mutation/mutationRequest';

import { ADD_PARTICIPANT_TIME_ITEM } from 'constants/mutationConstants';

export function saveRatings(e: any, table: any): void {
  toggleEditVisibility({
    columns: ['ratings.wtn.wtnRating', 'ratings.utr.utrRating'],
    classNames: ['saveRatings', 'saveTennisId'],
    visible: false,
    table,
    e,
  });

  table.showColumn('ratings.utr.utrRating');
  table.showColumn('ratings.wtn.wtnRating');
  table.redraw(true);

  const rows = table.getData();
  const methods = rows.flatMap((row: any) => {
    const cellRating = row.ratings?.wtn;
    const wtnRating = cellRating?.wtnRating;
    const wtnConfidence = cellRating?.confidence || wtnRating ? 50 : 0;
    let itemValue: any = wtnConfidence ? { ...cellRating, wtnRating, confidence: wtnConfidence } : '';
    const wtnMethod = {
      method: ADD_PARTICIPANT_TIME_ITEM,
      params: {
        participantId: row.participantId,
        removePriorValues: true,
        timeItem: {
          itemType: 'SCALE.RATING.SINGLES.WTN',
          itemValue,
        },
      },
    };
    const utrRating = row.ratings?.utr?.utrRating;
    const confidence = utrRating ? 50 : 0;
    itemValue = confidence ? { utrRating, confidence } : '';
    const utrMethod = {
      method: ADD_PARTICIPANT_TIME_ITEM,
      params: {
        participantId: row.participantId,
        removePriorValues: true,
        timeItem: {
          itemType: 'SCALE.RATING.SINGLES.UTR',
          itemValue,
        },
      },
    };
    return [wtnMethod, utrMethod];
  });

  const postMutation = (result: any) => {
    if (!result.success) console.log(result);
  };
  mutationRequest({ methods, callback: postMutation });
}
