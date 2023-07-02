import { tournamentEngine, participantConstants, participantRoles } from 'tods-competition-factory';
import { participantResponsiveLayourFormatter } from './participantResponsiveLayoutFormatter';
import { mapParticipant } from 'Pages/Tournament/Tabs/participantTab/mapParticipant';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { getParticipantColumns } from './getParticipantColumns';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'Pages/Tournament/destroyTable';

import { TOURNAMENT_PARTICIPANTS } from 'constants/tmxConstants';

const { OFFICIAL, COMPETITOR } = participantRoles;
const { INDIVIDUAL, TEAM } = participantConstants;

export function createParticipantsTable({ view } = {}) {
  let table, participants, derivedEventInfo, ready, teamParticipants;

  const participantFilters = { participantRoles: [view === OFFICIAL ? OFFICIAL : COMPETITOR] };

  const getTableData = () => {
    const result = tournamentEngine.getParticipants({
      withSignInStatus: true,
      withScaleValues: true,
      participantFilters,
      withEvents: true
    });
    ({ participants, derivedEventInfo } = result);

    const individualParticipants = participants.filter(({ participantType }) => participantType === INDIVIDUAL);
    teamParticipants = participants.filter(({ participantType }) => participantType === TEAM);

    return individualParticipants?.map((p) => mapParticipant(p, derivedEventInfo)) || [];
  };

  const replaceTableData = () => {
    const refresh = () => table.replaceData(getTableData());
    setTimeout(refresh, ready ? 0 : 1000);
  };

  const columns = getParticipantColumns();

  const render = (data) => {
    destroyTable({ anchorId: TOURNAMENT_PARTICIPANTS });
    const element = document.getElementById(TOURNAMENT_PARTICIPANTS);

    table = new Tabulator(element, {
      headerSortElement: headerSortElement(['sex', 'signedIn', 'events', 'cityState', 'ratings.wtn.wtnRating']),
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
      /*
      // NOTE: persistence causes removeFilter warnings in console
      persistence: { filter: true, sort: true },
      persistenceID: 'trnyPtcpt',
      */
    });

    table.on('scrollVertical', destroyTipster);
    table.on('tableBuilt', () => (ready = true));
  };

  render(getTableData());

  return { table, replaceTableData, teamParticipants };
}
