import { highlightWinningSide } from 'components/tables/matchUpsTable/highlightWinningSide';
import { scoreFormatter } from 'components/tables/common/formatters/scoreFormatter';
import { participantActions } from 'components/popovers/participantMatchUpActions';
import { mapMatchUp } from 'Pages/Tournament/Tabs/matchUpsTab/mapMatchUp';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { TabulatorFull as Tabulator } from 'tabulator-tables';

export function createCollectionTable({ matchUp, tableElement, collectionMatchUps }) {
  const data = collectionMatchUps.map(mapMatchUp);

  const scoreHandler = (e, cell) => {
    const data = cell.getRow().getData();
    const { matchUpId, readyToScore } = data;
    const callback = (result) => {
      console.log({ result }, 'update tie score & row score');
    };
    if (readyToScore) enterMatchUpScore({ matchUpId, callback });
  };

  const participantHandler = (cell) => {
    const value = cell.getValue();
    if (value.participantName) return highlightWinningSide(cell);
    const elem = document.createElement('div');
    elem.className = 'has-text-warning-dark';
    elem.innerHTML = 'Select participant';
    return elem;
  };

  const side1Participant =
    matchUp.sides?.find((side) => side.sideNumber === 1)?.participant?.participantName || 'Side 1';
  const side2Participant =
    matchUp.sides?.find((side) => side.sideNumber === 2)?.participant?.participantName || 'Side 2';

  const columns = [
    {
      formatter: participantHandler,
      cellClick: participantActions,
      title: side1Participant,
      responsive: false,
      minWidth: 100,
      field: 'side1',
      widthGrow: 2
    },
    {
      formatter: participantHandler,
      cellClick: participantActions,
      title: side2Participant,
      responsive: false,
      minWidth: 100,
      field: 'side2',
      widthGrow: 2
    },
    {
      cellClick: scoreHandler,
      formatter: scoreFormatter,
      responsive: false,
      title: 'Score',
      field: 'score',
      width: 140
    },
    {
      field: 'matchUpStatus',
      title: 'Status',
      width: 150
    }
  ];

  const table = new Tabulator(tableElement, {
    responsiveLayoutCollapseStartOpen: false,
    responsiveLayout: 'collapse',
    placeholder: 'No matches',
    reactiveData: true,
    layout: 'fitColumns',
    index: 'matchUpId',
    columns,
    data
  });

  return { table };
}
