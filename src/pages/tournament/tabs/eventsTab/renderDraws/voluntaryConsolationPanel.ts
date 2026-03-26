/**
 * Inline panel for VOLUNTARY_CONSOLATION structure setup.
 * Renders a controlBar with draw config (LEFT) and actions (RIGHT),
 * followed by an eligible participants table with row selection.
 */
import { formatParticipant } from 'components/tables/common/formatters/participantFormatter';
import { participantSorter } from 'components/tables/common/sorters/participantSorter';
import { getMatchFormatLabels } from 'components/modals/matchFormatLabels';
import { logMutationError } from 'functions/logMutationError';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { scalesMap } from 'config/scalesConfig';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { getMatchUpFormatModal, controlBar } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
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

import {
  ADD_ADHOC_MATCHUPS,
  ADD_DRAW_ENTRIES,
  ADD_DRAW_DEFINITION_EXTENSION,
  ADD_DYNAMIC_RATINGS,
  ATTACH_CONSOLATION_STRUCTURES,
  REMOVE_STAGE_ENTRIES,
  REMOVE_STRUCTURE,
} from 'constants/mutationConstants';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { DRAWS_VIEW, LEFT, RIGHT } from 'constants/tmxConstants';

const { VOLUNTARY_CONSOLATION, ROUND_ROBIN, SINGLE_ELIMINATION, LUCKY_DRAW, AD_HOC } = drawDefinitionConstants;
const { DIRECT_ACCEPTANCE } = entryStatusConstants;

const STRUCTURE_ADDED = 'modals.addConsolation.structureAdded';
const toastStructureAdded = () => tmxToast({ message: t(STRUCTURE_ADDED), intent: 'is-success' });

const DRAW_TYPE_OPTIONS = [
  { label: 'Single Elimination', value: SINGLE_ELIMINATION },
  { label: 'Round Robin', value: ROUND_ROBIN },
  { label: 'Lucky Draw', value: LUCKY_DRAW },
  { label: 'Ad Hoc', value: AD_HOC },
];

type Params = {
  structure: any;
  drawId: string;
  eventId: string;
  callback?: (params?: any) => void;
};

export function voluntaryConsolationPanel({ structure, drawId, eventId, callback }: Params): void {
  const drawsView = document.getElementById(DRAWS_VIEW);
  if (!drawsView) return;

  // Fetch eligible participants
  const eligible = tournamentEngine.getEligibleVoluntaryConsolationParticipants({ drawId });
  const eligibleParticipants = eligible?.eligibleParticipants || [];

  if (!eligibleParticipants.length) {
    const panel = document.createElement('div');
    panel.className = 'flexcol flexcenter';
    panel.style.cssText = 'width:100%;height:300px';
    panel.textContent = t('modals.addConsolation.noEligible') || 'No eligible participants found';
    drawsView.appendChild(panel);
    return;
  }

  const eligibleIds = new Set<string>(eligibleParticipants.map((p: any) => p.participantId));
  const eliminationRounds = getEliminationRounds(drawId, eligibleIds);

  const { participants } = tournamentEngine.getParticipants({
    participantFilters: { participantIds: [...eligibleIds] },
    withScaleValues: true,
  });

  // Discover all rating types present across eligible participants
  const { SINGLES } = factoryConstants.eventConstants;
  const { ratingsParameters } = fixtures;
  const presentRatings = new Set<string>();
  for (const p of participants || []) {
    for (const item of (p as any).ratings?.[SINGLES] || []) {
      if (ratingsParameters[item.scaleName] && !ratingsParameters[item.scaleName].deprecated) {
        presentRatings.add(item.scaleName);
      }
    }
  }
  const availableRatings = [...presentRatings].sort();

  // Build table data with all ratings as separate fields
  const tableData = (participants || []).map((p: any) => {
    const row: any = {
      participantId: p.participantId,
      participantName: p.participantName,
      participant: p,
      roundEliminated: eliminationRounds.get(p.participantId) || '-',
    };
    for (const scaleName of availableRatings) {
      const rp = ratingsParameters[scaleName];
      const entry = p.ratings?.[SINGLES]?.find((r: any) => r.scaleName === scaleName);
      const sv = entry?.scaleValue;
      const val = sv == null ? undefined : typeof sv === 'object' && rp?.accessor ? sv[rp.accessor] : sv;
      row[`rating_${scaleName}`] = val != null ? +Number(val).toFixed(rp?.decimalsCount ?? 2) : undefined;
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

  // ── Single panel container (like generateAdHocRound pattern) ──
  const panel = document.createElement('div');
  panel.style.cssText = 'width:100%';

  // Control bar target
  const controlEl = document.createElement('div');
  panel.appendChild(controlEl);

  // Table target
  const tableEl = document.createElement('div');
  panel.appendChild(tableEl);

  // Append panel to drawsView BEFORE creating controlBar/Tabulator
  drawsView.appendChild(panel);

  // ── Control bar ──
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

  const getDrawSize = () => {
    const selected = table?.getSelectedRows()?.length || 0;
    if (selected === 0) return 0;
    if (drawType === ROUND_ROBIN || drawType === AD_HOC) return selected;
    if (drawType === LUCKY_DRAW) return selected % 2 === 0 ? selected : selected + 1;
    return tools.nextPowerOf2(selected);
  };

  const getGroupSizeOptions = () => {
    const selected = table?.getSelectedRows()?.length || 0;
    const { validGroupSizes } = tournamentEngine.getValidGroupSizes({ drawSize: selected || 4, groupSizeLimit: 8 });
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

  const onGenerate = () => {
    const selectedIds = table.getSelectedRows().map((row: any) => row.getData().participantId);
    if (!selectedIds.length) return;

    mutationRequest({
      methods: [
        {
          method: ADD_DRAW_ENTRIES,
          params: {
            entryStatus: DIRECT_ACCEPTANCE,
            entryStage: VOLUNTARY_CONSOLATION,
            participantIds: selectedIds,
            ignoreStageSpace: true,
            eventId,
            drawId,
          },
        },
      ],
      callback: (entryResult: any) => {
        if (!entryResult.success) {
          logMutationError('voluntaryConsolation:addEntries', entryResult);
          return;
        }

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
              generateFirstAdHocRound({
                structureId: genResult.structures[0].structureId,
                participantIds: selectedIds,
              });
            } else {
              toastStructureAdded();
              callback?.({ refresh: true });
            }
          },
        });
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

  const updateGenerateState = () => {
    renderControlBar();
    const selected = table?.getSelectedRows()?.length || 0;
    const btn = document.getElementById('vcGenerate') as HTMLButtonElement;
    if (btn) btn.disabled = selected < 2 || (drawType === ROUND_ROBIN && selected < 3);
  };

  const renderControlBar = () => {
    const drawSize = getDrawSize();
    const drawSizeLabel = drawSize ? `Draw: ${drawSize}` : 'Draw: -';
    const isRR = drawType === ROUND_ROBIN;

    const leftItems: any[] = [
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

    controlBar({
      target: controlEl,
      items: [
        ...leftItems,
        {
          onClick: () => {
            mutationRequest({
              methods: [
                { method: REMOVE_STAGE_ENTRIES, params: { drawId, entryStage: VOLUNTARY_CONSOLATION } },
                { method: REMOVE_STRUCTURE, params: { drawId, structureId: structure.structureId, force: true } },
              ],
              callback: () => navigateToEvent({ eventId, drawId, renderDraw: true }),
            });
          },
          label: 'Cancel',
          intent: 'is-light',
          location: RIGHT,
        },
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
  };

  renderControlBar();

  // ── Tabulator ──
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
        sorter: participantSorter,
        widthGrow: 3,
      },
      ...availableRatings.map((scaleName) => ({
        title: scaleName,
        field: `rating_${scaleName}`,
        hozAlign: 'center',
        headerHozAlign: 'center',
        sorter: 'number',
        width: 80,
      })),
      {
        title: 'Eliminated',
        field: 'roundEliminated',
        hozAlign: 'center',
        headerHozAlign: 'center',
        widthGrow: 1,
      },
    ],
  });

  context.tables.vcParticipants = table;

  table.on('tableBuilt', () => {
    updateGenerateState();
    highlightRatingColumn();
  });
  table.on('rowSelectionChanged', updateGenerateState);
}

// ── Pure helpers ──

function getEliminationRounds(drawId: string, eligibleIds: Set<string>): Map<string, string> {
  const result = new Map<string, string>();
  const { matchUps } = tournamentEngine.allDrawMatchUps({
    drawId,
    contextFilters: { stages: ['MAIN', 'PLAY_OFF', 'QUALIFYING'] },
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
