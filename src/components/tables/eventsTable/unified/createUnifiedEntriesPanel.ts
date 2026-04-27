/**
 * Unified entries panel — single table with sort-segregated segments.
 * Standard view for event entries. The legacy 5-panel approach remains
 * available behind the `legacyEntriesTable` setting as a power-user fallback.
 */
import { segmentRank, SEGMENT_LABELS, handleHeaderClick } from './segmentSorter';
import { editAvoidances } from 'components/drawers/avoidances/editAvoidances';
import { headerSortElement } from '../../common/sorters/headerSortElement';
import { addFlights } from 'components/modals/addFlights/addFlights';
import { mapEntry } from 'pages/tournament/tabs/eventsTab/mapEntry';
import { removeAllChildNodes } from 'services/dom/transformers';
import { getOverlayItems, getRightItems } from './segmentOverlay';
import { navigateToEvent } from '../../common/navigateToEvent';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { getUnifiedColumns } from './unifiedColumns';
import { pairFromUnified } from './pairFromUnified';
import { controlBar } from 'courthive-components';
import { isFunction } from 'functions/typeOf';
import type { SortState } from './segmentSorter';
import { context } from 'services/context';
import {
  drawDefinitionConstants,
  entryStatusConstants,
  eventConstants,
  tournamentEngine,
} from 'tods-competition-factory';

// constants
import {
  CONTROL_BAR,
  ENTRIES_VIEW,
  EVENT_CONTROL,
  LEFT,
  RIGHT,
  TMX_TABLE,
} from 'constants/tmxConstants';

const { MAIN } = drawDefinitionConstants;
const { UNGROUPED, WITHDRAWN } = entryStatusConstants;
const { DOUBLES } = eventConstants;

const UNIFIED_TABLE_KEY = 'unifiedEntries';

// Search scope options
const SCOPE_ALL = 'ALL';
const SCOPE_ACCEPTED = 'ACCEPTED';
const SCOPE_QUALIFYING = 'QUALIFYING';
const SCOPE_ALTERNATES = 'ALTERNATES';
const SCOPE_UNGROUPED = 'UNGROUPED';
const SCOPE_WITHDRAWN = 'WITHDRAWN';

const SCOPE_RANK_MAP: Record<string, number | undefined> = {
  [SCOPE_ACCEPTED]: 0,
  [SCOPE_QUALIFYING]: 1,
  [SCOPE_ALTERNATES]: 2,
  [SCOPE_UNGROUPED]: 3,
  [SCOPE_WITHDRAWN]: 4,
};

export function createUnifiedEntriesPanel({
  headerElement,
  eventId,
  drawId,
}: {
  headerElement?: HTMLElement;
  eventId: string;
  drawId?: string;
}): void {
  const sortState: SortState = { secondaryField: '', secondaryDir: 'asc' };
  let table: any;
  let searchScope = SCOPE_ALL;
  let searchFilter: ((rowData: any) => boolean) | undefined;
  const pairingMode = { enabled: false };

  // ── Data loading ──
  const getTableData = () => {
    const { event, drawDefinition } = tournamentEngine.getEvent({ eventId, drawId });
    if (headerElement) headerElement.innerHTML = event?.eventName;
    if (!event) return { error: 'EVENT_NOT_FOUND' };

    const { participants, derivedDrawInfo } =
      tournamentEngine.getParticipants({
        participantFilters: { eventIds: [eventId] },
        withIndividualParticipants: true,
        withScaleValues: true,
        withDraws: true,
        withISO2: true,
      }) ?? {};

    const hasDrawDefinitions = event?.drawDefinitions?.length > 0;
    const categoryName = event.category?.categoryName ?? event.category?.ageCategoryCode;
    const isDoubles = event?.eventType === DOUBLES;
    const drawCreated = !!drawDefinition;

    // Build participantId → drawPosition map from ALL draw definitions
    // so participants with positions in any draw are marked as non-movable
    const drawPositionMap: Record<string, number> = {};
    for (const dd of event?.drawDefinitions || []) {
      for (const structure of dd.structures || []) {
        for (const pa of structure.positionAssignments || []) {
          if (pa.participantId && pa.drawPosition) {
            drawPositionMap[pa.participantId] = pa.drawPosition;
          }
        }
      }
    }

    // Build participantId → draws map
    const participantDrawsMap: Record<
      string,
      { drawId: string; drawName: string; entryStage?: string; eventId: string }[]
    > = {};
    if (hasDrawDefinitions) {
      for (const dd of event.drawDefinitions) {
        for (const entry of dd.entries || []) {
          if (!participantDrawsMap[entry.participantId]) participantDrawsMap[entry.participantId] = [];
          participantDrawsMap[entry.participantId].push({
            drawId: dd.drawId,
            drawName: dd.drawName,
            entryStage: entry.entryStage,
            eventId,
          });
        }
      }
    }

    const entries = (drawDefinition?.entries || event?.entries || []).map((entry: any) =>
      mapEntry({
        eventType: event.eventType,
        participantDrawsMap,
        drawPositionMap,
        derivedDrawInfo,
        categoryName,
        participants,
        eventId,
        entry,
      }),
    );

    // Add segment rank to each entry
    for (const entry of entries) {
      const stage = entry.entryStage || MAIN;
      entry._segmentRank = segmentRank(stage, entry.entryStatus);
    }

    // Filter out ungrouped for singles events
    const filteredEntries = isDoubles ? entries : entries.filter((e: any) => e.entryStatus !== UNGROUPED);

    // Filter out withdrawn when draw is created
    const visibleEntries = drawCreated
      ? filteredEntries.filter((e: any) => e.entryStatus !== WITHDRAWN)
      : filteredEntries;

    return { entries: visibleEntries, event, drawDefinition, hasDrawDefinitions, isDoubles, drawCreated };
  };

  const refresh = () => {
    const result = getTableData();
    if (result.error || !table) return;

    // Rebuild columns so newly relevant columns appear (ratings, ranking, seeding, etc.)
    const freshColumns = getUnifiedColumns({
      entries: result.entries,
      hasDrawDefinitions: result.hasDrawDefinitions,
      sortState,
    });
    table.setColumns(freshColumns);

    table.replaceData(result.entries);
    applySort();
    renderEventControlBar();
    renderTableControlBar();
  };

  const applySort = () => {
    if (!table) return;
    table.setSort([{ column: '_segmentRank', dir: 'asc' }]);
  };

  // ── Enter-to-select (and pair in pairing mode) ──
  const handleSearchEnter = (inputElement: HTMLInputElement) => {
    if (!table) return;

    const visibleRows = table.getRows('active');
    const firstMatch = visibleRows.find((row: any) => !row.getData()._isSeparator);
    if (!firstMatch) return;

    const matchData = firstMatch.getData();

    if (pairingMode.enabled) {
      const selected = table.getSelectedData().filter((r: any) => !r._isSeparator);
      if (
        selected.length === 1 &&
        selected[0]._segmentRank === 3 &&
        matchData._segmentRank === 3 &&
        selected[0].participantId !== matchData.participantId
      ) {
        const ids: [string, string] = [selected[0].participantId, matchData.participantId];
        table.deselectRow();
        inputElement.value = '';
        applySearchFilter('');
        pairFromUnified(event, ids, () => refresh());
        return;
      }
    }

    table.selectRow(firstMatch);
    inputElement.value = '';
    applySearchFilter('');
  };

  // ── Search with scope ──
  const applySearchFilter = (value: string) => {
    if (!table) return;
    if (searchFilter) table.removeFilter(searchFilter);

    const text = value?.toLowerCase();
    const scopeRank = SCOPE_RANK_MAP[searchScope];

    searchFilter = (rowData: any) => {
      if (rowData._isSeparator) return true;
      const matchesText = !text || rowData.searchText?.includes(text);
      const matchesScope = scopeRank === undefined || rowData._segmentRank === scopeRank;
      return matchesText && matchesScope;
    };

    if (text || scopeRank !== undefined) {
      table.addFilter(searchFilter);
    } else {
      searchFilter = undefined;
    }
  };

  const updateSearchScope = (newScope: string) => {
    searchScope = newScope;
    const searchInput = document.getElementById('unifiedSearch') as HTMLInputElement;
    applySearchFilter(searchInput?.value || '');
  };

  // ── Segment counts ──
  const getSegmentCounts = (entries: any[]): Record<number, number> => {
    const counts: Record<number, number> = {};
    for (const entry of entries) {
      const rank = entry._segmentRank ?? 5;
      counts[rank] = (counts[rank] || 0) + 1;
    }
    return counts;
  };

  // ── Build ──
  const result = getTableData();
  if (result.error) return;

  const { entries, event, hasDrawDefinitions, isDoubles, drawCreated } = result;
  const drawName = event?.drawDefinitions?.find((d: any) => d?.drawId === drawId)?.drawName;

  // ── Render into ENTRIES_VIEW ──
  const entriesView = document.getElementById(ENTRIES_VIEW);
  if (!entriesView) return;

  removeAllChildNodes(entriesView);

  const tableContainer = document.createElement('div');
  tableContainer.className = `${TMX_TABLE} flexcol flexcenter`;
  entriesView.appendChild(tableContainer);

  // ── Table columns ──
  const columns = getUnifiedColumns({
    entries,
    hasDrawDefinitions,
    sortState,
  });

  const ratingFields = columns.filter((col: any) => col.field?.startsWith('ratings.')).map((col: any) => col.field);

  // ── Create Tabulator ──
  const tableHeight = Math.floor(window.innerHeight * 0.7);

  table = new Tabulator(tableContainer, {
    headerSortElement: headerSortElement([
      ...ratingFields,
      'drawPosition',
      'seedNumber',
      'ranking',
      'status',
      'flights',
    ]),
    selectableRows: true,
    selectableRowsCheck: (row: any) => {
      const data = row.getData();
      return !data._isSeparator && !data.drawPosition;
    },
    columns,
    responsiveLayout: 'collapse',
    index: 'participantId',
    layout: 'fitColumns',
    reactiveData: true,
    height: `${tableHeight}px`,
    data: entries,
    placeholder: 'No entries',
    rowFormatter: (row: any) => {
      const data = row.getData();
      if (data._isSeparator) {
        const el = row.getElement();
        el.style.cssText = 'background:var(--tmx-bg-secondary,#f5f5f5);pointer-events:none;height:4px;min-height:4px';
        return;
      }
      if (data._segmentRank === 4) {
        row.getElement().style.opacity = '0.6';
      }
    },
  });

  context.tables[UNIFIED_TABLE_KEY] = table;
  table._unifiedRefresh = refresh;

  // ── Header click for secondary sort ──
  table.on('headerClick', (_e: Event, column: any) => {
    const field = column.getField();
    handleHeaderClick(sortState, field, applySort);
  });

  // ── Doubles pairing mode: auto-pair on 2 ungrouped selected ──
  if (isDoubles) {
    table.on('rowSelected', () => {
      if (!pairingMode.enabled) return;
      const selected = table.getSelectedData().filter((r: any) => !r._isSeparator);
      // Only auto-pair when both selected are ungrouped
      if (selected.length === 2 && selected.every((r: any) => r._segmentRank === 3)) {
        const ids: [string, string] = [selected[0].participantId, selected[1].participantId];
        table.deselectRow();
        pairFromUnified(event, ids, () => refresh());
      }
    });
  }

  // Note: the controlBar's internal rowSelectionChanged listener handles overlay
  // container visibility toggling. We do NOT rebuild the entire controlBar on
  // selection change — doing so destroys DOM and causes cascading deselection.

  // ── Table built → apply sort + render control bars ──
  table.on('tableBuilt', () => {
    applySort();
    renderEventControlBar();
    renderTableControlBar();
  });

  // ── EVENT_CONTROL bar (top-level: search, draw selector, avoidances, add draw) ──
  const renderEventControlBar = () => {
    const eventControlElement = document.getElementById(EVENT_CONTROL) || undefined;
    if (!eventControlElement) return;

    // Fetch fresh data so counts and draw selectors stay current after mutations
    const freshResult = getTableData();
    const freshEntries = freshResult.entries ?? [];
    const freshEvent = freshResult.event;
    const freshIsDoubles = freshResult.isDoubles;

    const counts = getSegmentCounts(freshEntries);
    const totalCount = freshEntries.length;

    const scopeOptions = [
      { label: `All (${totalCount})`, onClick: () => updateSearchScope(SCOPE_ALL), close: true },
      counts[0] && { label: `Accepted (${counts[0]})`, onClick: () => updateSearchScope(SCOPE_ACCEPTED), close: true },
      counts[1] && {
        label: `Qualifying (${counts[1]})`,
        onClick: () => updateSearchScope(SCOPE_QUALIFYING),
        close: true,
      },
      counts[2] && {
        label: `Alternates (${counts[2]})`,
        onClick: () => updateSearchScope(SCOPE_ALTERNATES),
        close: true,
      },
      freshIsDoubles &&
        counts[3] && {
          label: `Ungrouped (${counts[3]})`,
          onClick: () => updateSearchScope(SCOPE_UNGROUPED),
          close: true,
        },
      counts[4] && {
        label: `Withdrawn (${counts[4]})`,
        onClick: () => updateSearchScope(SCOPE_WITHDRAWN),
        close: true,
      },
    ].filter(Boolean);

    const ALL_ENTRIES = 'All entries';
    const eventEntries = { label: ALL_ENTRIES, onClick: () => navigateToEvent({ eventId }), close: true };
    const entriesOptions = (freshEvent?.drawDefinitions || [])
      .map((dd: any) => ({
        onClick: () => navigateToEvent({ eventId, drawId: dd.drawId }),
        label: dd?.drawName,
        close: true,
      }))
      .concat([{ divider: true } as any, eventEntries]);

    const drawAdded = (result: any) => {
      if (result.success) {
        navigateToEvent({ eventId, drawId: result.drawDefinition?.drawId, renderDraw: true });
      }
    };

    const items = [
      {
        onKeyDown: (e: any) => {
          if (e.keyCode === 8 && e.target.value.length === 1) applySearchFilter('');
          if (e.key === 'Enter' || e.keyCode === 13) handleSearchEnter(e.target);
        },
        onChange: (e: any) => applySearchFilter(e.target.value),
        onKeyUp: (e: any) => applySearchFilter(e.target.value),
        clearSearch: () => applySearchFilter(''),
        placeholder: 'Search entries',
        id: 'unifiedSearch',
        location: LEFT,
        search: true,
      },
      {
        label: searchScope === SCOPE_ALL ? 'All' : SEGMENT_LABELS[SCOPE_RANK_MAP[searchScope] ?? 0] || 'All',
        options: scopeOptions,
        selection: false,
        location: LEFT,
      },
      { label: drawName || ALL_ENTRIES, options: entriesOptions, location: LEFT },
      {
        onClick: () => editAvoidances({ eventId }),
        intent: 'is-warning',
        id: 'editAvoidances',
        label: 'Avoidances',
        location: RIGHT,
      },
      {
        onClick: () => addFlights({ eventId, callback: () => navigateToEvent({ eventId }) }),
        intent: 'is-info',
        label: 'Add flights',
        location: RIGHT,
        hide: !!drawId,
      },
      {
        onClick: () => addDraw({ eventId, callback: drawAdded }),
        intent: 'is-primary',
        label: 'Add draw',
        location: RIGHT,
      },
    ];

    controlBar({ target: eventControlElement, items });
  };

  // ── Table-level control bar (overlay actions + right-side tools) ──
  const renderTableControlBar = () => {
    const overlayItemDefs = getOverlayItems({
      event,
      drawId,
      drawCreated: drawCreated ?? false,
      isDoubles: isDoubles ?? false,
      onRefresh: refresh,
    });

    const rightItems = getRightItems({
      event,
      drawCreated: drawCreated ?? false,
      isDoubles: isDoubles ?? false,
      onRefresh: refresh,
      pairingMode,
    });

    // Evaluate function items — both overlay and right items are functions
    // that receive the table and return item config objects.
    const evalItems = () => [
      ...overlayItemDefs.map((item: any) => (isFunction(item) ? item(table) : item)),
      ...rightItems.map((item: any) => (isFunction(item) ? item(table) : item)),
    ];

    // The controlBar needs a target — create one above the table
    let controlEl = entriesView?.querySelector(`.${CONTROL_BAR}`) as HTMLElement;
    if (!controlEl) {
      controlEl = document.createElement('div');
      controlEl.className = `${CONTROL_BAR} flexcol flexcenter`;
      entriesView?.insertBefore(controlEl, tableContainer);
    }

    // Re-evaluate overlay items when selection changes, replacing just the overlay
    // container content — avoids full controlBar rebuild which causes cascading deselection.
    const onSelection = () => {
      const overlayEl = controlEl.querySelector('.options_overlay') as HTMLElement;
      if (!overlayEl) return;
      removeAllChildNodes(overlayEl);
      const freshOverlay = overlayItemDefs.map((item: any) => (isFunction(item) ? item(table) : item));
      for (const item of freshOverlay) {
        if (!item || item.hide) continue;
        const btn = document.createElement('button');
        btn.className = `button is-small ${item.intent || 'is-light'}`;
        btn.textContent = item.label || '';
        if (item.options) {
          // Dropdown-style overlay item — render as a simple dropdown
          const wrapper = document.createElement('div');
          wrapper.className = 'dropdown is-hoverable';
          const trigger = document.createElement('div');
          trigger.className = 'dropdown-trigger';
          trigger.appendChild(btn);
          wrapper.appendChild(trigger);
          const menu = document.createElement('div');
          menu.className = 'dropdown-menu';
          const content = document.createElement('div');
          content.className = 'dropdown-content';
          for (const opt of item.options) {
            const a = document.createElement('a');
            a.className = 'dropdown-item';
            a.textContent = opt.label || '';
            a.onclick = (e) => { e.stopPropagation(); opt.onClick?.(); };
            content.appendChild(a);
          }
          menu.appendChild(content);
          wrapper.appendChild(menu);
          overlayEl.appendChild(wrapper);
        } else {
          btn.onclick = (e) => { e.stopPropagation(); item.onClick?.(); };
          overlayEl.appendChild(btn);
        }
      }
    };

    controlBar({ target: controlEl, table, items: evalItems(), onSelection });
  };
}
