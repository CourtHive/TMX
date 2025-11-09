import { toggleEditVisibility } from 'components/tables/common/toggleEditVisibility';

export function enableManualSeeding(e: any, table: any): void {
  toggleEditVisibility({
    classNames: ['saveSeeding', 'cancelManualSeeding'],
    columns: ['seedNumber'],
    visible: true,
    table,
    e,
  });
  table.showColumn('seedNumber');
  table.redraw(true);
}
