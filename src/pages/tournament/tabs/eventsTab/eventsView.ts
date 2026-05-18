/**
 * Events view with cards (default) or table. Orchestrator owns the
 * banner-style tab header so the title + Cards/Table icon toggle render on
 * the same line. View mode persists in `localStorage.tmx_events_view_mode`.
 */

import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { createEventsTable } from 'components/tables/eventsTable/createEventsTable';
import { mapEvent } from 'pages/tournament/tabs/eventsTab/mapEvent';
import { renderEventsGrid, readEventCardData } from './createEventsGrid';
import { buildViewToggleElement } from 'components/tables/common/viewToggle';
import { readEventsViewMode, writeEventsViewMode } from './eventsViewMode';
import { deleteEvents } from 'components/modals/deleteEvents';
import { controlBar } from 'courthive-components';
import { providerConfig } from 'config/providerConfig';
import { destroyTable } from 'pages/tournament/destroyTable';
import { setTabHeader } from 'components/tables/common/setTabHeader';
import { editEvent } from './editEvent';
import { t } from 'i18n';

// constants
import { EVENTS_CONTROL, LEFT, OVERLAY, RIGHT, TOURNAMENT_EVENTS } from 'constants/tmxConstants';

export function eventsView(): void {
  let mode = readEventsViewMode();
  let table: any;
  let setSearchFilter: (q: string) => void = () => {};
  let currentQuery = '';

  const anchor = document.getElementById(TOURNAMENT_EVENTS);

  function buildToggle(): HTMLElement {
    return buildViewToggleElement({
      mode,
      onChange: (m) => {
        if (m === mode) return;
        mode = m;
        writeEventsViewMode(m);
        renderForMode();
      }
    });
  }

  function refreshHeader(count: number): void {
    if (!anchor) return;
    setTabHeader({
      anchor,
      label: t('pages.events.title'),
      count,
      trailing: buildToggle()
    });
  }

  function renderGrid(): void {
    if (!anchor) return;
    destroyTable({ anchorId: TOURNAMENT_EVENTS });
    table = undefined;
    const count = renderEventsGrid(anchor, currentQuery.toLowerCase());
    refreshHeader(count);
    setSearchFilter = (q: string) => {
      currentQuery = q;
      if (!anchor) return;
      const filteredCount = renderEventsGrid(anchor, q.toLowerCase());
      refreshHeader(filteredCount);
    };
  }

  function renderTable(): void {
    const result = createEventsTable();
    table = result.table;
    const initialCount = table?.getDataCount?.() ?? table?.getData?.().length ?? 0;
    refreshHeader(initialCount);
    table?.on?.('dataChanged', (rows: any[]) => refreshHeader(rows.length));
    table?.on?.('dataFiltered', (_filters: any, rows: any[]) => refreshHeader(rows.length));
    setSearchFilter = createSearchFilter(table);
    if (currentQuery) setSearchFilter(currentQuery);
  }

  function renderForMode(): void {
    if (mode === 'grid') renderGrid();
    else renderTable();
    renderControls();
  }

  const eventAdded = (result: any) => {
    if (mode === 'grid') {
      if (anchor) {
        const count = renderEventsGrid(anchor, currentQuery.toLowerCase());
        refreshHeader(count);
      }
    } else if (result?.event && table) {
      const tableRow = mapEvent({ event: result.event });
      table.updateOrAddData([tableRow]);
    }
  };

  const deleteAction = () => {
    const eventIds = table?.getSelectedData?.().map(({ eventId }: any) => eventId) ?? [];
    const callback = (r: any) => {
      if (!r.success) return;
      if (mode === 'grid') renderGrid();
      else table?.deleteRow(eventIds);
    };
    return deleteEvents({ eventIds, callback });
  };

  function buildItems(): any[] {
    return [
      {
        onClick: deleteAction,
        label: t('pages.events.deleteSelected'),
        intent: 'is-danger',
        stateChange: true,
        hide: !providerConfig.isAllowed('canDeleteEvents') || mode === 'grid',
        location: OVERLAY
      },
      {
        onKeyDown: (e: KeyboardEvent) =>
          e.key === 'Backspace' && (e.target as HTMLInputElement).value.length === 1 && setSearchFilter(''),
        onChange: (e: Event) => setSearchFilter((e.target as HTMLInputElement).value),
        onKeyUp: (e: Event) => setSearchFilter((e.target as HTMLInputElement).value),
        clearSearch: () => setSearchFilter(''),
        placeholder: t('pages.events.searchEvents'),
        location: LEFT,
        search: true,
        value: currentQuery || undefined
      },
      {
        onClick: () => (editEvent as any)({ callback: eventAdded }),
        label: t('pages.events.addEvent'),
        intent: 'is-info',
        hide: !providerConfig.isAllowed('canCreateEvents'),
        location: RIGHT
      }
    ];
  }

  function renderControls(): void {
    const target = document.getElementById(EVENTS_CONTROL) || undefined;
    controlBar({ table, target, items: buildItems() });
  }

  // Prime the header before async work so the title is always visible.
  if (!anchor) return;
  refreshHeader(readEventCardData().length);
  renderForMode();
}
