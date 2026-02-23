import { courtActions } from '../../popovers/courtActions';
import { threeDots } from '../common/formatters/threeDots';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';
import { t } from 'i18n';

function lightsFormatter(cell: any): string {
  const value = cell.getValue();
  const hasLights = `<i class="fa-solid fa-check" style="color: var(--tmx-accent-green)"></i>`;
  const noLights = `<i class="fa-solid fa-xmark"></i>`;
  return value ? hasLights : noLights;
}

export function getCourtColumns(): any[] {
  return [
    {
      cellClick: (_: any, cell: any) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      responsive: false,
      hozAlign: LEFT,
      width: 5,
    },
    {
      headerMenu: headerMenu({ floodlit: 'Lights' }),
      formatter: 'rownum',
      headerSort: false,
      hozAlign: CENTER,
      width: 55,
    },
    { title: t('tables.courts.courtName'), field: 'courtName', editor: true },
    { title: t('tables.courts.scheduledTime'), field: 'scheduledTime' },
    { title: t('tables.courts.unscheduledTime'), field: 'unscheduledTime' },
    { title: t('tables.courts.inOut'), field: 'indoorOutdoor' },
    { title: t('tables.courts.surface'), field: 'surfaceType' },
    {
      title: `<i class="fa-regular fa-lightbulb"></i>`,
      formatter: lightsFormatter,
      headerTooltip: 'Lights',
      field: 'floodlit',
      width: 50,
    },
    {
      cellClick: courtActions(),
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      width: 50,
    },
  ];
}
