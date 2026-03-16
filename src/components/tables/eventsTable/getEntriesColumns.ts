/**
 * Column definitions for event entries table.
 * Displays participant details, rankings, ratings, teams, seeding, flights, and status.
 * Rating columns are generated dynamically from entry data.
 */
import { participantProfileModal } from 'components/modals/participantProfileModal';
import { formatParticipant } from '../common/formatters/participantFormatter';
import { flightsFormatter } from '../common/formatters/flightsFormatter';
import { teamsFormatter } from '../common/formatters/teamsFormatter';
import { numericEditor } from '../common/editors/numericEditor';
import { getRatingColumns } from '../common/getRatingColumns';
import { cellBorder } from '../common/formatters/cellBorder';
import { navigateToEvent } from '../common/navigateToEvent';
import { tournamentEngine } from 'tods-competition-factory';
import { threeDots } from '../common/formatters/threeDots';
import { entryActions } from '../../popovers/entryActions';
import { isSeedingEnabled } from './seeding/seedingState';
import { PARTICIPANTS } from 'constants/tmxConstants';
import { headerMenu } from '../common/headerMenu';
import { context } from 'services/context';
import { t } from 'i18n';

// constants
import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';

export function getEntriesColumns(
  {
    entries,
    exclude = [],
    eventId,
    drawId,
    actions = [],
    drawCreated,
  }: {
    entries: any[];
    exclude?: string[];
    eventId?: string;
    drawId?: string;
    actions?: any[];
    drawCreated?: boolean;
  } = {} as any,
): any[] {
  const teams = entries.find((entry) => entry.participant?.teams?.length);
  const ratingColumns = getRatingColumns(entries, 'entry');
  const hasDrawPosition = entries.some((entry) => entry.drawPosition);
  const seeding = entries.find((entry) => entry.seedNumber);
  const ranking = entries.find((entry) => entry.ranking);

  return [
    {
      cellClick: (_: Event, cell: any) => {
        const rowData = cell.getRow().getData();
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
      headerMenu: headerMenu({}),
      formatter: 'rownum',
      headerSort: false,
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      width: 65,
    },
    {
      formatter: 'responsiveCollapse',
      responsive: false,
      headerSort: false,
      hozAlign: CENTER,
      resizable: false,
      width: 50,
    },
    {
      formatter: (cell: any) => {
        const onClick = (params: any) => {
          const clickedParticipant = params?.individualParticipant || params?.participant;
          const participantId = clickedParticipant?.participantId || cell.getRow().getData().participantId;
          if (!participantId) return;
          const table = cell.getTable();
          const participantIds = (table.getData() as any[])
            .map((r: any) => r.participant?.participantId || r.participantId)
            .filter(Boolean);
          participantProfileModal({ participantId, participantIds, readOnly: true });
        };
        return (formatParticipant(onClick, { participantDetail: 'ADDRESS' }) as any)(cell, undefined, 'sideBySide');
      },
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
        if (isSeedingEnabled(cell.getTable())) return cellBorder(cell);
        const value = cell.getValue();
        return value ?? '';
      },
      editable: (cell: any) => isSeedingEnabled(cell.getTable()),
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
      formatter: flightsFormatter(navigateToEvent),
      title: t('tables.entries.flights'),
      responsive: true,
      field: 'flights',
      minWidth: 100,
      widthGrow: 1,
    },
    {
      responsive: false,
      resizable: false,
      title: t('tables.entries.status'),
      field: 'status',
      maxWidth: 80,
    },
    {
      cellClick: entryActions(actions, eventId || '', drawId),
      visible: !drawCreated,
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      maxWidth: 40,
    },
  ].filter(({ field }) => Array.isArray(exclude) && !exclude?.includes(field || ''));
}
