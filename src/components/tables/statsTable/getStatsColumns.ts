import { formatParticipant } from '../common/formatters/participantFormatter';
import { percentFormatter } from '../common/formatters/percentFormatter';
import { participantSorter } from '../common/sorters/participantSorter';
import { percentSorter } from '../common/sorters/percentSorter';
import { orderSorter } from '../common/sorters/orderSorter';
import { headerMenu } from '../common/headerMenu';

// constants
import { CENTER } from 'constants/tmxConstants';
import { t } from 'i18n';

export function getStatsColumns(): any[] {
  return [
    {
      headerMenu: headerMenu({}),
      field: 'drawPosition',
      headerSort: false,
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      width: 65,
    },
    {
      formatter: formatParticipant(({ event, cell, ...params }: any) =>
        console.log('cell clicked', { event, cell, undefined, params }),
      ),
      sorter: participantSorter,
      field: 'participantName',
      resizable: false,
      maxWidth: 400,
      minWidth: 200,
      title: t('tables.stats.name'),
    },
    {
      // Surface the participant's group as a real column rather than the
      // Tabulator groupBy header — that lets the user sort all participants
      // across groups by any stat and still see which group they came from.
      field: 'groupName',
      title: t('tables.stats.group'),
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      headerWordWrap: true,
      width: 110,
    },
    // Stat columns — no `maxWidth` so the user can drag them wider when the
    // wrapped header ("Points Win%" -> "Points" / "Win%") would otherwise be
    // clipped, plus a `minWidth` that fits the widest header word with a
    // little breathing room. `widthGrow: 0` keeps `fitColumns` from
    // distributing leftover table width onto these (extra width belongs to
    // the participantName column instead, which already has widthGrow: 2).
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: t('tables.stats.matchWinLoss'),
      hozAlign: CENTER,
      minWidth: 80,
      widthGrow: 0,
      field: 'result',
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'matchUpsPct',
      title: t('tables.stats.matchWinPct'),
      hozAlign: CENTER,
      minWidth: 80,
      widthGrow: 0,
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'setsResult',
      title: t('tables.stats.setsWinLoss'),
      hozAlign: CENTER,
      minWidth: 80,
      widthGrow: 0,
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: t('tables.stats.setWinPct'),
      hozAlign: CENTER,
      field: 'setsPct',
      minWidth: 80,
      widthGrow: 0,
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'gamesResult',
      title: t('tables.stats.gamesWinLoss'),
      hozAlign: CENTER,
      minWidth: 80,
      widthGrow: 0,
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: t('tables.stats.gameWinPct'),
      hozAlign: CENTER,
      field: 'gamesPct',
      minWidth: 80,
      widthGrow: 0,
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'pointsResult',
      title: t('tables.stats.pointsWinLoss'),
      hozAlign: CENTER,
      minWidth: 80,
      widthGrow: 0,
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: t('tables.stats.pointsWinPct'),
      field: 'pointsPct',
      hozAlign: CENTER,
      minWidth: 80,
      widthGrow: 0,
    },
    {
      formatter: percentFormatter,
      field: 'averageVariation',
      headerHozAlign: CENTER,
      sorter: percentSorter,
      hozAlign: CENTER,
      minWidth: 60,
      widthGrow: 0,
      title: t('tables.stats.rv'),
    },
    {
      formatter: percentFormatter,
      field: 'averagePressure',
      headerHozAlign: CENTER,
      sorter: percentSorter,
      hozAlign: CENTER,
      minWidth: 60,
      widthGrow: 0,
      title: t('tables.stats.ps'),
    },
    {
      headerHozAlign: CENTER,
      field: 'pressureOrder',
      sorter: orderSorter,
      title: t('tables.stats.psNum'),
      hozAlign: CENTER,
      minWidth: 70,
      widthGrow: 0,
    },
    {
      // Group position (1st, 2nd, … within each group) — `order` is the
      // resolved groupOrder, falling back to provisionalOrder.
      field: 'order',
      title: t('tables.bracket.pos'),
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      sorter: orderSorter,
      minWidth: 50,
      widthGrow: 0,
    },
  ];
}
