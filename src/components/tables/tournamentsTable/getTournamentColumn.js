import { tournamentFormatter } from '../common/formatters/tournamentFormatter';
import { actionFormatter } from '../common/formatters/tableActionFormatter';
import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';

import { CENTER, RIGHT, TOURNAMENT } from 'constants/tmxConstants';

export function getTournamentColumns() {
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
      formatter: 'responsiveCollapse',
      hozAlign: CENTER,
      headerSort: false,
      resizable: false,
      minWidth: 50,
      width: 50
    },
    {
      formatter: tournamentFormatter,
      cellClick: openTournament,
      field: 'tournament',
      headerSort: false,
      resizable: true,
      minWidth: 250,
      widthGrow: 3
    },
    {
      title: 'Open',
      vertAlign: 'middle',
      formatter: () => `<div class="button font-medium">Open</div>`,
      cellClick: openTournament,
      width: 90
    },
    {
      formatter: actionFormatter,
      field: 'tournamentId',
      vertAlign: 'middle',
      headerSort: false,
      hozAlign: RIGHT,
      width: 10
    }
  ];
}
