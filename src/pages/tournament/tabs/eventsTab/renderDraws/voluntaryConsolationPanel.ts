/**
 * Inline panel for VOLUNTARY_CONSOLATION structure setup.
 * Renders a controlBar with draw config (LEFT), entry-status overlay (OVERLAY),
 * and actions (RIGHT), followed by an eligible participants table with row selection.
 *
 * Flow: TD selects participants → OVERLAY sets entry status (Accepted/Alternate/Clear)
 * → chips appear in table → Generate when ≥2 accepted.
 */
import { formatParticipant } from 'components/tables/common/formatters/participantFormatter';
import { getMatchFormatLabels } from 'components/modals/matchFormatLabels';
import { getMatchUpFormatModal, controlBar } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { logMutationError } from 'functions/logMutationError';
import { tmxToast } from 'services/notifications/tmxToast';
import { scalesMap } from 'config/scalesConfig';
import { context } from 'services/context';
import { t } from 'i18n';
import {
  drawDefinitionConstants,
  entryStatusConstants,
  factoryConstants,
  tournamentEngine,
  fixtures,
  tools,
} from 'tods-competition-factory';

// constants
import { DRAWS_VIEW, LEFT, OVERLAY, RIGHT } from 'constants/tmxConstants';
import {
  ADD_ADHOC_MATCHUPS,
  ADD_DRAW_ENTRIES,
  ADD_DRAW_DEFINITION_EXTENSION,
  ADD_DYNAMIC_RATINGS,
  ATTACH_CONSOLATION_STRUCTURES,
  REMOVE_STAGE_ENTRIES,
} from 'constants/mutationConstants';

const { VOLUNTARY_CONSOLATION, ROUND_ROBIN, SINGLE_ELIMINATION, LUCKY_DRAW, AD_HOC, MAIN, PLAY_OFF, QUALIFYING } =
  drawDefinitionConstants;
const { ALTERNATE, DIRECT_ACCEPTANCE, WITHDRAWN } = entryStatusConstants;

const STRUCTURE_ADDED = 'modals.addConsolation.structureAdded';
const IS_SUCCESS = 'is-success';
const toastStructureAdded = () => tmxToast({ message: t(STRUCTURE_ADDED), intent: IS_SUCCESS });

const DRAW_TYPE_OPTIONS = [
  { label: 'Single Elimination', value: SINGLE_ELIMINATION },
  { label: 'Round Robin', value: ROUND_ROBIN },
  { label: 'Lucky Draw', value: LUCKY_DRAW },
  { label: 'Ad Hoc', value: AD_HOC },
];

// Entry status → chip config
const STATUS_CHIPS: Record<string, { label: string; intent: string }> = {
  [DIRECT_ACCEPTANCE]: { label: 'Accepted', intent: IS_SUCCESS },
  [ALTERNATE]: { label: 'Alternate', intent: 'is-warning' },
  [WITHDRAWN]: { label: 'Withdrawn', intent: 'is-danger' },
};

type Params = {
  structure: any;
  drawId: string;
  eventId: string;
  callback?: (params?: any) => void;
};

export function voluntaryConsolationPanel({ structure, drawId, eventId, callback }: Params): void {
  const drawsView = document.getElementById(DRAWS_VIEW);
  if (!drawsView) return;

  // Fetch eligible participants (excludes those already entered as VC)
  const eligible = tournamentEngine.getEligibleVoluntaryConsolationParticipants({ drawId });
  const eligibleParticipants = eligible?.eligibleParticipants || [];

  // Also include participants already entered in VOLUNTARY_CONSOLATION stage
  const drawEntries = tournamentEngine.getEvent({ drawId })?.drawDefinition?.entries || [];
  const vcEnteredIds = drawEntries
    .filter((e: any) => e.entryStage === VOLUNTARY_CONSOLATION)
    .map((e: any) => e.participantId);

  // Combine eligible + already-entered for the full participant set
  const allIds = new Set<string>([...eligibleParticipants.map((p: any) => p.participantId), ...vcEnteredIds]);

  if (!allIds.size) {
    const panel = document.createElement('div');
    panel.className = 'flexcol flexcenter';
    panel.style.cssText = 'width:100%;height:300px';
    panel.textContent = t('modals.addConsolation.noEligible') || 'No eligible participants found';
    drawsView.appendChild(panel);
    return;
  }

  const eliminationRounds = getEliminationRounds(drawId, allIds);

  const { participants } = tournamentEngine.getParticipants({
    participantFilters: { participantIds: [...allIds] },
    withScaleValues: true,
  });

  // Discover all rating types present across eligible participants
  const { SINGLES } = factoryConstants.eventConstants;
  const { ratingsParameters } = fixtures;
  const presentRatings = new Set<string>();
  for (const p of participants || []) {
    for (const item of p.ratings?.[SINGLES] || []) {
      if (ratingsParameters[item.scaleName] && !ratingsParameters[item.scaleName].deprecated) {
        presentRatings.add(item.scaleName);
      }
    }
  }
  const availableRatings = [...presentRatings].sort();

  // ── VC entry status tracking ──
  const vcEntryMap = new Map<string, string>(); // participantId → entryStatus
  const refreshVcEntryMap = () => {
    vcEntryMap.clear();
    const entries = tournamentEngine.getEvent({ drawId })?.drawDefinition?.entries || [];
    for (const entry of entries) {
      if (entry.entryStage === VOLUNTARY_CONSOLATION) {
        vcEntryMap.set(entry.participantId, entry.entryStatus);
      }
    }
  };
  refreshVcEntryMap();

  // ── Entry status sort order: Accepted → Alternate → (none) → Withdrawn ──
  const STATUS_SORT_ORDER: Record<string, number> = {
    [DIRECT_ACCEPTANCE]: 0,
    [ALTERNATE]: 1,
    '': 2,
    [WITHDRAWN]: 3,
  };
  const statusSortRank = (status: string) => STATUS_SORT_ORDER[status] ?? 2;

  // Build table data with all ratings as separate fields
  const tableData = (participants || []).map((p: any) => {
    const status = vcEntryMap.get(p.participantId) || '';
    const row: any = {
      participantId: p.participantId,
      participantName: p.participantName,
      participant: p,
      entryStatus: status,
      _statusRank: statusSortRank(status),
      roundEliminated: eliminationRounds.get(p.participantId) || '-',
    };
    for (const scaleName of availableRatings) {
      const rp = ratingsParameters[scaleName];
      const entry = p.ratings?.[SINGLES]?.find((r: any) => r.scaleName === scaleName);
      const sv = entry?.scaleValue;
      const val = sv == null ? undefined : typeof sv === 'object' && rp?.accessor ? sv[rp.accessor] : sv;
      row[`rating_${scaleName}`] = val == null ? undefined : +Number(val).toFixed(rp?.decimalsCount ?? 2);
    }
    return row;
  });

  // ── State ──
  let matchUpFormat = tournamentEngine.getEvent({ drawId })?.drawDefinition?.matchUpFormat || '';
  let drawType = SINGLE_ELIMINATION;
  let selectedRating = availableRatings[0] || '';
  let groupSize = 4;
  let automated = true;
  let teamAvoidance = true;
  let table: any;

  // ── Single panel container ──
  const panel = document.createElement('div');
  panel.style.cssText = 'width:100%';

  const controlEl = document.createElement('div');
  panel.appendChild(controlEl);

  const tableEl = document.createElement('div');
  panel.appendChild(tableEl);

  drawsView.appendChild(panel);

  // ── Entry status chip formatter ──
  const entryStatusFormatter = (_cell: any) => {
    const status = _cell.getValue();
    const chip = STATUS_CHIPS[status];
    if (!chip) return '';
    return `<span class="tag ${chip.intent}" style="font-size:0.75em;font-weight:600">${chip.label}</span>`;
  };

  // ── Helpers ──
  const getAcceptedCount = () => {
    let count = 0;
    vcEntryMap.forEach((status) => {
      if (status === DIRECT_ACCEPTANCE) count++;
    });
    return count;
  };

  const getDrawSize = () => {
    const accepted = getAcceptedCount();
    if (accepted === 0) return 0;
    if (drawType === ROUND_ROBIN || drawType === AD_HOC) return accepted;
    if (drawType === LUCKY_DRAW) return accepted % 2 === 0 ? accepted : accepted + 1;
    return tools.nextPowerOf2(accepted);
  };

  const highlightRatingColumn = () => {
    if (!table) return;
    for (const col of table.getColumns()) {
      const field = col.getField();
      if (field?.startsWith('rating_')) {
        const el = col.getElement();
        if (field === `rating_${selectedRating}` && drawType === AD_HOC) {
          el.style.backgroundColor = 'var(--tmx-accent-blue-transparent, rgba(50,115,220,0.15))';
        } else {
          el.style.backgroundColor = '';
        }
      }
    }
  };

  const getDrawTypeOptions = () =>
    DRAW_TYPE_OPTIONS.map((opt) => ({
      label: opt.label,
      onClick: () => {
        drawType = opt.value;
        renderControlBar();
        updateGenerateState();
        highlightRatingColumn();
      },
      close: true,
    }));

  const getRatingOptions = () =>
    availableRatings.map((scaleName) => ({
      label: scaleName,
      onClick: () => {
        selectedRating = scaleName;
        highlightRatingColumn();
        renderControlBar();
      },
      close: true,
    }));

  const getGroupSizeOptions = () => {
    const accepted = getAcceptedCount();
    const { validGroupSizes } = tournamentEngine.getValidGroupSizes({ drawSize: accepted || 4, groupSizeLimit: 8 });
    return (validGroupSizes || [3, 4, 5, 6, 7, 8]).map((size) => ({
      label: `Groups of ${size}`,
      onClick: () => {
        groupSize = size;
        renderControlBar();
      },
      close: true,
    }));
  };

  const formatButtonClick = () => {
    (getMatchUpFormatModal as any)({
      existingMatchUpFormat: matchUpFormat,
      config: { labels: getMatchFormatLabels() },
      modalConfig: { style: { fontSize: '12px', border: '3px solid var(--tmx-border-focus)' } },
      callback: (format: string) => {
        if (format) {
          matchUpFormat = format;
          renderControlBar();
        }
      },
    });
  };

  // ── Overlay actions ──
  const refreshTableStatuses = () => {
    refreshVcEntryMap();
    if (!table) return;
    for (const row of table.getRows()) {
      const data = row.getData();
      const newStatus = vcEntryMap.get(data.participantId) || '';
      if (data.entryStatus !== newStatus) {
        row.update({ entryStatus: newStatus, _statusRank: statusSortRank(newStatus) });
      }
    }
  };

  // Build mutation methods that wipe all VC entries then re-add with correct statuses.
  // This is necessary because factory mutations like REMOVE_DRAW_ENTRIES and
  // MODIFY_ENTRIES_STATUS (WITHDRAWN) are not scoped by entryStage — they affect
  // entries across all stages. REMOVE_STAGE_ENTRIES IS stage-scoped, so we use it
  // to clear the VC slate, then ADD_DRAW_ENTRIES to rebuild with the desired statuses.
  const buildVcEntryMethods = (desired: Map<string, string>) => {
    const methods: any[] = [{ method: REMOVE_STAGE_ENTRIES, params: { drawId, entryStage: VOLUNTARY_CONSOLATION } }];

    // Group participantIds by entryStatus for batch ADD_DRAW_ENTRIES calls
    const byStatus = new Map<string, string[]>();
    desired.forEach((status, pid) => {
      const list = byStatus.get(status) || [];
      list.push(pid);
      byStatus.set(status, list);
    });

    byStatus.forEach((participantIds, entryStatus) => {
      methods.push({
        method: ADD_DRAW_ENTRIES,
        params: {
          entryStage: VOLUNTARY_CONSOLATION,
          ignoreStageSpace: true,
          participantIds,
          entryStatus,
          eventId,
          drawId,
        },
      });
    });

    return methods;
  };

  const afterOverlayMutation = (result: any, errorLabel: string) => {
    if (result.success) {
      table.deselectRow();
      refreshTableStatuses();
      applySort();
      renderControlBar();
    } else {
      logMutationError(errorLabel, result);
    }
  };

  const setEntryStatus = (entryStatus: string) => {
    const selected = table.getSelectedData();
    if (!selected.length) return;

    const selectedIds = new Set<string>(selected.map((p: any) => p.participantId));

    // Start with current VC entries, then apply the change for selected participants
    const desired = new Map(vcEntryMap);
    selectedIds.forEach((pid) => desired.set(pid, entryStatus));

    mutationRequest({
      methods: buildVcEntryMethods(desired),
      callback: (result: any) => afterOverlayMutation(result, 'voluntaryConsolation:setEntryStatus'),
    });
  };

  const clearEntryStatus = () => {
    const selected = table.getSelectedData();
    const idsToRemove = selected.filter((p: any) => vcEntryMap.has(p.participantId)).map((p: any) => p.participantId);

    if (!idsToRemove.length) {
      table.deselectRow();
      return;
    }

    // Start with current VC entries, then remove the selected participants
    const desired = new Map(vcEntryMap);
    idsToRemove.forEach((pid) => desired.delete(pid));

    mutationRequest({
      methods: buildVcEntryMethods(desired),
      callback: (result: any) => afterOverlayMutation(result, 'voluntaryConsolation:clearEntryStatus'),
    });
  };

  // ── Generate ──
  const onGenerate = () => {
    const acceptedCount = getAcceptedCount();
    if (acceptedCount < 2) return;

    const ddEntries = tournamentEngine.getEvent({ drawId })?.drawDefinition?.entries || [];
    const vcEntries = ddEntries.filter((e: any) => e.entryStage === VOLUNTARY_CONSOLATION);
    console.log('onGenerate', {
      acceptedCount,
      vcEntryMap: Object.fromEntries(vcEntryMap),
      vcEntriesInEngine: vcEntries.map((e: any) => ({ pid: e.participantId, status: e.entryStatus })),
      totalDrawEntries: ddEntries.length,
    });

    const structureOptions = drawType === ROUND_ROBIN ? { groupSize } : undefined;

    const genResult = tournamentEngine.generateVoluntaryConsolation({
      structureName: structure.structureName,
      matchUpFormat: matchUpFormat || undefined,
      attachConsolation: false,
      automated,
      structureOptions,
      drawType,
      drawId,
    });

    if (genResult.error) {
      logMutationError('voluntaryConsolation:generate', genResult);
      return;
    }

    const methods: any[] = [
      {
        method: ATTACH_CONSOLATION_STRUCTURES,
        params: { structures: genResult.structures, links: genResult.links, drawId },
      },
    ];

    if (drawType === ROUND_ROBIN) {
      methods.push({
        method: ADD_DRAW_DEFINITION_EXTENSION,
        params: {
          drawId,
          extension: { name: 'voluntaryConsolationConfig', value: { drawType: ROUND_ROBIN, groupSize } },
        },
      });
    }

    mutationRequest({
      methods,
      callback: (attachResult: any) => {
        if (!attachResult.success) {
          logMutationError('voluntaryConsolation:attach', attachResult);
          return;
        }

        if (drawType === AD_HOC) {
          const acceptedIds = [...vcEntryMap.entries()]
            .filter(([, status]) => status === DIRECT_ACCEPTANCE)
            .map(([id]) => id);
          generateFirstAdHocRound({
            structureId: genResult.structures[0].structureId,
            participantIds: acceptedIds,
          });
        } else {
          toastStructureAdded();
          callback?.({ refresh: true });
        }
      },
    });
  };

  const generateFirstAdHocRound = ({ structureId: vcStructureId, participantIds }: any) => {
    const { accessor: scaleAccessor, scaleName } = scalesMap[selectedRating] ?? {};

    const drawMaticResult = tournamentEngine.drawMatic({
      updateParticipantRatings: true,
      structureId: vcStructureId,
      participantIds,
      scaleAccessor,
      scaleName,
      drawId,
      ...(teamAvoidance === false && { sameTeamValue: 0 }),
    });

    if (!drawMaticResult.matchUps?.length) {
      toastStructureAdded();
      callback?.({ refresh: true });
      return;
    }

    const roundMethods: any[] = [
      {
        method: ADD_ADHOC_MATCHUPS,
        params: { structureId: vcStructureId, matchUps: drawMaticResult.matchUps, drawId },
      },
    ];

    for (const roundResult of drawMaticResult.roundResults || []) {
      const modifiedScaleValues = roundResult?.modifiedScaleValues;
      if (modifiedScaleValues && Object.keys(modifiedScaleValues).length) {
        roundMethods.push({
          method: ADD_DYNAMIC_RATINGS,
          params: { modifiedScaleValues, replacePriorValues: true },
        });
      }
    }

    mutationRequest({
      methods: roundMethods,
      callback: (result: any) => {
        if (result.success) {
          toastStructureAdded();
          callback?.({ refresh: true });
        } else {
          logMutationError('voluntaryConsolation:adHocRound', result);
        }
      },
    });
  };

  // ── Control bar ──
  const updateGenerateState = () => {
    const btn = document.getElementById('vcGenerate') as HTMLButtonElement;
    const accepted = getAcceptedCount();
    if (btn) btn.disabled = accepted < 2 || (drawType === ROUND_ROBIN && accepted < 3);
  };

  // ── Search / filter ──
  let searchFilter = '';

  const applySearchFilter = (value: string) => {
    searchFilter = value.toLowerCase();
    if (!table) return;
    if (searchFilter) {
      table.setFilter((row: any) => row.participantName?.toLowerCase().includes(searchFilter));
    } else {
      table.clearFilter();
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent) => {
    const input = e.target as HTMLInputElement;
    if (e.key === 'Backspace' && input.value.length === 1) applySearchFilter('');
    if (e.key === 'Enter') {
      e.preventDefault();
      const visibleRows = table?.getRows('active') || [];
      if (visibleRows.length === 1) {
        visibleRows[0].toggleSelect();
        input.value = '';
        applySearchFilter('');
      }
    }
  };

  const renderControlBar = () => {
    const drawSize = getDrawSize();
    const drawSizeLabel = drawSize ? `Draw: ${drawSize}` : 'Draw: -';
    const isRR = drawType === ROUND_ROBIN;

    const leftItems: any[] = [
      {
        onKeyDown: handleSearchKeyDown,
        onChange: (e: Event) => applySearchFilter((e.target as HTMLInputElement).value),
        onKeyUp: (e: Event) => applySearchFilter((e.target as HTMLInputElement).value),
        clearSearch: () => applySearchFilter(''),
        placeholder: 'Participant name',
        id: 'vcSearch',
        location: LEFT,
        search: true,
      },
      {
        options: getDrawTypeOptions(),
        label: DRAW_TYPE_OPTIONS.find((o) => o.value === drawType)?.label || 'Draw Type',
        selection: false,
        location: LEFT,
      },
    ];

    if (drawType !== AD_HOC) {
      leftItems.push({
        label: `Automated: ${automated ? 'On' : 'Off'}`,
        onClick: () => {
          automated = !automated;
          renderControlBar();
        },
        intent: automated ? 'is-info' : 'is-light',
        location: LEFT,
      });
    }

    if (isRR) {
      leftItems.push({
        options: getGroupSizeOptions(),
        label: `Groups of ${groupSize}`,
        selection: false,
        location: LEFT,
      });
    }

    if (drawType === AD_HOC) {
      leftItems.push({
        label: `Team Avoidance: ${teamAvoidance ? 'On' : 'Off'}`,
        onClick: () => {
          teamAvoidance = !teamAvoidance;
          renderControlBar();
        },
        intent: teamAvoidance ? 'is-info' : 'is-light',
        location: LEFT,
      });

      if (availableRatings.length) {
        leftItems.push({
          options: getRatingOptions(),
          label: selectedRating || 'Level of play',
          selection: false,
          location: LEFT,
        });
      }
    }

    leftItems.push(
      {
        label: drawSizeLabel,
        intent: 'is-light',
        location: LEFT,
      },
      {
        label: matchUpFormat || 'Set format...',
        onClick: formatButtonClick,
        intent: 'is-light',
        location: LEFT,
      },
    );

    // OVERLAY items — visible when rows are selected
    const overlayItems: any[] = [
      {
        label: 'Accepted',
        intent: IS_SUCCESS,
        onClick: () => setEntryStatus(DIRECT_ACCEPTANCE),
        location: OVERLAY,
      },
      {
        label: 'Alternate',
        intent: 'is-warning',
        onClick: () => setEntryStatus(ALTERNATE),
        location: OVERLAY,
      },
      {
        label: 'Withdrawn',
        intent: 'is-danger',
        onClick: () => setEntryStatus(WITHDRAWN),
        location: OVERLAY,
      },
      {
        label: 'Clear',
        intent: 'is-light',
        onClick: clearEntryStatus,
        location: OVERLAY,
      },
    ];

    controlBar({
      table,
      target: controlEl,
      items: [
        ...leftItems,
        ...overlayItems,
        {
          onClick: onGenerate,
          label: 'Generate Consolation',
          id: 'vcGenerate',
          intent: 'is-info',
          location: RIGHT,
        },
      ],
    });

    // Let the LEFT section grow to fill available space without wrapping
    const left = controlEl.querySelector('.options_left') as HTMLElement;
    if (left) {
      left.style.flexGrow = '1';
      left.style.flexWrap = 'nowrap';
    }

    // Widen search field
    const searchInput = document.getElementById('vcSearch') as HTMLInputElement;
    if (searchInput) searchInput.style.width = '16em';

    updateGenerateState();
  };

  // ── Grouped sort: status group always primary, user column secondary ──
  let secondarySortField = '';
  let secondarySortDir: 'asc' | 'desc' = 'asc';

  // Custom sorter for the hidden _statusRank column — Tabulator calls this
  // per-pair and passes full row objects, so we can do grouped + secondary sort.
  const groupedSorter = (_a: any, _b: any, aRow: any, bRow: any) => {
    const dataA = aRow.getData();
    const dataB = bRow.getData();

    const rankA = statusSortRank(dataA.entryStatus || '');
    const rankB = statusSortRank(dataB.entryStatus || '');
    if (rankA !== rankB) return rankA - rankB;

    if (!secondarySortField) return 0;
    const valA = dataA[secondarySortField];
    const valB = dataB[secondarySortField];
    if (valA == null && valB == null) return 0;
    if (valA == null) return 1;
    if (valB == null) return -1;

    let cmp: number;
    if (typeof valA === 'number' && typeof valB === 'number') {
      cmp = valA - valB;
    } else {
      cmp = String(valA).localeCompare(String(valB));
    }
    return secondarySortDir === 'desc' ? -cmp : cmp;
  };

  const applySort = () => {
    if (!table) return;
    table.setSort([{ column: '_statusRank', dir: 'asc' }]);
  };

  // ── Tabulator (created BEFORE controlBar so table ref is available) ──
  table = new Tabulator(tableEl, {
    data: tableData,
    layout: 'fitColumns',
    height: `${Math.floor(window.innerHeight * 0.6)}px`,
    selectableRows: true,
    columns: [
      {
        titleFormatter: 'rowSelection',
        formatter: 'rowSelection',
        cellClick: (_: Event, cell: any) => cell.getRow().toggleSelect(),
        headerSort: false,
        width: 40,
      },
      {
        title: 'Participant',
        field: 'participantName',
        formatter: formatParticipant(undefined),
        headerSort: false,
        widthGrow: 3,
      },
      {
        title: 'Status',
        field: 'entryStatus',
        formatter: entryStatusFormatter,
        hozAlign: 'center',
        headerHozAlign: 'center',
        headerSort: false,
        width: 100,
      },
      {
        field: '_statusRank',
        sorter: groupedSorter,
        visible: false,
      },
      ...availableRatings.map((scaleName) => ({
        title: scaleName,
        field: `rating_${scaleName}`,
        hozAlign: 'center',
        headerHozAlign: 'center',
        headerSort: false,
        width: 80,
      })),
      {
        title: 'Eliminated',
        field: 'roundEliminated',
        hozAlign: 'center',
        headerHozAlign: 'center',
        headerSort: false,
        widthGrow: 1,
      },
    ],
  });

  context.tables.vcParticipants = table;

  // Header clicks set secondary sort field, then re-trigger grouped sort.
  // Status column click resets to baseline (status-only sort).
  table.on('headerClick', (_e: Event, column: any) => {
    const field = column.getField();
    if (!field) return;
    if (field === 'entryStatus') {
      secondarySortField = '';
      secondarySortDir = 'asc';
    } else if (secondarySortField === field) {
      secondarySortDir = secondarySortDir === 'asc' ? 'desc' : 'asc';
    } else {
      secondarySortField = field;
      secondarySortDir = 'asc';
    }
    applySort();
  });

  table.on('tableBuilt', () => {
    applySort();
    renderControlBar();
    highlightRatingColumn();
  });
}

// ── Pure helpers ──

function getEliminationRounds(drawId: string, eligibleIds: Set<string>): Map<string, string> {
  const result = new Map<string, string>();
  const { matchUps } = tournamentEngine.allDrawMatchUps({
    contextFilters: { stages: [MAIN, PLAY_OFF, QUALIFYING] },
    drawId,
  });

  for (const matchUp of matchUps || []) {
    if (!matchUp.winningSide) continue;
    const losingSide = matchUp.sides?.find((s: any) => s.sideNumber !== matchUp.winningSide);
    const pid = losingSide?.participant?.participantId;
    if (pid && eligibleIds.has(pid) && !result.has(pid)) {
      result.set(pid, matchUp.roundName || `R${matchUp.roundNumber}`);
    }
  }
  return result;
}
