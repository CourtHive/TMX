import { genderedText } from '../common/formatters/genderedText';
import { TabulatorFull as Tabulator } from 'tabulator-tables';

export function createSelectionTable({ anchorId, actionType, data = [], onSelected }) {
  const drawPositions = data.some((item) => item.drawPosition);
  const participants = data.some((item) => item.participant);

  // spread participant object
  if (participants) {
    // default participantName to BYE for swaps
    data = data.map(({ participant, ...rest }) => ({ ...rest, participantName: 'BYE', ...participant }));
  }

  const columns = [
    {
      visible: drawPositions,
      field: 'drawPosition',
      title: 'Position',
      headerSort: false,
      responsive: false,
      editor: false,
      maxWidth: 100
    },
    {
      formatter: genderedText,
      field: 'participantName',
      title: 'Participant',
      responsive: false,
      minWidth: 200,
      widthGrow: 2
    }
  ];

  const element = document.getElementById(anchorId);
  const table = new Tabulator(element, {
    index: actionType.targetAttribute,
    placeholder: 'No participants',
    layout: 'fitColumns',
    reactiveData: true,
    maxHeight: 400,
    selectable: 1,
    columns,
    data
  });

  table.on('rowSelected', (row) => onSelected(row.getData()));
}
