import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { getSelectionColumns } from './getSelectionColumns';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

export function createSelectionTable({
  selectedParticipantIds, // already selected
  selectionLimit = 1,
  targetAttribute,
  placeholder,
  onSelected,
  data = [],
  anchorId
}) {
  const participants = data.some((item) => item.participant);

  // spread participant object
  if (participants) {
    // default participantName to BYE for swaps
    data = data.map(({ participant, ...rest }) => ({ ...rest, participantName: 'BYE', ...participant }));
  }
  data.forEach((row) => (row.searchText = row.participantName?.toLowerCase()));

  const columns = getSelectionColumns(data);
  const element = document.getElementById(anchorId);

  const table = new Tabulator(element, {
    placeholder: placeholder || 'No options',
    index: targetAttribute,
    selectable: selectionLimit,
    layout: 'fitColumns',
    reactiveData: true,
    maxHeight: 350,
    columns,
    data
  });
  if (!context.tables) context.tables = {};
  context.tables.selectionTable = table;

  table.on('tableBuilt', () => {
    if (selectedParticipantIds?.length) table.selectRow(selectedParticipantIds);
  });

  table.on('rowSelectionChanged', (data, rows) => {
    const values = rows?.map((row) => row.getData());
    isFunction(onSelected) && onSelected(values);
  });

  return { table };
}
