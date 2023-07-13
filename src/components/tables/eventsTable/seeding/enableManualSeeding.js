import { toggleEditVisibility } from 'components/tables/common/toggleEditVisibility';

export function enableManualSeeding(e, table) {
  toggleEditVisibility({
    classNames: ['saveSeeding', 'cancelManualSeeding'],
    columns: ['seedNumber'],
    visible: true,
    table,
    e
  });
}
