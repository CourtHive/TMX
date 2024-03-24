import { formatParticipant } from '../common/formatters/participantFormatter';
import { genderConstants, factoryConstants } from 'tods-competition-factory';
import { arrayLengthFormatter } from '../common/formatters/arrayLength';
import { participantSorter } from '../common/sorters/participantSorter';
import { participantActions } from '../../popovers/participantActions';
import { eventsFormatter } from '../common/formatters/eventsFormatter';
import { teamsFormatter } from '../common/formatters/teamsFormatter';
import { numericEditor } from '../common/editors/numericEditor';
import { columnIsVisible } from '../common/columnIsVisible';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { toggleSignInStatus } from './toggleSignInStatus';
import { idEditor } from '../common/editors/idEditor';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';

const { WTN, UTR } = factoryConstants.ratingConstants;
const { FEMALE, MALE } = genderConstants;

const FIELD_UTR = 'ratings.utr.utrRating';
const FIELD_WTN = 'ratings.wtn.wtnRating';

export function getParticipantColumns({ data, replaceTableData }) {
  const cityState = data.some((p) => p.cityState);
  const tennisId = data.some((p) => p.tennisId);
  const utr = data.some((p) => p.ratings?.utr);
  const wtn = data.some((p) => p.ratings?.wtn);

  return [
    {
      cellClick: (_, cell) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      responsive: false,
      hozAlign: LEFT,
      width: 5,
    },
    {
      headerMenu: headerMenu({
        signedIn: 'Sign In Status',
        sex: 'Gender',
      }),
      formatter: 'rownum',
      headerSort: false,
      hozAlign: LEFT,
      width: 55,
    },
    {
      formatter: 'responsiveCollapse',
      responsive: false,
      headerSort: false,
      resizable: false,
      hozAlign: CENTER,
      width: 50,
    },
    {
      formatter: formatParticipant(({ event, cell, ...params }) => participantActions(event, cell, undefined, params)),
      cellClick: participantActions,
      sorter: participantSorter,
      field: 'participant',
      responsive: false,
      resizable: false,
      minWidth: 200,
      widthGrow: 2,
      title: 'Name',
    },
    {
      editor: idEditor({ field: 'tennisId' }),
      visible: tennisId,
      field: 'tennisId',
      editable: false, // TODO: toggle edit state based on permissions
      title: 'WTID',
      width: 120,
    },
    {
      headerFilter: 'input',
      title: 'First Name',
      field: 'firstName',
      visible: false,
      width: 150,
    },
    {
      headerFilter: 'input',
      title: 'Last Name',
      field: 'lastName',
      visible: false,
      width: 150,
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
          Male: MALE,
          Female: FEMALE,
          '': 'Unknown',
        },
      },
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
      width: 40,
    },
    {
      sorter: (a, b) => (a.length || 0) - (b?.length || 0),
      formatter: arrayLengthFormatter,
      title: 'Penalties',
      field: 'penalties',
      hozAlign: LEFT,
      visible: false,
      width: 130,
    },
    {
      headerFilter: 'input',
      title: 'Club',
      field: 'club',
      hozAlign: LEFT,
      minWidth: 70,
      editor: false,
      visible: false,
    },
    {
      sorter: (a, b) => a?.[0]?.eventName?.localeCompare(b?.[0]?.eventName),
      formatter: eventsFormatter(navigateToEvent),
      visible: columnIsVisible('events'),
      title: 'Events',
      field: 'events',
      hozAlign: LEFT,
      minWidth: 200,
      editor: false,
      widthGrow: 2,
    },
    {
      sorter: (a, b) => a?.[0]?.participantName?.localeCompare(b?.[0]?.participantName),
      formatter: teamsFormatter(() => console.log('boo')),
      visible: columnIsVisible('teams'),
      title: 'Teams',
      field: 'teams',
      hozAlign: LEFT,
      minWidth: 200,
      editor: false,
      widthGrow: 2,
    },
    {
      // headerFilter: 'input',
      visible: !!cityState,
      title: 'City/State',
      field: 'cityState',
      minWidth: 110,
    },
    {
      editor: numericEditor({ maxValue: 40, decimals: true, field: FIELD_WTN }),
      sorterParams: { alignEmptyValues: 'bottom' },
      responsive: true,
      resizable: false,
      sorter: 'number',
      field: FIELD_WTN,
      editable: false,
      visible: !!wtn,
      title: WTN,
      width: 70,
    },
    {
      editor: numericEditor({ maxValue: 16, decimals: true, field: FIELD_UTR }),
      sorterParams: { alignEmptyValues: 'bottom' },
      responsive: true,
      resizable: false,
      sorter: 'number',
      field: FIELD_UTR,
      editable: false,
      visible: !!utr,
      title: UTR,
      width: 70,
    },
    {
      cellClick: participantActions(replaceTableData),
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      maxWidth: 40,
    },
  ];
}
