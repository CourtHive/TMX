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
  const dnav = document.getElementById('dnav');
  dnav.style.backgroundColor = '';
  let table;

  const columns = getTournamentColumns();

  const renderTable = (tableData) => {
    destroyTable({ anchorId: TOURNAMENTS_TABLE });
    const calendarAnchor = document.getElementById(TOURNAMENTS_TABLE);

    table = new Tabulator(calendarAnchor, {
      height: window.innerHeight * 0.85,
      placeholder: 'No tournaments',
      layout: 'fitColumns',
      index: 'tournamentId',
      headerVisible: false,
      reactiveData: true,
      data: tableData,
      columns,
    });

    table.on('tableBuilt', () => calendarControls(table));
    table.on('scrollVertical', destroyTipster);
  };

  const render = (data) => {
    data.sort((a, b) => new Date(b.startDate || b.start) - new Date(a.startDate || a.start));
    renderTable(data.map(mapTournamentRecord));
  };
  const renderCalendarTable = ({ tournaments, provider }) => {
    const tableData = tournaments
      .sort((a, b) => new Date(b.tournament.startDate) - new Date(a.tournament.startDate))
      .map((t) => {
        const offline = t.tournament.timeItemValues?.TMX?.offline;
        t.tournament.offline = offline;
        const tournamentImageURL = t.tournament.onlineResources?.find(
          ({ name, resourceType }) => name === 'tournamentImage' && resourceType === 'URL',
        )?.identifier;
        if (tournamentImageURL) {
          t.tournament.tournamentImageURL = tournamentImageURL;
        }
        return { ...t, provider };
      });
    renderTable(tableData);
  };
  const loginState = getLoginState();
  const provider = loginState?.provider || context?.provider;

  const noProvider = () => tmx2db.findAllTournaments().then(render, handleError);

  if (provider?.organisationAbbreviation) {
    const showResults = (result) => {
      if (result?.data?.calendar) {
        renderCalendarTable(result.data.calendar);
      } else {
        noProvider();
      }
    };
    getCalendar({ providerAbbr: provider.organisationAbbreviation }).then(showResults);
  } else {
    noProvider();
  }

  return { table };
}
