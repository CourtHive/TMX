/**
 * Column definitions for the event ranking points table.
 * Participant column uses renderParticipant for city/state and active rating display.
 */
import { renderParticipant } from 'courthive-components';
import { preferencesConfig } from 'config/preferencesConfig';
import { scalesMap } from 'config/scalesConfig';

export function getPointsColumns(): any[] {
  return [
    {
      title: 'Participant',
      field: 'participantName',
      minWidth: 220,
      headerSort: true,
      responsive: 0,
      formatter: (cell: any) => {
        const data = cell.getRow().getData();
        const participant = data.participant;
        if (!participant) return data.participantName || '';

        const scaleAttributes = scalesMap[preferencesConfig.get().activeScale];
        const elem = renderParticipant({
          composition: {
            theme: 'default',
            configuration: {
              participantDetail: 'ADDRESS',
              scaleAttributes,
              genderColor: true,
              flag: false,
            },
          },
          participant,
        });
        return elem;
      },
    },
    {
      title: 'Finish',
      field: 'rangeAccessor',
      headerHozAlign: 'center',
      hozAlign: 'center',
      headerSort: true,
      width: 90,
      responsive: 2,
    },
    {
      title: 'Wins',
      field: 'winCount',
      headerHozAlign: 'center',
      hozAlign: 'center',
      headerSort: true,
      width: 70,
      responsive: 2,
    },
    {
      title: 'Position',
      field: 'positionPoints',
      headerHozAlign: 'center',
      hozAlign: 'center',
      headerSort: true,
      width: 100,
      responsive: 1,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: 'Per Win',
      field: 'perWinPoints',
      headerHozAlign: 'center',
      hozAlign: 'center',
      headerSort: true,
      width: 100,
      responsive: 2,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: 'Bonus',
      field: 'bonusPoints',
      headerHozAlign: 'center',
      hozAlign: 'center',
      headerSort: true,
      width: 90,
      responsive: 2,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: 'Quality',
      field: 'qualityWinPoints',
      headerHozAlign: 'center',
      hozAlign: 'center',
      headerSort: true,
      width: 90,
      responsive: 3,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: 'Total',
      field: 'points',
      headerHozAlign: 'center',
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
