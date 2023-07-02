import { genderedText } from '../common/formatters/genderedText';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

export function createSelectionTable({
  selectedParticipantIds, // already selected
  selectionLimit = 1,
  actionType,
  onSelected,
  data = [],
  anchorId
}) {
  const drawPositions = data.some((item) => item.drawPosition);
  const participants = data.some((item) => item.participant);

  // spread participant object
  if (participants) {
    // default participantName to BYE for swaps
    data = data.map(({ participant, ...rest }) => ({ ...rest, participantName: 'BYE', ...participant }));
  }

  data.forEach((row) => (row.searchText = row.participantName.toLowerCase()));

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
    selectable: selectionLimit,
    layout: 'fitColumns',
    reactiveData: true,
    maxHeight: 350,
    columns,
    data
  });
  context.tables['selectionTable'] = table;

  table.on('tableBuilt', () => {
    if (selectedParticipantIds?.length) table.selectRow(selectedParticipantIds);
  });

  table.on('rowSelectionChanged', (data, rows) => {
    const values = rows?.map((row) => row.getData());
    isFunction(onSelected) && onSelected(values);
  });

  return { table };
}
