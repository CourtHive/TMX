import { formatParticipant } from 'components/tables/common/formatters/participantFormatter';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { tournamentEngine } from 'tods-competition-factory';
import { destroyTable } from 'pages/tournament/destroyTable';

import { TOURNAMENT_REPORTS } from 'constants/tmxConstants';

type ReportColumn = {
  key: string;
  title: string;
  type?: string;
  width?: number;
};

// Row fields that carry IDs for CSV/JSON export but should not display in the table
const HIDDEN_FIELDS = ['participantId', 'eventId', 'drawId', 'structureId'];

export function createReportsTable({
  columns,
  rows,
}: {
  columns: ReportColumn[];
  rows: Record<string, any>[];
}): { table: any } {
  destroyTable({ anchorId: TOURNAMENT_REPORTS });

  // If rows contain participantId, resolve full participant objects for renderParticipant
  const hasParticipantId = rows.length > 0 && 'participantId' in rows[0];
  if (hasParticipantId) {
    const result: any = tournamentEngine.getParticipants({});
    const pMap: Record<string, any> = {};
    for (const p of result?.participants ?? []) {
      pMap[p.participantId] = p;
    }
    for (const row of rows) {
      if (row.participantId && pMap[row.participantId]) {
        row.participant = pMap[row.participantId];
      }
    }
  }

  const tabulatorColumns = columns
    .filter((col) => !HIDDEN_FIELDS.includes(col.key))
    .map((col) => {
      if (col.key === 'participantName' && hasParticipantId) {
        return {
          title: col.title,
          field: col.key,
          formatter: formatParticipant(undefined),
          headerSort: true,
          minWidth: 180,
        };
      }
      const isNumber = col.type === 'number';
      return {
        title: col.title,
        field: col.key,
        headerSort: true,
        hozAlign: isNumber ? ('center' as const) : undefined,
        headerHozAlign: isNumber ? ('center' as const) : undefined,
        width: isNumber ? 125 : col.width || undefined,
      };
    });

  const tableEl = document.getElementById(TOURNAMENT_REPORTS);
  if (!tableEl) return { table: undefined };

  const table = new Tabulator(tableEl, {
    placeholder: 'No data',
    layout: 'fitColumns',
    columns: tabulatorColumns,
    data: rows,
    maxHeight: 'calc(100vh - 200px)',
  });

  return { table };
}
