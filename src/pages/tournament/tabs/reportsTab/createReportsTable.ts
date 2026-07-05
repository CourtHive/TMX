import { formatParticipant } from 'components/tables/common/formatters/participantFormatter';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'pages/tournament/destroyTable';
import { tournamentEngine } from 'services/factory/engine';

import { TOURNAMENT_REPORTS } from 'constants/tmxConstants';

type ReportColumn = {
  key: string;
  title: string;
  type?: string;
  width?: number;
  headerWordWrap?: boolean;
  fitData?: boolean;
};

// Approximate a content-fit column width (px) from the longest of the header
// title and the column's values. Header needs extra room for the sort arrow;
// clamped so a single long value can't blow the layout out.
function estimateColumnWidth(title: string, field: string, rows: Record<string, any>[]): number {
  const CHAR = 7.6;
  const CELL_PADDING = 26;
  const SORT_ARROW = 20;
  const MIN = 56;
  const MAX = 320;
  let dataChars = 0;
  for (const row of rows) {
    const value = row[field];
    if (value == null) continue;
    const len = String(value).length;
    if (len > dataChars) dataChars = len;
  }
  const headerNeed = Math.ceil(title.length * CHAR) + CELL_PADDING + SORT_ARROW;
  const dataNeed = Math.ceil(dataChars * CHAR) + CELL_PADDING;
  return Math.min(MAX, Math.max(MIN, headerNeed, dataNeed));
}

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

  const numberCellFormatter = (cell: any) => {
    const value = cell.getValue();
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'N/A';
  };

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
      // Content-fit columns get a measured width and are pinned (widthGrow: 0)
      // so they never stretch — spare table width flows to the flexible columns
      // (e.g. the wide "MatchUp" column) instead.
      if (col.fitData) {
        return {
          title: col.title,
          field: col.key,
          headerSort: true,
          formatter: isNumber ? numberCellFormatter : undefined,
          hozAlign: isNumber ? ('center' as const) : undefined,
          headerHozAlign: isNumber ? ('center' as const) : undefined,
          headerWordWrap: col.headerWordWrap || undefined,
          // An explicit width overrides the measured estimate (still pinned).
          width: col.width || estimateColumnWidth(col.title, col.key, rows),
          widthGrow: 0,
        };
      }
      return {
        title: col.title,
        field: col.key,
        headerSort: true,
        formatter: isNumber ? numberCellFormatter : undefined,
        hozAlign: isNumber ? ('center' as const) : undefined,
        headerHozAlign: isNumber ? ('center' as const) : undefined,
        // Numeric columns default to 125px but honor an explicit per-report
        // width (e.g. a longer header like "Variance (min)"); text columns
        // stay flexible unless the report pins a width.
        width: isNumber ? col.width || 125 : col.width || undefined,
        // Opt-in per column only — global header wrap misaligns other reports.
        headerWordWrap: col.headerWordWrap || undefined,
      };
    });

  const tableEl = document.getElementById(TOURNAMENT_REPORTS);
  if (!tableEl) return { table: undefined };

  // Rows that carry the draw-location IDs (e.g. Call Timing Variance) navigate to
  // the matchUp in its draw on click — mirroring the matchUps-table event column.
  const navigable = (data: any) => !!(data?.eventId && data?.drawId);

  const table = new Tabulator(tableEl, {
    placeholder: 'No data',
    layout: 'fitColumns',
    columns: tabulatorColumns,
    data: rows,
    maxHeight: 'calc(100vh - 200px)',
    rowFormatter: (row: any) => {
      if (navigable(row.getData())) row.getElement().style.cursor = 'pointer';
    },
  });

  table.on('rowClick', (_e: any, row: any) => {
    const data = row.getData();
    if (!navigable(data)) return;
    navigateToEvent({
      eventId: data.eventId,
      drawId: data.drawId,
      structureId: data.structureId,
      matchUpId: data.matchUpId,
      renderDraw: true,
    });
  });

  return { table };
}
