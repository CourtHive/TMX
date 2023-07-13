import { flightsFormatter } from '../common/formatters/flightsFormatter';
import { genderedText } from '../common/formatters/genderedText';
import { numericEditor } from '../common/editors/numericEditor';
import { factoryConstants } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { entryActions } from '../../popovers/entryActions';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';

const { WTN, UTR } = factoryConstants.ratingConstants;

export function getEntriesColumns({ entries, exclude = [], eventId, drawId, actions = [] } = {}) {
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
      headerMenu: headerMenu(),
      formatter: 'rownum',
      headerSort: false,
      hozAlign: LEFT,
      width: 55
    },
    {
      formatter: 'responsiveCollapse',
      responsive: false,
      headerSort: false,
      hozAlign: CENTER,
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
      sorterParams: { alignEmptyValues: 'bottom' },
      resizable: false,
      sorter: 'number',
      field: 'ranking',
      title: 'Rank',
      width: 70
    },
    {
      sorterParams: { alignEmptyValues: 'bottom' },
      field: 'ratings.wtn.wtnRating',
      resizable: false,
      sorter: 'number',
      title: WTN,
      width: 70
    },
    {
      sorterParams: { alignEmptyValues: 'bottom' },
      field: 'ratings.wtn.wtnRating',
      resizable: false,
      sorter: 'number',
      visible: false,
      title: UTR,
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
      sorterParams: { alignEmptyValues: 'bottom' },
      editor: numericEditor({ maxValue: entries?.length || 0, field: 'seedNumber' }),
      field: 'seedNumber',
      hozAlign: CENTER,
      resizable: false,
      sorter: 'number',
      editable: false,
      title: 'Seed',
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
