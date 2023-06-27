import { genderedText } from '../common/formatters/genderedText';
import { TabulatorFull as Tabulator } from 'tabulator-tables';

export function createSelectionTable({ anchorId, actionType, data = [], onSelected }) {
  const drawPositions = data.some((item) => item.drawPosition);
  const participants = data.some((item) => item.participant);

  // spread participant object
  if (participants) data = data.map(({ participant, ...rest }) => ({ ...rest, ...participant }));

  const columns = [
    {
      visible: drawPositions,
      field: 'drawPosition',
      title: 'Position',
      responsive: false,
      editor: false,
      minWidth: 70
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
