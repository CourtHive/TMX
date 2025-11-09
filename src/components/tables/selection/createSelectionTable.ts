import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { getSelectionColumns } from './getSelectionColumns';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

type CreateSelectionTableParams = {
  data?: any[];
  selectedParticipantIds?: string[];
  selectionLimit?: number;
  targetAttribute?: string;
  placeholder?: string;
  onSelected?: (values: any[]) => void;
  anchorId: string;
};

export function createSelectionTable(params: CreateSelectionTableParams): { table: any } {
  let { data = [] } = params;
  const {
    selectedParticipantIds,
    selectionLimit = 1,
    targetAttribute,
    placeholder,
    onSelected,
    anchorId,
  } = params;

  const participants = data.some((item) => item.participant);

  if (participants) {
    data = data.map(({ participant, ...rest }) => ({ ...rest, participantName: 'BYE', ...participant }));
  }
  data.forEach((row) => (row.searchText = row.participantName?.toLowerCase()));

  const columns = getSelectionColumns(data);
  const element = document.getElementById(anchorId);

  const table = new Tabulator(element, {
    placeholder: placeholder || 'No options',
    selectableRows: selectionLimit,
    index: targetAttribute,
    layout: 'fitColumns',
    reactiveData: true,
    maxHeight: 350,
    columns,
    data,
  });
  if (!context.tables) context.tables = [];
  if (!context.tables.selectionTable) {
    context.tables = { ...context.tables, selectionTable: table };
  }

  table.on('tableBuilt', () => {
    if (selectedParticipantIds?.length) table.selectRow(selectedParticipantIds);
  });

  table.on('rowSelectionChanged', (_data: any, rows: any) => {
    const values = rows?.map((row: any) => row.getData());
    isFunction(onSelected) && onSelected?.(values);
  });

  return { table };
}
