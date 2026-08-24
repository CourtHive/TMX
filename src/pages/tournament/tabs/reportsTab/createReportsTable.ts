import { collectReportParticipantIds, PARTICIPANT_ID_KEYS, resolveReportParticipantId } from './reportParticipants';
import { formatParticipant } from 'components/tables/common/formatters/participantFormatter';
import { participantProfileModal } from 'components/modals/participantProfileModal';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { formatSideParticipant } from './sideParticipantFormatter';
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
const HIDDEN_FIELDS = [
  'participantId',
  'side1ParticipantId',
  'side2ParticipantId',
  'winningParticipantId',
  'eventId',
  'drawId',
  'structureId',
];

// Side columns whose plain name string is upgraded to a clickable participant
// when the report carries the matching id.
const SIDE_COLUMNS: Record<string, string> = { side1: 'side1Participant', side2: 'side2Participant' };

export function createReportsTable({ columns, rows }: { columns: ReportColumn[]; rows: Record<string, any>[] }): {
  table: any;
} {
  destroyTable({ anchorId: TOURNAMENT_REPORTS });

  // If rows contain participantId, resolve full participant objects for renderParticipant.
  // `withIndividualParticipants` is what makes a PAIR row render its two members
  // as separately clickable names instead of one unclickable pair name.
  //
  // It is REQUIRED by the `sideBySide` layout below, not merely complementary:
  // `renderPairParticipant` iterates `individualParticipants`, so without the
  // hydration a PAIR cell renders EMPTY rather than falling back to the pair
  // name. Measured — journey 107's doubles case finds 0 rendered names when this
  // flag is dropped. Change the two together or not at all.
  const firstRow = rows[0] ?? {};
  const presentIdKeys = PARTICIPANT_ID_KEYS.filter(({ idKey }) => idKey in firstRow);
  const hasParticipantId = presentIdKeys.some(({ idKey }) => idKey === 'participantId');
  if (presentIdKeys.length) {
    const result: any = tournamentEngine.getParticipants({ withIndividualParticipants: true });
    const pMap: Record<string, any> = {};
    for (const p of result?.participants ?? []) {
      pMap[p.participantId] = p;
    }
    for (const row of rows) {
      for (const { idKey, hydratedKey } of presentIdKeys) {
        const participant = pMap[row[idKey]];
        if (participant) row[hydratedKey] = participant;
      }
    }
  }

  // Prev/next inside the card walks the whole table, not just the clicked row.
  const participantIds = collectReportParticipantIds(rows);

  // `renderIndividual` already calls `pointerEvent.stopPropagation()` before it
  // invokes this (courthive-components `renderIndividual.ts:90`), so a click on a
  // name in a draw-navigable report opens the card WITHOUT also firing the
  // `rowClick` handler below. Do not add a second stopPropagation here — verify
  // that one is still there instead.
  const onParticipantClick = (params: any) => {
    const participantId = resolveReportParticipantId(params);
    if (!participantId) return;
    participantProfileModal({ participantId, participantIds });
  };

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
          // `sideBySide` renders a PAIR as its two individuals, each with its own
          // click target, so a doubles row resolves unambiguously. Reached by
          // Seeding Performance, whose rows are PAIRs for a doubles event.
          //
          // It must be passed as the formatter's third argument explicitly:
          // Tabulator's own third argument is `onRendered`, not a layout, which is
          // why `formatParticipant(...)` handed straight to `formatter` can never
          // take this branch. Requires the hydration above.
          formatter: (cell: any) => (formatParticipant(onParticipantClick) as any)(cell, undefined, 'sideBySide'),
          headerSort: true,
          minWidth: 180,
        };
      }
      const sideKey = SIDE_COLUMNS[col.key];
      if (sideKey && sideKey in firstRow) {
        return {
          title: col.title,
          field: col.key,
          formatter: formatSideParticipant(onParticipantClick, sideKey),
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
    // 100% of the flex-sized host rather than a guess at the chrome above it —
    // `calc(100vh - 200px)` subtracted 200px for ~112px of nav and control bar.
    // Still a cap, not a height: a short report stays short.
    maxHeight: '100%',
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
