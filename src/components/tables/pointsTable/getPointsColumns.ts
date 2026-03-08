/**
 * Column definitions for the event ranking points table.
 */

export function getPointsColumns(): any[] {
  return [
    {
      title: 'Participant',
      field: 'participantName',
      minWidth: 180,
      headerSort: true,
      responsive: 0,
    },
    {
      title: 'Finish',
      field: 'rangeAccessor',
      hozAlign: 'center',
      headerSort: true,
      width: 90,
      responsive: 2,
    },
    {
      title: 'Wins',
      field: 'winCount',
      hozAlign: 'center',
      headerSort: true,
      width: 70,
      responsive: 2,
    },
    {
      title: 'Position',
      field: 'positionPoints',
      hozAlign: 'center',
      headerSort: true,
      width: 100,
      responsive: 1,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: 'Per Win',
      field: 'perWinPoints',
      hozAlign: 'center',
      headerSort: true,
      width: 100,
      responsive: 2,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: 'Bonus',
      field: 'bonusPoints',
      hozAlign: 'center',
      headerSort: true,
      width: 90,
      responsive: 2,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: 'Quality',
      field: 'qualityWinPoints',
      hozAlign: 'center',
      headerSort: true,
      width: 90,
      responsive: 3,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: 'Total',
      field: 'points',
      hozAlign: 'center',
      headerSort: true,
      width: 100,
      responsive: 0,
      formatter: (cell: any) => {
        const val = cell.getValue();
        return val ? `<strong>${val}</strong>` : '';
      },
    },
  ];
}
