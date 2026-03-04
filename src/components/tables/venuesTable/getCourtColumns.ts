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

function durationFormatter(cell: any): string {
  const value = cell.getValue();
  if (value == null || value === '') return '';
  const minutes = Number(value);
  if (isNaN(minutes) || minutes === 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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
    { title: t('tables.courts.scheduledTime'), field: 'scheduledMinutes', formatter: durationFormatter, hozAlign: CENTER, headerHozAlign: CENTER },
    { title: t('tables.courts.unscheduledTime'), field: 'unscheduledMinutes', formatter: durationFormatter, hozAlign: CENTER, headerHozAlign: CENTER },
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
