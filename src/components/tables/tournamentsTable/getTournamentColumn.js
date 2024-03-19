import { tournamentFormatter } from '../common/formatters/tournamentFormatter';
import { tournamentActionFormatter } from './tournamentActionFormatter';
import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';

import { RIGHT, TOURNAMENT } from 'constants/tmxConstants';

export function getTournamentColumns(replaceTableData) {
  const isMobile = /Mobile/.test(navigator.userAgent);
  const openTournament = (_, cell) => {
    const tournamentId = cell.getRow().getData().tournamentId;

    if (tournamentId) {
      tournamentEngine.reset(); // ensure no tournament is in state
      const tournamentUrl = `/${TOURNAMENT}/${tournamentId}`;
      context.router.navigate(tournamentUrl);
    }
  };

  return [
    {
      formatter: tournamentFormatter(isMobile),
      cellClick: openTournament,
      field: 'tournament',
      headerSort: false,
      resizable: true,
      minWidth: 250,
      widthGrow: 3,
    },
    {
      formatter: () => `<div class="button font-medium">Open</div>`,
      cellClick: openTournament,
      vertAlign: 'middle',
      visible: !isMobile,
      title: 'Open',
      width: 90,
    },
    {
      formatter: tournamentActionFormatter(replaceTableData),
      field: 'tournamentId',
      vertAlign: 'middle',
      headerSort: false,
      hozAlign: RIGHT,
      width: 10,
    },
  ];
}
