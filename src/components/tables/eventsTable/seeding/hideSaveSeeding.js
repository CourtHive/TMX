import { toggleEditVisibility } from 'components/tables/common/toggleEditVisibility';

export function hideSaveSeeding(e, table) {
  toggleEditVisibility({
    classNames: ['saveSeeding', 'cancelManualSeeding'],
    columns: ['seedNumber'],
    visible: false,
    table,
    e
  });
}
