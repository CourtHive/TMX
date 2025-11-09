import { toggleEditVisibility } from 'components/tables/common/toggleEditVisibility';

export function hideSaveSeeding(e: any, table: any): void {
  toggleEditVisibility({
    classNames: ['saveSeeding', 'cancelManualSeeding'],
    columns: ['seedNumber'],
    visible: false,
    table,
    e
  });
}
