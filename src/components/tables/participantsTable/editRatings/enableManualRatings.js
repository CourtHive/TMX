import { toggleEditVisibility } from '../../common/toggleEditVisibility';

export function enableManualRatings(e, table) {
  toggleEditVisibility({
    columns: ['ratings.wtn.wtnRating', 'ratings.utr.utrRating'],
    className: 'saveRatings',
    visible: true,
    table,
    e,
  });

  table.showColumn('ratings.utr.utrRating');
  table.showColumn('ratings.wtn.wtnRating');
  table.redraw(true);
}
