import { tournamentEngine, participantConstants, participantRoles } from 'tods-competition-factory';
import { participantResponsiveLayourFormatter } from './participantResponsiveLayoutFormatter';
import { mapParticipant } from 'Pages/Tournament/Tabs/participantTab/mapParticipant';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { arrayLengthFormatter } from '../common/formatters/arrayLength';
import { eventsFormatter } from '../common/formatters/eventsFormatter';
import { genderedText } from '../common/formatters/genderedText';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'Pages/Tournament/destroyTable';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { participantActions } from '../../popovers/participantActions';
import { toggleSignInStatus } from './toggleSignInStatus';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT, RIGHT, TOURNAMENT_PARTICIPANTS } from 'constants/tmxConstants';

const { OFFICIAL, COMPETITOR } = participantRoles;
const { INDIVIDUAL } = participantConstants;

export function createParticipantsTable({ view } = {}) {
  let table, participants, derivedEventInfo, ready;

  const participantFilters =
    view === OFFICIAL
      ? { participantRoles: [OFFICIAL] }
      : { participantTypes: [INDIVIDUAL], participantRoles: [COMPETITOR] };

  const getTableData = () => {
    const result = tournamentEngine.getParticipants({
      withSignInStatus: true,
      withScaleValues: true,
      participantFilters,
      withEvents: true
    });
    ({ participants, derivedEventInfo } = result);

    return participants?.map((p) => mapParticipant(p, derivedEventInfo)) || [];
  };

  const replaceTableData = () => {
    const refresh = () => table.replaceData(getTableData());
    setTimeout(refresh, ready ? 0 : 1000);
  };

  const columns = [
    {
      cellClick: (_, cell) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      responsive: false,
      hozAlign: LEFT,
      width: 5
    },
    {
      headerMenu: headerMenu({
        signedIn: 'Sign In Status',
        sex: 'Gender'
      }),
      formatter: 'rownum',
      headerSort: false,
      hozAlign: LEFT,
      width: 55
    },
    {
      formatter: 'responsiveCollapse',
      hozAlign: CENTER,
      responsive: false,
      headerSort: false,
      resizable: false,
      width: 50
    },
    {
      cellClick: participantActions,
      formatter: genderedText,
      field: 'participantName',
      responsive: false,
      resizable: false,
      minWidth: 200,
      widthGrow: 2,
      title: 'Name'
    },
    {
      headerFilter: 'input',
      title: 'First Name',
      field: 'firstName',
      visible: false,
      width: 150
    },
    {
      headerFilter: 'input',
      title: 'Last Name',
      field: 'lastName',
      visible: false,
      width: 150
    },
    {
      title: '<i class="fa-solid fa-venus-mars" />',
      field: 'sex',
      hozAlign: LEFT,
      editor: 'list',
      width: 80,
      editorParams: {
        itemFormatter: (_, value) => value,
        values: {
          Male: 'MALE',
          Female: 'FEMALE',
          '': 'Unknown'
        }
      }
    },
    { title: 'Country', field: 'ioc', width: 130, visible: false, headerFilter: 'input' },
    {
      title: `<div class='fa-solid fa-check' style='color: green' />`,
      cellClick: toggleSignInStatus,
      formatter: 'tickCross',
      resizable: false,
      field: 'signedIn',
      hozAlign: LEFT,
      tooltip: false,
      width: 40
    },
    {
      sorter: (a, b) => (a.length || 0) - (b?.length || 0),
      formatter: arrayLengthFormatter,
      title: 'Penalties',
      field: 'penalties',
      hozAlign: LEFT,
      width: 130,
      visible: false
    },
    {
      headerFilter: 'input',
      title: 'Club',
      field: 'club',
      hozAlign: LEFT,
      minWidth: 70,
      editor: false,
      visible: false
    },
    {
      sorter: (a, b) => a?.[0]?.eventName?.localeCompare(b?.[0]?.eventName),
      formatter: eventsFormatter(navigateToEvent),
      title: 'Events',
      field: 'events',
      hozAlign: LEFT,
      minWidth: 300,
      editor: false,
      widthGrow: 2
    },
    {
      title: 'City/State',
      field: 'cityState',
      minWidth: 110
    },
    {
      title: 'WTN',
      field: 'ratings.wtn.wtnRating',
      responsive: true,
      resizable: false,
      width: 70
    },
    {
      cellClick: participantActions,
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT
    }
  ];

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
      layout: 'fitColumns',
      index: 'participantId',
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

  return { table, replaceTableData };
}
