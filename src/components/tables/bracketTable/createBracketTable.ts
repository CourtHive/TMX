import { eventControlBar } from 'pages/tournament/tabs/eventsTab/renderDraws/eventControlBar/eventControlBar';
import { selectPositionAction } from 'components/popovers/selectPositionAction';
import { renderDrawView } from 'pages/tournament/tabs/eventsTab/renderDraws/renderDrawView';
import { drawControlBar } from 'pages/tournament/tabs/eventsTab/renderDraws/drawControlBar';
import { cleanupDrawPanel } from 'pages/tournament/tabs/eventsTab/cleanupDrawPanel';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'pages/tournament/destroyTable';
import { tournamentEngine, scoreGovernor, fixtures } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { getBracketColumns, attachHeaderTooltip } from './getBracketColumns';
import { getBracketData } from './getBracketData';

import { DRAWS_VIEW, ROUNDS_BRACKET } from 'constants/tmxConstants';

const BRACKET_STYLE_ID = 'bracket-table-style';
function ensureBracketStyles() {
  if (document.getElementById(BRACKET_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BRACKET_STYLE_ID;
  style.textContent = `
    .bracket-table .tabulator-cell {
      border-right: 1px solid #ddd;
    }
    .bracket-table .tabulator-col {
      border-right: 1px solid #ddd;
    }
  `;
  document.head.appendChild(style);
}

type CreateBracketTableParams = {
  structureId: string;
  eventId: string;
  drawId: string;
};

type CreateBracketTableResult = {
  replaceTableData: (params?: { participantFilter?: string }) => void;
  tables: any[];
};

export async function createBracketTable({
  structureId,
  eventId,
  drawId,
}: CreateBracketTableParams): Promise<CreateBracketTableResult> {
  let participantFilter: string | undefined;
  let participantMap: Record<string, any>;
  let structure: any;
  let tables: any[] = [];

  // Map from groupId to its Tabulator instance
  const tablesByGroup: Record<string, any> = {};

  const getParticipantMap = (participants: any[]) =>
    (participants ?? []).reduce((map: Record<string, any>, participant: any) => {
      map[participant.participantId] = participant;
      return map;
    }, {});

  const getData = () => {
    const { participants, eventData } = tournamentEngine.getEventData({
      participantFilters: { eventIds: [eventId], positionedParticipants: true },
      participantsProfile: { withScaleValues: true },
      allParticipantResults: true,
      pressureRating: true,
      refreshResults: true,
      eventId,
    });
    const drawData = eventData?.drawsData?.find((data: any) => data.drawId === drawId);
    structure = drawData?.structures?.find((s: any) => s.structureId === structureId);

    if (!participantMap) participantMap = getParticipantMap(participants);

    const participantResults = (structure?.participantResults ?? []).filter((pr: any) => {
      if (!participantFilter) return true;
      const participant = participantMap[pr.participantId];
      return participant?.participantName?.toLowerCase().includes(participantFilter.toLowerCase());
    });

    return getBracketData({ structure, participantMap, participantResults, drawId });
  };

  // Re-fetch data and update specific rows in place by drawPosition
  const updateRows = async (drawPositions: number[]) => {
    const posSet = new Set(drawPositions);
    const groups = getData();
    for (const group of groups) {
      const table = tablesByGroup[group.groupId];
      if (!table) continue;

      // Update column headers for participants whose names may have changed
      const participantByField: Record<string, { participantName: string }> = {};
      for (const p of group.participants) {
        participantByField[`opponent_${p.participantId}`] = p;
      }
      for (const col of table.getColumns()) {
        const def = col.getDefinition();
        const p = participantByField[def.field];
        if (p) {
          const newTitle = p.participantName || String(def.title);
          if (def.title !== newTitle) {
            const updatedCol = await table.updateColumnDefinition(def.field, { title: newTitle });
            if (updatedCol && p.participantName) {
              attachHeaderTooltip(updatedCol, p.participantName);
            }
          }
        }
      }

      const newRowMap: Record<number, any> = {};
      for (const row of group.rows) {
        newRowMap[row.drawPosition] = row;
      }

      for (const row of table.getRows()) {
        const data = row.getData();
        if (posSet.has(data.drawPosition) && newRowMap[data.drawPosition]) {
          row.update(newRowMap[data.drawPosition]);
        }
      }
    }
  };

  // After scoring, update all rows in the affected group (stats change for everyone)
  const updateGroupAfterScore = (matchUpId: string) => {
    // Find which group contains this matchUp and update all its rows
    for (const [, table] of Object.entries(tablesByGroup)) {
      const allPositions: number[] = [];
      let found = false;
      for (const row of table.getRows()) {
        const data = row.getData();
        allPositions.push(data.drawPosition);
        if (!found) {
          found = Object.keys(data).some(
            (key) => key.startsWith('opponent_') && data[key]?.matchUpId === matchUpId,
          );
        }
      }
      if (found) {
        updateRows(allPositions);
        return;
      }
    }
  };

  const scoreClick = (_: any, cell: any) => {
    const value = cell.getValue();
    if (!value || value.self) return;
    if (value.readyToScore || scoreGovernor.checkScoreHasValue(value.matchUp)) {
      enterMatchUpScore({
        matchUp: value.matchUp,
        matchUpId: value.matchUpId,
        callback: (result: any) => {
          if (result.success) {
            updateGroupAfterScore(value.matchUpId);
          }
        },
      });
    }
  };

  // Participant name click: open position actions tipster for assignment/swap/etc.
  const participantClick = (e: any, cell: any) => {
    const row = cell.getRow();
    const data = row.getData();
    const childStructureId = data.structureId;
    const drawPosition = data.drawPosition;
    if (!childStructureId || !drawPosition) return;

    // Find a matchUp in this group to get context
    const allMatchUps: any[] = Object.values(structure?.roundMatchUps ?? {}).flat();
    const matchUp = allMatchUps.find(
      (mu: any) => mu.structureId === childStructureId && mu.sides?.some((s: any) => s.drawPosition === drawPosition),
    );
    if (!matchUp) return;

    const side = matchUp.sides?.find((s: any) => s.drawPosition === drawPosition);
    const sideNumber = side?.sideNumber;

    const { validActions: actions } =
      tournamentEngine.positionActions({
        structureId: childStructureId,
        matchUpId: matchUp.matchUpId,
        drawId,
        drawPosition,
        sideNumber,
        policyDefinitions: {
          ...fixtures.policies.POLICY_POSITION_ACTIONS_UNRESTRICTED,
        },
      }) || {};

    if (actions?.length) {
      const pointerEvent = e instanceof PointerEvent ? e : e?.target ? e : undefined;
      selectPositionAction({
        pointerEvent: pointerEvent as PointerEvent,
        actions,
        callback: () => updateRows([drawPosition]),
      });
    }
  };

  const render = () => {
    destroyTable({ anchorId: DRAWS_VIEW });
    const element = document.getElementById(DRAWS_VIEW);
    if (!element) return;

    element.innerHTML = '';

    const groups = getData();
    tables = [];

    for (const group of groups) {
      if (groups.length > 1) {
        const header = document.createElement('div');
        header.style.cssText = 'font-weight:bold;font-size:1.1em;padding:8px 4px 4px;';
        header.textContent = group.groupName;
        element.appendChild(header);
      }

      ensureBracketStyles();
      const tableDiv = document.createElement('div');
      tableDiv.classList.add('bracket-table');
      element.appendChild(tableDiv);

      const columns = getBracketColumns({
        participants: group.participants,
        participantClick,
        scoreClick,
        eventId,
        drawId,
        structureId,
      });
      const table = new Tabulator(tableDiv, {
        height: groups.length > 1 ? undefined : window.innerHeight * 0.85,
        placeholder: 'No participants',
        layout: 'fitData',
        headerSort: false,
        data: group.rows,
        columns,
      });

      // Attach header tooltips for opponent columns after table renders
      table.on('tableBuilt', () => {
        for (const col of table.getColumns()) {
          const def = col.getDefinition();
          if (def.field?.startsWith('opponent_')) {
            const participant = group.participants.find((p) => `opponent_${p.participantId}` === def.field);
            if (participant?.participantName) {
              attachHeaderTooltip(col, participant.participantName);
            }
          }
        }
      });

      tables.push(table);
      tablesByGroup[group.groupId] = table;
    }
  };

  const replaceTableData = (params?: { participantFilter?: string }) => {
    if (params?.participantFilter !== undefined) participantFilter = params.participantFilter;
    render();
  };

  render();

  const callback = ({ refresh, view }: { refresh?: boolean; view?: string } = {}) => {
    cleanupDrawPanel();
    if (view) {
      navigateToEvent({ eventId, drawId, structureId, renderDraw: true, view });
    } else {
      renderDrawView({ eventId, drawId, structureId, redraw: refresh, roundsView: view });
    }
  };

  drawControlBar({ structure, drawId, existingView: ROUNDS_BRACKET, callback, updateDisplay: replaceTableData });
  eventControlBar({ eventId, drawId, structureId, updateDisplay: replaceTableData });

  return { tables, replaceTableData };
}
