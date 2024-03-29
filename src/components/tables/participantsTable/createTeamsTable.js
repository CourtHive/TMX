import { participantResponsiveLayourFormatter } from './participantResponsiveLayoutFormatter';
import { mapTeamParticipant } from 'pages/tournament/tabs/participantTab/mapTeamParticipant';
import { tournamentEngine, participantConstants } from 'tods-competition-factory';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'pages/tournament/destroyTable';
import { findAncestor } from 'services/dom/parentAndChild';
import { teamRowFormatter } from './teamRowFormatter';
import { getGroupingsColumns } from './getGroupingsColumns';

import { TOURNAMENT_TEAMS } from 'constants/tmxConstants';

const { TEAM } = participantConstants;

export function createTeamsTable({ view } = {}) {
  let table, participants, derivedEventInfo, ready;

  const getTableData = () => {
    const result = tournamentEngine.getParticipants({
      participantFilters: { participantTypes: [view || TEAM] },
      withIndividualParticipants: true,
      withScaleValues: true,
      withEvents: true,
      withISO2: true,
    });
    ({ participants, derivedEventInfo } = result);

    return participants.map((p) => mapTeamParticipant(p, derivedEventInfo));
  };

  const replaceTableData = () => {
    const refresh = () => table.replaceData(getTableData());
    setTimeout(refresh, ready ? 0 : 1000);
  };

  const columns = getGroupingsColumns({ view });

  const render = (data) => {
    destroyTable({ anchorId: TOURNAMENT_TEAMS });
    const element = document.getElementById(TOURNAMENT_TEAMS);
    const headerElement = findAncestor(element, 'section')?.querySelector('.tabHeader');

    table = new Tabulator(element, {
      headerSortElement: headerSortElement(['events', 'membersCount', 'matchUpsCount', 'winLoss']),
      responsiveLayoutCollapseFormatter: participantResponsiveLayourFormatter,
      responsiveLayoutCollapseStartOpen: false,
      minHeight: window.innerHeight * 0.81,
      height: window.innerHeight * 0.86,
      placeholder: 'No team participants',
      rowFormatter: teamRowFormatter,
      responsiveLayout: 'collapse',
      index: 'participantId',
      layout: 'fitColumns',
      reactiveData: true,
      data,
      /*
      // NOTE: persistence causes filter cleanup warnings in console
      persistence: { filter: true, sort: true },
      persistenceID: 'trnyPtcpt',
      */
      columns,
    });

    table.on('dataChanged', (rows) => {
      const type = view === TEAM ? 'Teams' : 'Groups';
      headerElement && (headerElement.innerHTML = `${type} (${rows.length})`);
    });
    table.on('dataFiltered', (filters, rows) => {
      const type = view === TEAM ? 'Teams' : 'Groups';
      headerElement && (headerElement.innerHTML = `${type} (${rows.length})`);
    });
    table.on('scrollVertical', destroyTipster);
    table.on('tableBuilt', () => (ready = true));
  };

  render(getTableData());

  return { table, replaceTableData };
}
