import { toggleEditVisibility } from '../../common/toggleEditVisibility';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';

import { ADD_PARTICIPANT_TIME_ITEM } from 'constants/mutationConstants';

export function saveRatings(e, table) {
  toggleEditVisibility({
    columns: ['ratings.wtn.wtnRating', 'ratings.utr.utrRating'],
    className: 'saveRatings',
    visible: false,
    table,
    e,
  });

  table.showColumn('ratings.utr.utrRating');
  table.showColumn('ratings.wtn.wtnRating');
  table.redraw(true);

  const { participantMap } = tournamentEngine.getParticipants({ withScaleValues: true });
  // TODO: check the cellValue against the current value in the participantMap and only update if different
  // TODO: factory method to bulk update participant scale values
  !!participantMap;

  const rows = table.getData();
  const methods = rows.flatMap((row) => {
    const cellRating = row.ratings?.wtn;
    const wtnRating = cellRating?.wtnRating;
    const wtnConfidence = cellRating?.confidence || wtnRating ? 50 : 0;
    let itemValue = wtnConfidence ? { ...cellRating, wtnRating, confidence: wtnConfidence } : '';
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

  const postMutation = (result) => {
    if (!result.success) console.log(result);
  };
  mutationRequest({ methods, callback: postMutation });
}
