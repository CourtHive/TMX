/**
 * Column definitions for event entries table.
 * Displays participant details, rankings, ratings, teams, seeding, flights, and status.
 * Rating columns are generated dynamically from entry data.
 */
import { formatParticipant } from '../common/formatters/participantFormatter';
import { flightsFormatter } from '../common/formatters/flightsFormatter';
import { getRatingColumns } from '../common/getRatingColumns';
import { teamsFormatter } from '../common/formatters/teamsFormatter';
import { numericEditor } from '../common/editors/numericEditor';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { entryActions } from '../../popovers/entryActions';
import { headerMenu } from '../common/headerMenu';
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
  const cityState = entries.find((entry) => entry.cityState);
  const seeding = entries.find((entry) => entry.seedNumber);
  const ranking = entries.find((entry) => entry.ranking);

  return [
    {
      cellClick: (_: Event, cell: any) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      visible: !drawCreated,
      headerSort: false,
      responsive: false,
      hozAlign: LEFT,
      width: 5,
    },
    {
      headerMenu: headerMenu({}),
      formatter: 'rownum',
      headerSort: false,
      hozAlign: LEFT,
      width: 55,
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
      formatter: (cell: any) => (formatParticipant(undefined) as any)(cell, undefined, 'sideBySide'),
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
      formatter: teamsFormatter(() => console.log('boo')),
      field: 'participant.teams',
      visible: !!teams,
      title: t('tables.entries.teams'),
      responsive: false,
      resizable: false,
      minWidth: 100,
    },
    {
      visible: !!cityState,
      title: t('tables.entries.cityState'),
      field: 'cityState',
      responsive: false,
      resizable: false,
      minWidth: 100,
    },
    {
      editor: numericEditor({ maxValue: entries?.length || 0, decimals: false, field: 'seedNumber' }),
      sorterParams: { alignEmptyValues: 'bottom' },
      visible: !!seeding,
      field: 'seedNumber',
      hozAlign: CENTER,
      resizable: false,
      sorter: 'number',
      editable: false,
      title: t('tables.entries.seed'),
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
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      maxWidth: 40,
    },
  ].filter(({ field }) => Array.isArray(exclude) && !exclude?.includes(field || ''));
}
