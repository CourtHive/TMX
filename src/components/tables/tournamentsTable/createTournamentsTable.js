import { tournamentFormatter } from '../common/formatters/tournamentFormatter';
import { mapTournamentRecord } from 'Pages/Tournaments/mapTournamentRecord';
import { actionFormatter } from '../common/formatters/tableActionFormatter';
import { calendarControls } from 'Pages/Tournaments/tournamentsControls';
import { getLoginState } from 'services/authentication/loginState';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'Pages/Tournament/destroyTable';
import { tournamentEngine } from 'tods-competition-factory';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';

import { TOURNAMENTS_TABLE, CENTER, TOURNAMENT, RIGHT } from 'constants/tmxConstants';

export function createTournamentsTable() {
  const handleError = (error) => console.log('db Error', { error });
  let table, ready;

  const replaceTableData = () => {
    const refresh = () => {
      const refreshData = (data) => table.replaceData(data.map(mapTournamentRecord));
      tmx2db.findAllTournaments().then(refreshData, handleError);
    };

    setTimeout(refresh, ready ? 0 : 1000);
  };

  const openTournament = (_, cell) => {
    const tournamentId = cell.getRow().getData().tournamentId;

    if (tournamentId) {
      tournamentEngine.reset(); // ensure no tournament is in state
      const tournamentUrl = `/${TOURNAMENT}/${tournamentId}`;
      context.router.navigate(tournamentUrl);
    }
  };

  const renderTable = (tableData) => {
    destroyTable({ anchorId: TOURNAMENTS_TABLE });
    const calendarAnchor = document.getElementById(TOURNAMENTS_TABLE);

    table = new Tabulator(calendarAnchor, {
      responsiveLayoutCollapseStartOpen: false,
      height: window.innerHeight * 0.9,
      placeholder: 'No tournaments',
      responsiveLayout: 'collapse',
      layout: 'fitColumns',
      index: 'tournamentId',
      headerVisible: false,
      reactiveData: true,
      data: tableData,
      columns: [
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
          minWidth: 250
        },
        {
          vertAlign: 'middle',
          headerSort: false,
          field: 'category'
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
      ]
    });

    table.on('tableBuilt', () => {
      calendarControls(table);
      ready = true;
    });
  };

  const render = (data) => {
    data.sort((a, b) => new Date(b.startDate || b.start) - new Date(a.startDate || a.start));
    renderTable(data.map(mapTournamentRecord));
  };
  const renderCalendar = (calendar) => {
    calendar.sort((a, b) => new Date(b.tournament.startDate) - new Date(a.tournament.startDate));
    renderTable(calendar);
  };
  const state = getLoginState();
  const providerId = state?.profile?.provider?.providerId;

  if (providerId) {
    const showResults = (result) => {
      if (result?.calendar) {
        renderCalendar(result.calendar);
      } else {
        tmx2db.findAllTournaments().then(render, handleError);
      }
    };
    tmx2db.findProvider(providerId).then(showResults, handleError);
  } else {
    tmx2db.findAllTournaments().then(render, handleError);
  }

  return { table, replaceTableData };
}
