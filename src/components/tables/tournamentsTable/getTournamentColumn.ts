/**
 * Tabulator column definitions for the tournaments page "Table" view.
 *
 * Card view is the default; this table provides denser surfaceable data
 * (status, location, players, fee, dates) for power users.
 */

import { createCourtSvg, TournamentCardData, TournamentStatusKind } from 'courthive-components';
import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';

import { TOURNAMENT } from 'constants/tmxConstants';
import { t } from 'i18n';

const STATUS_LABEL: Record<TournamentStatusKind, string> = {
  cancelled: 'Cancelled',
  completed: 'Completed',
  live: 'Live',
  'closing-soon': 'Closing Soon',
  'registration-opens': 'Registration',
  'registration-open': 'Registration Open'
};

function openTournament(_: any, cell: any): void {
  const tournamentId = cell.getRow().getData().tournamentId;
  if (!tournamentId) return;
  tournamentEngine.reset();
  context.router?.navigate(`/${TOURNAMENT}/${tournamentId}`);
}

function imageFormatter(cell: any): HTMLElement {
  const data: TournamentCardData = cell.getRow().getData().tournament;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;width:2.5em;height:2.5em;';

  if (data?.tournamentImageURL) {
    const img = document.createElement('img');
    img.src = data.tournamentImageURL;
    img.alt = '';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:0.25em;';
    wrap.appendChild(img);
    return wrap;
  }

  const svg = createCourtSvg(data?.courtSvgSport);
  if (svg) {
    svg.style.cssText = 'width:100%;height:100%;opacity:0.7;';
    wrap.appendChild(svg);
  }
  return wrap;
}

function nameFormatter(cell: any): string {
  const data: TournamentCardData = cell.getRow().getData().tournament;
  return `<span style="font-weight:500">${data?.tournamentName ?? ''}</span>`;
}

function statusFormatter(cell: any): string {
  const data: TournamentCardData = cell.getRow().getData().tournament;
  if (!data?.status) return '';
  const label = STATUS_LABEL[data.status.kind] ?? data.status.label;
  return `<span class="tmx-tournaments-status-pill" data-kind="${data.status.kind}">${label}</span>`;
}

function locationFormatter(cell: any): string {
  const data: TournamentCardData = cell.getRow().getData().tournament;
  return data?.location ?? '';
}

function datesFormatter(cell: any): string {
  const data: TournamentCardData = cell.getRow().getData().tournament;
  return data?.dateRangeFormatted ?? '';
}

function playersFormatter(cell: any): string {
  const data: TournamentCardData = cell.getRow().getData().tournament;
  return typeof data?.participantCount === 'number' ? String(data.participantCount) : '';
}

function feeFormatter(cell: any): string {
  const data: TournamentCardData = cell.getRow().getData().tournament;
  return data?.feeFormatted ?? '';
}

function sortByStartDate(_a: any, _b: any, aRow: any, bRow: any): number {
  const at = new Date(aRow.getData().tournament.startDate || 0).getTime();
  const bt = new Date(bRow.getData().tournament.startDate || 0).getTime();
  return at - bt;
}

function sortByPlayerCount(_a: any, _b: any, aRow: any, bRow: any): number {
  const ac = aRow.getData().tournament.participantCount ?? 0;
  const bc = bRow.getData().tournament.participantCount ?? 0;
  return ac - bc;
}

function sortByName(_a: any, _b: any, aRow: any, bRow: any): number {
  const an = aRow.getData().tournament.tournamentName || '';
  const bn = bRow.getData().tournament.tournamentName || '';
  return an.localeCompare(bn, undefined, { numeric: true });
}

export function getTournamentColumns(): any[] {
  const isMobile = /Mobile/.test(navigator.userAgent);

  return [
    {
      title: '',
      formatter: imageFormatter,
      cellClick: openTournament,
      headerSort: false,
      width: 56,
      visible: !isMobile
    },
    {
      title: 'Tournament',
      formatter: nameFormatter,
      cellClick: openTournament,
      sorter: sortByName,
      minWidth: 220,
      widthGrow: 3
    },
    {
      title: 'Status',
      formatter: statusFormatter,
      headerSort: false,
      width: 130,
      hozAlign: 'center'
    },
    {
      title: 'Location',
      formatter: locationFormatter,
      headerSort: false,
      minWidth: 140,
      widthGrow: 2,
      visible: !isMobile
    },
    {
      title: 'Dates',
      formatter: datesFormatter,
      sorter: sortByStartDate,
      minWidth: 160,
      widthGrow: 1
    },
    {
      title: 'Players',
      formatter: playersFormatter,
      sorter: sortByPlayerCount,
      hozAlign: 'right',
      width: 90,
      visible: !isMobile
    },
    {
      title: 'Fee',
      formatter: feeFormatter,
      headerSort: false,
      width: 130,
      visible: !isMobile
    },
    {
      title: t('tables.tournaments.open'),
      formatter: () => `<div class="button font-medium">${t('tables.tournaments.open')}</div>`,
      cellClick: openTournament,
      vertAlign: 'middle',
      headerSort: false,
      visible: !isMobile,
      width: 80
    }
  ];
}
