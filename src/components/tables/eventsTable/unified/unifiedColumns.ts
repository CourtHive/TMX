/**
 * Column definitions for the unified entries table.
 * Superset of existing entry columns plus segment chip and hidden sort rank.
 */
import { participantProfileModal } from 'components/modals/participantProfileModal';
import { formatParticipant } from '../../common/formatters/participantFormatter';
import { flightsFormatter } from '../../common/formatters/flightsFormatter';
import { teamsFormatter } from '../../common/formatters/teamsFormatter';
import { createGroupedSorter, SEGMENT_LABELS } from './segmentSorter';
import { numericEditor } from '../../common/editors/numericEditor';
import { getRatingColumns } from '../../common/getRatingColumns';
import { cellBorder } from '../../common/formatters/cellBorder';
import { navigateToEvent } from '../../common/navigateToEvent';
import { tournamentEngine } from 'tods-competition-factory';
import { threeDots } from '../../common/formatters/threeDots';
import { isSeedingEnabled } from '../seeding/seedingState';
import type { SortState } from './segmentSorter';
import { context } from 'services/context';
import { t } from 'i18n';

// Constants
import { CENTER, LEFT, RIGHT, PARTICIPANTS, entryStatusMapping } from 'constants/tmxConstants';

const SEGMENT_COLORS: Record<number, { bg: string; text: string }> = {
  0: { bg: 'var(--chc-success, hsl(141, 53%, 53%))', text: '#fff' },
  1: { bg: 'var(--chc-info, hsl(217, 71%, 53%))', text: '#fff' },
  2: { bg: 'var(--chc-warning, hsl(44, 100%, 77%))', text: 'rgba(0,0,0,.7)' },
  3: { bg: 'var(--chc-light, hsl(0, 0%, 96%))', text: 'rgba(0,0,0,.7)' },
  4: { bg: 'var(--chc-danger, hsl(348, 86%, 61%))', text: '#fff' },
};

function segmentFormatter(cell: any) {
  const rank = cell.getRow().getData()._segmentRank;
  const label = SEGMENT_LABELS[rank] ?? '?';
  const colors = SEGMENT_COLORS[rank] ?? SEGMENT_COLORS[4];
  const el = document.createElement('span');
  el.className = 'tag';
  el.style.cssText = `background:${colors.bg};color:${colors.text};font-size:0.7rem;padding:2px 6px;border-radius:4px`;
  el.textContent = label;
  return el;
}

function statusFormatter(cell: any) {
  const data = cell.getRow().getData();
  const status = (entryStatusMapping as any)[data.entryStatus] || data.entryStatus || '';
  return status;
}

type UnifiedColumnsParams = {
  entries: any[];
  drawCreated?: boolean;
  hasDrawDefinitions?: boolean;
  sortState: SortState;
  onEntryAction: (e: MouseEvent, cell: any) => void;
};

export function getUnifiedColumns({
  entries,
  drawCreated,
  hasDrawDefinitions,
  sortState,
  onEntryAction,
}: UnifiedColumnsParams): any[] {
  const teams = entries.find((entry) => entry.participant?.teams?.length);
  const ratingColumns = getRatingColumns(entries, 'entry');
  const hasDrawPosition = entries.some((entry) => entry.drawPosition);
  const seeding = entries.find((entry) => entry.seedNumber);
  const ranking = entries.find((entry) => entry.ranking);

  return [
    {
      cellClick: (_: Event, cell: any) => {
        const rowData = cell.getRow().getData();
        if (rowData._isSeparator) return;
        if (!drawCreated || !rowData.drawPosition) cell.getRow().toggleSelect();
      },
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      responsive: false,
      hozAlign: LEFT,
      width: 5,
    },
    {
      title: 'Grouping',
      field: 'segment',
      formatter: segmentFormatter,
      hozAlign: CENTER,
      headerHozAlign: CENTER,
      headerSort: false,
      width: 95,
    },
    {
      formatter: (cell: any) => {
        if (cell.getRow().getData()._isSeparator) return '';
        const onClick = (params: any) => {
          const clickedParticipant = params?.individualParticipant || params?.participant;
          const participantId = clickedParticipant?.participantId || cell.getRow().getData().participantId;
          if (!participantId) return;
          const table = cell.getTable();
          const participantIds = (table.getData() as any[])
            .filter((r: any) => !r._isSeparator)
            .map((r: any) => r.participant?.participantId || r.participantId)
            .filter(Boolean);
          participantProfileModal({ participantId, participantIds, readOnly: true });
        };
        return (formatParticipant(onClick, { participantDetail: 'ADDRESS' }) as any)(cell, undefined, 'sideBySide');
      },
      sorter: (a: any, b: any) =>
        (a?.participantName ?? '').localeCompare(b?.participantName ?? '', undefined, { numeric: true }),
      field: 'participant',
      responsive: false,
      resizable: false,
      minWidth: 200,
      widthGrow: 1,
      title: t('tables.entries.name'),
    },
    {
      sorterParams: { alignEmptyValues: 'bottom' },
      visible: !!ranking,
      resizable: false,
      sorter: 'number',
      field: 'ranking',
      title: t('tables.entries.rank'),
      width: 70,
    },
    ...ratingColumns,
    {
      sorter: (a: any, b: any) => a?.[0]?.participantName?.localeCompare(b?.[0]?.participantName),
      formatter: teamsFormatter(() => {
        const tournamentId = tournamentEngine.getTournament().tournamentRecord?.tournamentId;
        if (tournamentId) context.router?.navigate(`/tournament/${tournamentId}/${PARTICIPANTS}/TEAM`);
      }),
      field: 'participant.teams',
      visible: !!teams,
      title: t('tables.entries.teams'),
      responsive: false,
      resizable: false,
      minWidth: 100,
    },
    {
      editor: numericEditor({ maxValue: entries?.length || 0, decimals: false, field: 'seedNumber' }),
      formatter: (cell: any) => {
        if (cell.getRow().getData()._isSeparator) return '';
        if (isSeedingEnabled(cell.getTable())) return cellBorder(cell);
        const value = cell.getValue();
        return value ?? '';
      },
      editable: (cell: any) => {
        const data = cell.getRow().getData();
        if (data._isSeparator) return false;
        if (!isSeedingEnabled(cell.getTable())) return false;
        // Only seedable segments (accepted=0, qualifying=1)
        return data._segmentRank <= 1;
      },
      sorterParams: { alignEmptyValues: 'bottom' },
      visible: !!seeding,
      field: 'seedNumber',
      hozAlign: CENTER,
      resizable: false,
      sorter: 'number',
      title: t('tables.entries.seed'),
      maxWidth: 70,
    },
    {
      sorterParams: { alignEmptyValues: 'bottom' },
      visible: !!hasDrawPosition,
      field: 'drawPosition',
      hozAlign: CENTER,
      resizable: false,
      sorter: 'number',
      title: t('tables.entries.drawPosition'),
      maxWidth: 70,
    },
    {
      formatter: (cell: any) => {
        if (cell.getRow().getData()._isSeparator) return '';
        return (flightsFormatter(navigateToEvent) as any)(cell);
      },
      sorter: (a: any, b: any) =>
        (a?.[0]?.drawName ?? '').localeCompare(b?.[0]?.drawName ?? '', undefined, { numeric: true }),
      title: t('tables.entries.flights'),
      visible: !!hasDrawDefinitions,
      responsive: true,
      field: 'flights',
      minWidth: 100,
      widthGrow: 1,
    },
    {
      formatter: statusFormatter,
      responsive: false,
      resizable: false,
      sorter: 'string',
      title: t('tables.entries.status'),
      field: 'status',
      maxWidth: 80,
    },
    {
      field: '_segmentRank',
      sorter: createGroupedSorter(sortState),
      visible: false,
    },
    {
      cellClick: (e: MouseEvent, cell: any) => {
        if (cell.getRow().getData()._isSeparator) return;
        onEntryAction(e, cell);
      },
      visible: !drawCreated,
      formatter: (cell: any) => {
        if (cell.getRow().getData()._isSeparator) return '';
        return (threeDots as any)(cell);
      },
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      maxWidth: 40,
    },
  ];
}
