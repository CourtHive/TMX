import { threeDots } from '../common/formatters/threeDots';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';

export function getCourtColumns() {
  function lightsFormatter(cell) {
    const value = cell.getValue();
    const hasLights = `<i class="fa-solid fa-check" style="color: green"></i>`;
    const noLights = `<i class="fa-solid fa-xmark"></i>`;
    return value ? hasLights : noLights;
  }

  const courtActions = () => console.log('Court actions');

  return [
    {
      cellClick: (_, cell) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      responsive: false,
      hozAlign: LEFT,
      width: 5
    },
    {
      headerMenu: headerMenu({ floodlit: 'Lights' }),
      formatter: 'rownum',
      headerSort: false,
      hozAlign: CENTER,
      width: 55
    },
    { title: 'Court Name', field: 'courtName', editor: true },
    { title: 'Scheduled Time', field: 'scheduledTime' },
    { title: 'Unscheduled Time', field: 'unscheduledTime' },
    { title: 'In/Out', field: 'indoorOutdoor' },
    { title: 'Surface', field: 'surfaceType' },
    {
      title: `<i class="fa-regular fa-lightbulb"></i>`,
      formatter: lightsFormatter,
      headerTooltip: 'Lights',
      field: 'floodlit',
      width: 50
    },
    {
      cellClick: courtActions,
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      width: 50
    }
  ];
}
