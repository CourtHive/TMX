/**
 * Create events table with light mode optimization.
 * Displays tournament events with conditional data loading based on event count threshold.
 */
import { headerSortElement } from '../common/sorters/headerSortElement';
import { mapEvent } from 'pages/tournament/tabs/eventsTab/mapEvent';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'pages/tournament/destroyTable';
import { tournamentEngine } from 'tods-competition-factory';
import { findAncestor } from 'services/dom/parentAndChild';
import { eventRowFormatter } from './eventRowFormatter';
import { getEventColumns } from './getEventColumns';
import { env } from 'settings/env';
import { t } from 'i18n';

// constants
import { TOURNAMENT_EVENTS } from 'constants/tmxConstants';

const EVENT_COUNT_THRESHOLD = 15;

export function createEventsTable(): { table: any; replaceTableData: () => void } {
  let table: any;
  const nestedTables = new Map();
  const setNestedTable = (eventId: string, table: any) => {
    if (nestedTables.has(eventId)) return;
    nestedTables.set(eventId, table);
  };

  const initialEventData = tournamentEngine.getEvents({ withScaleValues: false });
  const eventCount = initialEventData?.events?.length || 0;
  const lightMode = eventCount > EVENT_COUNT_THRESHOLD;

  const getTableData = () => {
    const eventData = tournamentEngine.getEvents({ withScaleValues: !lightMode });

    return eventData?.events?.map((event: any) =>
      mapEvent({
        scaleValues: eventData.eventScaleValues?.[event.eventId],
        lightMode,
        event,
      }),
    );
  };

  const replaceTableData = () => {
    table.replaceData(getTableData());
  };

  const columns = getEventColumns(() => lightMode);

  const render = (data: any[]) => {
    destroyTable({ anchorId: TOURNAMENT_EVENTS });
    const element = document.getElementById(TOURNAMENT_EVENTS)!;
    const headerElement = findAncestor(element, 'section')?.querySelector('.tabHeader') as HTMLElement;
    const getHeader = (rows: any[]) => `${t('pages.events.title')} (${rows.length})`;
    if (headerElement?.innerHTML) {
      headerElement.innerHTML = getHeader(data);
    }

    table = new Tabulator(element, {
      columnDefaults: {},
      headerSortElement: headerSortElement([
        'scheduledMatchUpsCount',
        'completedMatchUpsCount',
        'matchUpsCount',
        'entriesCount',
        'drawsCount',
      ]),
      rowFormatter: eventRowFormatter(setNestedTable),
      height: window.innerHeight * (env.tableHeightMultiplier ?? 0.85),
      placeholder: 'No events',
      layout: 'fitColumns',
      reactiveData: true,
      index: 'eventId',
      columns,
      data,
    });
    table.on('scrollVertical', destroyTipster);
    table.on('dataChanged', (rows: any[]) => {
      if (headerElement) {
        headerElement.innerHTML = getHeader(rows);
      }
    });
    table.on('dataFiltered', (_filters: any, rows: any[]) => {
      if (headerElement) {
        headerElement.innerHTML = getHeader(rows);
      }
    });
  };

  render(getTableData());

  return { table, replaceTableData };
}
