import { mapTournamentRecord } from 'pages/tournaments/mapTournamentRecord';
import { calendarControls } from 'pages/tournaments/tournamentsControls';
import { getLoginState } from 'services/authentication/loginState';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { getTournamentColumns } from './getTournamentColumn';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'pages/tournament/destroyTable';
import { getCalendar } from 'services/apis/servicesApi';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';

import { TOURNAMENTS_TABLE } from 'constants/tmxConstants';

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

  const columns = getTournamentColumns();

  const renderTable = (tableData) => {
    destroyTable({ anchorId: TOURNAMENTS_TABLE });
    const calendarAnchor = document.getElementById(TOURNAMENTS_TABLE);

    table = new Tabulator(calendarAnchor, {
      responsiveLayoutCollapseStartOpen: false,
      height: window.innerHeight * 0.85,
      placeholder: 'No tournaments',
      responsiveLayout: 'collapse',
      layout: 'fitColumns',
      index: 'tournamentId',
      headerVisible: false,
      reactiveData: true,
      data: tableData,
      columns,
    });

    table.on('scrollVertical', destroyTipster);
    table.on('tableBuilt', () => {
      calendarControls(table);
      ready = true;
    });
  };

  const render = (data) => {
    data.sort((a, b) => new Date(b.startDate || b.start) - new Date(a.startDate || a.start));
    renderTable(data.map(mapTournamentRecord));
  };
  const renderCalendarTable = (calendar) => {
    calendar.sort((a, b) => new Date(b.tournament.startDate) - new Date(a.tournament.startDate));
    renderTable(calendar);
  };
  const state = getLoginState();
  const provider = state?.profile?.provider || context?.provider;

  const noProvider = () => tmx2db.findAllTournaments().then(render, handleError);

  if (provider?.organisationAbbreviation) {
    const showResults = (result) => {
      if (result?.data?.calendar) {
        renderCalendarTable(result.data.calendar.tournaments);
      } else {
        noProvider();
      }
    };
    getCalendar({ providerAbbr: provider.organisationAbbreviation }).then(showResults);
  } else {
    noProvider();
  }

  return { table, replaceTableData };
}
