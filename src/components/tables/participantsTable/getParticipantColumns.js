import { genderConstants, factoryConstants } from 'tods-competition-factory';
import { arrayLengthFormatter } from '../common/formatters/arrayLength';
import { participantActions } from '../../popovers/participantActions';
import { eventsFormatter } from '../common/formatters/eventsFormatter';
import { teamsFormatter } from '../common/formatters/teamsFormatter';
import { genderedText } from '../common/formatters/genderedText';
import { numericEditor } from '../common/editors/numericEditor';
import { columnIsVisible } from '../common/columnIsVisible';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { toggleSignInStatus } from './toggleSignInStatus';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';

const { WTN, UTR } = factoryConstants.ratingConstants;
const { FEMALE, MALE } = genderConstants;

const FIELD_UTR = 'ratings.utr.utrRating';
const FIELD_WTN = 'ratings.wtn.wtnRating';

export function getParticipantColumns() {
  return [
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
          Male: MALE,
          Female: FEMALE,
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
      visible: false,
      width: 130
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
      formatter: eventsFormatter(navigateToEvent),
      visible: columnIsVisible('events'),
      sorter: (a, b) => a && b,
      title: 'Events',
      field: 'events',
      hozAlign: LEFT,
      minWidth: 200,
      editor: false,
      widthGrow: 2
    },
    {
      formatter: teamsFormatter(() => console.log('boo')),
      visible: columnIsVisible('teams'),
      sorter: (a, b) => a && b,
      title: 'Teams',
      field: 'teams',
      hozAlign: LEFT,
      minWidth: 200,
      editor: false,
      widthGrow: 2
    },
    {
      title: 'City/State',
      field: 'cityState',
      minWidth: 110
    },
    {
      editor: numericEditor({ maxValue: 40, decimals: true, field: FIELD_WTN }),
      sorterParams: { alignEmptyValues: 'bottom' },
      visible: columnIsVisible(FIELD_WTN),
      field: FIELD_WTN,
      responsive: true,
      resizable: false,
      editable: false,
      sorter: 'number',
      title: WTN,
      width: 70
    },
    {
      editor: numericEditor({ maxValue: 16, decimals: true, field: FIELD_UTR }),
      sorterParams: { alignEmptyValues: 'bottom' },
      visible: columnIsVisible(FIELD_UTR),
      field: FIELD_UTR,
      responsive: true,
      resizable: false,
      editable: false,
      sorter: 'number',
      title: UTR,
      width: 70
    },
    {
      cellClick: participantActions,
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      maxWidth: 40
    }
  ];
}
