import { toggleEditVisibility } from '../../common/toggleEditVisibility';

export function enableManualRatings(e, table) {
  toggleEditVisibility({
    columns: ['ratings.wtn.wtnRating', 'ratings.utr.utrRating'],
    className: 'saveRatings',
    visible: true,
    table,
    e
  });
}
