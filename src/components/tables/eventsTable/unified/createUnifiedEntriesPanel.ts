/**
 * Unified entries panel — single table with sort-segregated segments.
 * Standard view for event entries. The legacy 5-panel approach remains
 * available behind the `legacyEntriesTable` setting as a power-user fallback.
 */
import { drawDefinitionConstants, entryStatusConstants, eventConstants } from 'tods-competition-factory';
import type { PairingContext, PairingMode, RotatingPartnersMode } from './segmentOverlay';
import { segmentRank, SEGMENT_LABELS, handleHeaderClick } from './segmentSorter';
import { editAvoidances } from 'components/drawers/avoidances/editAvoidances';
import { headerSortElement } from '../../common/sorters/headerSortElement';
import { addFlights } from 'components/modals/addFlights/addFlights';
import { mapEntry } from 'pages/tournament/tabs/eventsTab/mapEntry';
import { getOverlayItems, getRightItems } from './segmentOverlay';
import { controlBar, dropDownButton } from 'courthive-components';
import { removeAllChildNodes } from 'services/dom/transformers';
import { navigateToEvent } from '../../common/navigateToEvent';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { tournamentEngine } from 'services/factory/engine';
import { isSeedingEnabled } from '../seeding/seedingState';
import { tmxToast } from 'services/notifications/tmxToast';
import { getUnifiedColumns } from './unifiedColumns';
import { inheritedEntryStage } from './pairSegment';
import { pairFromUnified } from './pairFromUnified';
import type { SortState } from './segmentSorter';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import {
  getEventOnlyUngroupedEntries,
  isRotatingPartnersEligible,
  drawHasSharedIndividuals,
  getGroupedIndividuals,
  getPairIndividualsMap,
  pairOverlapsEntries,
  getPairability,
  UNGROUPED_RANK,
  GROUPED_RANK,
} from './rotatingPartners';

// constants
import { ACCEPTED, CONTROL_BAR, ENTRIES_VIEW, EVENT_CONTROL, LEFT, RIGHT, TMX_TABLE } from 'constants/tmxConstants';
import { t } from 'i18n';

const { MAIN } = drawDefinitionConstants;
const { ALTERNATE, UNGROUPED, WITHDRAWN } = entryStatusConstants;
const { DOUBLES } = eventConstants;

const UNIFIED_TABLE_KEY = 'unifiedEntries';

// Search scope options
const SCOPE_ALL = 'ALL';
const SCOPE_ACCEPTED = 'ACCEPTED';
const SCOPE_QUALIFYING = 'QUALIFYING';
const SCOPE_ALTERNATES = 'ALTERNATES';
const SCOPE_UNGROUPED = 'UNGROUPED';
const SCOPE_WITHDRAWN = 'WITHDRAWN';
const SCOPE_GROUPED = 'GROUPED';

const SCOPE_RANK_MAP: Record<string, number | undefined> = {
  [SCOPE_ACCEPTED]: 0,
  [SCOPE_QUALIFYING]: 1,
  [SCOPE_ALTERNATES]: 2,
  [SCOPE_UNGROUPED]: 3,
  [SCOPE_WITHDRAWN]: 4,
  [SCOPE_GROUPED]: GROUPED_RANK,
};

/**
 * Rotating partners rows: the event's UNGROUPED individuals not yet in the draw, and a virtual
 * [Grouped] row for each individual of the draw's PAIR entries. Neither is a draw entry, so each is
 * flagged (`_eventOnly` / `_grouped`) for the overlay to offer pairing and nothing else.
 */
function buildRotatingRows({
  pairIndividuals,
  drawDefinition,
  participants,
  existingIds,
  mapParams,
  event,
}: {
  pairIndividuals: Record<string, string[]>;
  existingIds: Set<string>;
  participants: any[];
  drawDefinition: any;
  mapParams: any;
  event: any;
}): any[] {
  const individualsById = new Map<string, any>();
  for (const participant of participants) {
    for (const individual of participant.individualParticipants ?? []) {
      individualsById.set(individual.participantId, individual);
    }
  }
  const nameOf = (id: string) => individualsById.get(id)?.participantName;

  const eventOnlyRows = getEventOnlyUngroupedEntries({
    eventEntries: event.entries,
    drawEntries: drawDefinition.entries,
  })
    .filter((entry) => !existingIds.has(entry.participantId))
    .map((entry) => ({ ...mapEntry({ ...mapParams, entry }), _segmentRank: UNGROUPED_RANK, _eventOnly: true }));

  const groupedRows = getGroupedIndividuals({ drawEntries: drawDefinition.entries, pairIndividuals })
    .filter(({ individualId }) => !existingIds.has(individualId))
    .map(({ individualId, pairIds, entryStage }) => {
      const partnerNames = pairIds
        .flatMap((pairId) => pairIndividuals[pairId].filter((id) => id !== individualId))
        .map(nameOf)
        .filter(Boolean)
        .join(', ');
      const entry = { participantId: individualId, entryStage };
      const participant = individualsById.get(individualId);
      return {
        ...mapEntry({ ...mapParams, participant, entry }),
        _segmentRank: GROUPED_RANK,
        _partnerNames: partnerNames,
        _grouped: true,
      };
    });

  return [...eventOnlyRows, ...groupedRows];
}

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
  // Segment a created pair enters as. Inferred rather than fixed: in a draw view the individuals
  // being paired are draw entries, so their replacement should be an accepted one — pairing must
  // not shrink the field. On the all-entries view ALTERNATE preserves the historical default.
  const pairingMode: PairingMode = { enabled: false, segment: drawId ? ACCEPTED : ALTERNATE };
  // Not persisted (CA): starts ON when the draw already holds pairs sharing an individual, decided once
  // per render of the view so the TD's own toggle is not overridden on every refresh.
  const rotatingMode: RotatingPartnersMode = { eligible: false, enabled: false };
  let rotatingInitialized = false;
  let pairingContext = {
    rotatingEnabled: false,
    eventEntries: [] as any[],
    pairIndividuals: {} as Record<string, string[]>,
  };
  const getPairingContext: PairingContext = () => pairingContext;

  // Refreshes the rotating-partners state from the current data and returns the rows the mode adds.
  const getRotatingRows = ({ entries, event, drawDefinition, participants, mapParams }: any): any[] => {
    const pairIndividuals = getPairIndividualsMap(participants);
    rotatingMode.eligible = !!drawId && isRotatingPartnersEligible({ event, drawDefinition });
    if (rotatingMode.eligible && !rotatingInitialized) {
      rotatingMode.enabled = drawHasSharedIndividuals({ drawEntries: drawDefinition.entries, pairIndividuals });
      rotatingInitialized = true;
    }
    const rotatingEnabled = rotatingMode.eligible && rotatingMode.enabled;
    pairingContext = { rotatingEnabled, eventEntries: event.entries ?? [], pairIndividuals };
    if (!rotatingEnabled) return [];

    const existingIds = new Set<string>(entries.map((entry: any) => entry.participantId));
    return buildRotatingRows({ event, drawDefinition, participants, pairIndividuals, existingIds, mapParams });
  };

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

    const mapParams = {
      eventType: event.eventType,
      participantDrawsMap,
      drawPositionMap,
      derivedDrawInfo,
      categoryName,
      participants,
      eventId,
    };
    const entries = (drawDefinition?.entries || event?.entries || []).map((entry: any) =>
      mapEntry({ ...mapParams, entry }),
    );

    // Add segment rank to each entry
    for (const entry of entries) {
      const stage = entry.entryStage || MAIN;
      entry._segmentRank = segmentRank(stage, entry.entryStatus);
    }

    entries.push(...getRotatingRows({ entries, event, drawDefinition, participants: participants ?? [], mapParams }));

    // Filter out ungrouped for singles events
    const filteredEntries = isDoubles ? entries : entries.filter((e: any) => e.entryStatus !== UNGROUPED);

    // Filter out withdrawn when draw is created
    const visibleEntries = drawCreated
      ? filteredEntries.filter((e: any) => e.entryStatus !== WITHDRAWN)
      : filteredEntries;

    return { entries: visibleEntries, event, drawDefinition, hasDrawDefinitions, isDoubles, drawCreated };
  };

  const refresh = () => {
    // a mutation callback can land after the view has moved on; the stale panel must not re-render
    if (!table || !tableContainer?.isConnected) return;
    const result = getTableData();
    if (result.error) return;

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
      const rows = [selected[0], matchData];
      if (selected.length === 1 && getPairability({ rows, ...getPairingContext() }).pairable) {
        const ids: [string, string] = [selected[0].participantId, matchData.participantId];
        table.deselectRow();
        inputElement.value = '';
        applySearchFilter('');
        pairFromUnified({
          event,
          participantIds: ids,
          segment: pairingMode.segment,
          entryStage: inheritedEntryStage(rows, pairingMode.segment),
          overlaps: pairOverlapsEntries(rows),
          drawId,
          callback: () => refresh(),
        });
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
      const rank = entry._segmentRank ?? 6;
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
    // Allow selection of placed participants so they can be added to sibling
    // draws within the same event (e.g. Main → Backdraw). Action handlers
    // filter for placement when an action would be invalid for placed entries.
    //
    // Reject separators, and reject any row whose backing element has been
    // wiped (getElement() === false). After a mutation refresh (replaceData /
    // deleteRow), a deleted or recycled Tabulator row can linger in the DOM
    // with a stale click listener; selecting it crashes _selectRow at
    // `row.getElement().classList.add`. This is the same gate Tabulator's
    // toggleRow consults, so failing it here prevents that crash entirely.
    //
    // Selection is also suspended during manual seeding: clicking a seed cell
    // would otherwise also select the row, and the controlBar swaps to selection
    // overlay actions — hiding the Save/Cancel seeding buttons.
    selectableRowsCheck: (row: any) => !!row.getElement() && !row.getData()._isSeparator && !isSeedingEnabled(table),
    columns,
    responsiveLayout: 'collapse',
    index: 'participantId',
    layout: 'fitColumns',
    reactiveData: true,
    height: `${tableHeight}px`,
    data: entries,
    placeholder: t('ui.noEntries'),
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
      // Auto-pair two ungrouped rows — or, in Rotating partners mode, any two ungrouped/grouped rows
      const { pairable, reason } = getPairability({ rows: selected, ...getPairingContext() });
      if (reason === 'ALREADY_PARTNERS') {
        table.deselectRow();
        tmxToast({ message: t('entries.alreadyPartners'), intent: 'is-warning' });
        return;
      }
      if (pairable) {
        const ids: [string, string] = [selected[0].participantId, selected[1].participantId];
        table.deselectRow();
        pairFromUnified({
          event,
          participantIds: ids,
          segment: pairingMode.segment,
          entryStage: inheritedEntryStage(selected, pairingMode.segment),
          overlaps: pairOverlapsEntries(selected),
          drawId,
          callback: () => refresh(),
        });
      }
    });
  }

  // Note: the controlBar's internal rowSelectionChanged listener handles overlay
  // container visibility toggling. We do NOT rebuild the entire controlBar on
  // selection change — doing so destroys DOM and causes cascading deselection.

  // ── Table built → apply sort + render control bars ──
  table.on('tableBuilt', () => {
    // Tabulator builds asynchronously. If the view was re-rendered in the meantime (navigating between
    // entries views), this panel's container is detached: rendering its control bars would throw on
    // `insertBefore` and overwrite the current panel's EVENT_CONTROL with this stale one's items.
    if (!tableContainer.isConnected) return;
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
      counts[GROUPED_RANK] && {
        label: `Grouped (${counts[GROUPED_RANK]})`,
        onClick: () => updateSearchScope(SCOPE_GROUPED),
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
        placeholder: t('modals.selectParticipant.searchEntries'),
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
        label: t('eventRow.avoidances'),
        location: RIGHT,
      },
      {
        onClick: () => addFlights({ eventId, callback: () => navigateToEvent({ eventId }) }),
        intent: 'is-info',
        label: t('pages.events.addFlights'),
        location: RIGHT,
        hide: !!drawId,
      },
      {
        onClick: () => {
          // Read selection at click time so user expectations match: whatever
          // is highlighted in the table when the user presses "Add draw"
          // becomes the new draw's entries (cross-stage allowed). Empty
          // selection preserves the legacy behavior — fall back to
          // entry-status-filtered event entries.
          const selectedParticipantIds = (table?.getSelectedData() ?? [])
            .filter((r: any) => !r._isSeparator && r.participantId)
            .map((r: any) => r.participantId);
          addDraw({
            eventId,
            callback: drawAdded,
            ...(selectedParticipantIds.length ? { selectedParticipantIds } : {}),
          });
        },
        intent: 'is-primary',
        label: t('pages.events.addDraw'),
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
      getPairingContext,
      pairingMode,
      onRefresh: refresh,
    });

    const rightItems = getRightItems({
      event,
      drawCreated: drawCreated ?? false,
      isDoubles: isDoubles ?? false,
      onRefresh: refresh,
      rotatingMode,
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
    // Uses the shared dropDownButton component so dropdown triggers toggle on click
    // (a hand-rolled `is-hoverable` rebuild silently swallowed clicks on touch and
    // forced users to hover before the menu would appear).
    const onSelection = () => {
      const overlayEl = controlEl.querySelector('.options_overlay') as HTMLElement;
      if (!overlayEl) return;
      removeAllChildNodes(overlayEl);
      const freshOverlay = overlayItemDefs.map((item: any) => (isFunction(item) ? item(table) : item));
      for (const item of freshOverlay) {
        if (!item || item.hide) continue;
        if (item.options) {
          dropDownButton({ target: overlayEl, button: item });
        } else {
          const btn = document.createElement('button');
          btn.className = `button is-small ${item.intent || 'is-light'}`;
          btn.textContent = item.label || '';
          btn.onclick = (e) => {
            e.stopPropagation();
            item.onClick?.();
          };
          overlayEl.appendChild(btn);
        }
      }
    };

    controlBar({ target: controlEl, table, items: evalItems(), onSelection });
  };
}
