import { formatParticipant } from '../common/formatters/participantFormatter';
import { percentFormatter } from '../common/formatters/percentFormatter';
import { participantSorter } from '../common/sorters/participantSorter';
import { percentSorter } from '../common/sorters/percentSorter';
import { orderSorter } from '../common/sorters/orderSorter';
import { headerMenu } from '../common/headerMenu';

// constants
import { CENTER, LEFT } from 'constants/tmxConstants';
import { t } from 'i18n';

export function getStatsColumns(): any[] {
  return [
    {
      headerMenu: headerMenu({}),
      field: 'drawPosition',
      headerSort: false,
      hozAlign: LEFT,
      width: 55,
    },
    {
      formatter: 'responsiveCollapse',
      hozAlign: CENTER,
      responsive: false,
      headerSort: false,
      resizable: false,
      width: 50,
    },
    {
      formatter: formatParticipant(({ event, cell, ...params }: any) =>
        console.log('cell clicked', { event, cell, undefined, params }),
      ),
      sorter: participantSorter,
      field: 'participantName',
      responsive: false,
      resizable: false,
      maxWidth: 400,
      minWidth: 200,
      widthGrow: 2,
      title: t('tables.stats.name'),
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: t('tables.stats.matchWinLoss'),
      hozAlign: CENTER,
      maxWidth: 80,
      field: 'result',
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'matchUpsPct',
      title: t('tables.stats.matchWinPct'),
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'setsResult',
      title: t('tables.stats.setsWinLoss'),
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: t('tables.stats.setWinPct'),
      hozAlign: CENTER,
      field: 'setsPct',
      maxWidth: 80,
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'gamesResult',
      title: t('tables.stats.gamesWinLoss'),
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: t('tables.stats.gameWinPct'),
      hozAlign: CENTER,
      field: 'gamesPct',
      maxWidth: 80,
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'pointsResult',
      title: t('tables.stats.pointsWinLoss'),
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: t('tables.stats.pointsWinPct'),
      field: 'pointsPct',
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      formatter: percentFormatter,
      field: 'averageVariation',
      headerHozAlign: CENTER,
      sorter: percentSorter,
      hozAlign: CENTER,
      maxWidth: 70,
      title: t('tables.stats.rv'),
    },
    {
      formatter: percentFormatter,
      field: 'averagePressure',
      headerHozAlign: CENTER,
      sorter: percentSorter,
      hozAlign: CENTER,
      maxWidth: 70,
      title: t('tables.stats.ps'),
    },
    {
      headerHozAlign: CENTER,
      field: 'pressureOrder',
      sorter: orderSorter,
      title: t('tables.stats.psNum'),
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      field: 'groupName',
      visible: false,
      title: t('tables.stats.group'),
    },
  ];
}
