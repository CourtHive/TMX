import { genderedText } from '../common/formatters/genderedText';
import { threeDots } from '../common/formatters/threeDots';
import { headerMenu } from '../common/headerMenu';
import { entryActions } from '../../popovers/entryActions';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';
import { flightsFormatter } from '../common/formatters/flightsFormatter';
import { navigateToEvent } from '../common/navigateToEvent';

export function getColumns({ exclude = [], eventId, drawId, actions = [] } = {}) {
  return [
    {
      cellClick: (_, cell) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      hozAlign: LEFT,
      width: 5
    },
    {
      formatter: 'rownum',
      headerSort: false,
      hozAlign: LEFT,
      width: 55,
      headerMenu
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
      formatter: genderedText,
      field: 'participant.participantName',
      responsive: false,
      resizable: false,
      minWidth: 200,
      widthGrow: 1,
      title: 'Name'
    },
    {
      title: 'Rank',
      field: 'ranking',
      resizable: false,
      width: 70
    },
    {
      title: 'WTN',
      field: 'ratings.wtn.wtnRating',
      resizable: false,
      width: 70
    },
    {
      title: 'City/State',
      field: 'cityState',
      responsive: false,
      resizable: false,
      minWidth: 100
    },
    {
      title: 'Seed',
      field: 'seedNumber',
      resizable: false,
      editor: true,
      maxWidth: 70
    },
    {
      formatter: flightsFormatter(navigateToEvent),
      title: 'Flights',
      responsive: true,
      field: 'flights',
      minWidth: 100,
      widthGrow: 1
    },
    {
      responsive: false,
      resizable: false,
      title: 'Status',
      field: 'status',
      maxWidth: 80
    },
    {
      cellClick: entryActions(actions, eventId, drawId),
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      maxWidth: 40
    }
  ].filter(({ field }) => Array.isArray(exclude) && !exclude?.includes(field));
}
