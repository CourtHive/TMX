import { tournamentEngine, participantConstants, participantRoles } from 'tods-competition-factory';
import { participantResponsiveLayourFormatter } from './participantResponsiveLayoutFormatter';
import { mapParticipant } from 'pages/Tournament/Tabs/participantTab/mapParticipant';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { getParticipantColumns } from './getParticipantColumns';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'pages/Tournament/destroyTable';
import { findAncestor } from 'services/dom/parentAndChild';

import { TOURNAMENT_PARTICIPANTS } from 'constants/tmxConstants';

const { INDIVIDUAL, GROUP, TEAM } = participantConstants;
const { OFFICIAL, COMPETITOR } = participantRoles;

export function createParticipantsTable({ view } = {}) {
  let table, participants, derivedEventInfo, ready, teamParticipants, groupParticipants;

  const participantFilters = { participantRoles: [view === OFFICIAL ? OFFICIAL : COMPETITOR] };

  const getTableData = () => {
    const result = tournamentEngine.getParticipants({
      withSignInStatus: true,
      withScaleValues: true,
      participantFilters,
      withEvents: true,
      withISO2: true
    });
    ({ participants, derivedEventInfo } = result);

    const individualParticipants = participants.filter(({ participantType }) => participantType === INDIVIDUAL);
    groupParticipants = participants.filter(({ participantType }) => participantType === GROUP);
    teamParticipants = participants.filter(({ participantType }) => participantType === TEAM);

    return individualParticipants?.map((p) => mapParticipant(p, derivedEventInfo)) || [];
  };

  const replaceTableData = () => {
    const refresh = () => table.replaceData(getTableData());
    setTimeout(refresh, ready ? 0 : 1000);
  };

  const data = getTableData();
  const columns = getParticipantColumns(data);

  const render = (data) => {
    destroyTable({ anchorId: TOURNAMENT_PARTICIPANTS });
    const element = document.getElementById(TOURNAMENT_PARTICIPANTS);
    const headerElement = findAncestor(element, 'section')?.querySelector('.tabHeader');

    table = new Tabulator(element, {
      headerSortElement: headerSortElement([
        'sex',
        'signedIn',
        'events',
        'teams',
        'cityState',
        'ratings.wtn.wtnRating',
        'ratings.utr.utrRating'
      ]),
      responsiveLayoutCollapseFormatter: participantResponsiveLayourFormatter,
      responsiveLayoutCollapseStartOpen: false,
      height: window.innerHeight * 0.86,
      placeholder: 'No participants',
      responsiveLayout: 'collapse',
      index: 'participantId',
      layout: 'fitColumns',
      reactiveData: true,
      columns,
      data
    });

    table.on('dataChanged', (rows) => {
      headerElement && (headerElement.innerHTML = `Participants (${rows.length})`);
    });
    table.on('dataFiltered', (filters, rows) => {
      headerElement && (headerElement.innerHTML = `Participants (${rows.length})`);
    });
    table.on('scrollVertical', destroyTipster);
    table.on('tableBuilt', () => (ready = true));
  };

  render(data);

  return { table, replaceTableData, teamParticipants, groupParticipants };
}
