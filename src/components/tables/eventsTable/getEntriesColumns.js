import { formatParticipant } from '../common/formatters/participantFormatter';
import { flightsFormatter } from '../common/formatters/flightsFormatter';
//import { genderedText } from '../common/formatters/genderedText';
import { numericEditor } from '../common/editors/numericEditor';
import { factoryConstants } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { entryActions } from '../../popovers/entryActions';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';
import { teamsFormatter } from '../common/formatters/teamsFormatter';

const { WTN, UTR } = factoryConstants.ratingConstants;

export function getEntriesColumns({ entries, exclude = [], eventId, drawId, actions = [], drawCreated } = {}) {
  const teams = entries.find((entry) => entry.participant?.teams?.length);
  const utrRating = entries.find((entry) => entry.ratings?.utr);
  const wtnRating = entries.find((entry) => entry.ratings?.wtn);
  const cityState = entries.find((entry) => entry.cityState);
  const seeding = entries.find((entry) => entry.seedNumber);
  const ranking = entries.find((entry) => entry.ranking);

  return [
    {
      cellClick: (_, cell) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      visible: !drawCreated,
      headerSort: false,
      responsive: false,
      hozAlign: LEFT,
      width: 5,
    },
    {
      headerMenu: headerMenu(),
      formatter: 'rownum',
      headerSort: false,
      hozAlign: LEFT,
      width: 55,
    },
    {
      formatter: 'responsiveCollapse',
      responsive: false,
      headerSort: false,
      hozAlign: CENTER,
      resizable: false,
      width: 50,
    },
    {
      // formatter: genderedText,
      /// field: 'participant.participantName',
      formatter: (cell) => formatParticipant()(cell, undefined, 'sideBySide'),
      field: 'participant',
      responsive: false,
      resizable: false,
      minWidth: 200,
      widthGrow: 1,
      title: 'Name',
    },
    {
      sorterParams: { alignEmptyValues: 'bottom' },
      visible: !!ranking,
      resizable: false,
      sorter: 'number',
      field: 'ranking',
      title: 'Rank',
      width: 70,
    },
    {
      sorterParams: { alignEmptyValues: 'bottom' },
      field: 'ratings.wtn.wtnRating',
      visible: !!wtnRating,
      resizable: false,
      sorter: 'number',
      title: WTN,
      width: 70,
    },
    {
      sorterParams: { alignEmptyValues: 'bottom' },
      field: 'ratings.utr.utrRating',
      visible: !!utrRating,
      resizable: false,
      sorter: 'number',
      title: UTR,
      width: 70,
    },
    {
      sorter: (a, b) => a?.[0]?.participantName?.localeCompare(b?.[0]?.participantName),
      formatter: teamsFormatter(() => console.log('boo')),
      field: 'participant.teams',
      visible: !!teams,
      title: 'Teams',
      responsive: false,
      resizable: false,
      minWidth: 100,
    },
    {
      visible: !!cityState,
      title: 'City/State',
      field: 'cityState',
      responsive: false,
      resizable: false,
      minWidth: 100,
    },
    {
      editor: numericEditor({ maxValue: entries?.length || 0, field: 'seedNumber' }),
      sorterParams: { alignEmptyValues: 'bottom' },
      visible: !!seeding,
      field: 'seedNumber',
      hozAlign: CENTER,
      resizable: false,
      sorter: 'number',
      editable: false,
      title: 'Seed',
      maxWidth: 70,
    },
    {
      formatter: flightsFormatter(navigateToEvent),
      title: 'Flights',
      responsive: true,
      field: 'flights',
      minWidth: 100,
      widthGrow: 1,
    },
    {
      responsive: false,
      resizable: false,
      title: 'Status',
      field: 'status',
      maxWidth: 80,
    },
    {
      cellClick: entryActions(actions, eventId, drawId),
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      maxWidth: 40,
    },
  ].filter(({ field }) => Array.isArray(exclude) && !exclude?.includes(field));
}
