/**
 * Column definitions for the event ranking points table.
 * Participant column uses renderParticipant for city/state and active rating display.
 */
import { preferencesConfig } from 'config/preferencesConfig';
import { renderParticipant } from 'courthive-components';
import { scalesMap } from 'config/scalesConfig';
import { t } from 'i18n';

export function getPointsColumns(): any[] {
  return [
    {
      title: t('tables.selection.participant'),
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
      title: t('tournaments.done'),
      field: 'rangeAccessor',
      headerHozAlign: 'center',
      hozAlign: 'center',
      headerSort: true,
      width: 90,
      responsive: 2,
    },
    {
      title: t('modals.participantProfile.wins'),
      field: 'winCount',
      headerHozAlign: 'center',
      hozAlign: 'center',
      headerSort: true,
      width: 70,
      responsive: 2,
    },
    {
      title: t('tables.selection.position'),
      field: 'positionPoints',
      headerHozAlign: 'center',
      hozAlign: 'center',
      headerSort: true,
      width: 100,
      responsive: 1,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: t('modals.participantProfile.perWin'),
      field: 'perWinPoints',
      headerHozAlign: 'center',
      hozAlign: 'center',
      headerSort: true,
      width: 100,
      responsive: 2,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: t('modals.participantProfile.bonus'),
      field: 'bonusPoints',
      headerHozAlign: 'center',
      hozAlign: 'center',
      headerSort: true,
      width: 90,
      responsive: 2,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: t('modals.participantProfile.quality'),
      field: 'qualityWinPoints',
      headerHozAlign: 'center',
      hozAlign: 'center',
      headerSort: true,
      width: 90,
      responsive: 3,
      formatter: (cell: any) => cell.getValue() || '',
    },
    {
      title: t('tot'),
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
