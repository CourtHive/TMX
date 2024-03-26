import { toggleEditVisibility } from '../../common/toggleEditVisibility';

export function enableEditWTID(e, table) {
  toggleEditVisibility({
    className: 'saveTennisId',
    columns: ['tennisId'],
    visible: true,
    table,
    e,
  });

  table.showColumn('tennisId');
  table.redraw(true);
}
