import { eventControlBar } from 'pages/tournament/tabs/eventsTab/renderDraws/eventControlBar/eventControlBar';
import { renderDrawView } from 'pages/tournament/tabs/eventsTab/renderDraws/renderDrawView';
import { drawControlBar } from 'pages/tournament/tabs/eventsTab/renderDraws/drawControlBar';
import { tournamentEngine } from 'services/factory/engine';
import { scoreGovernor, fixtures } from 'tods-competition-factory';
import { cleanupDrawPanel } from 'pages/tournament/tabs/eventsTab/cleanupDrawPanel';
import { showTallyReportModal } from 'components/modals/tallyReportModal';
import { selectPositionAction } from 'components/popovers/selectPositionAction';
import { getBracketColumns, attachHeaderTooltip } from './getBracketColumns';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'pages/tournament/destroyTable';
import { navigateToEvent } from '../common/navigateToEvent';
import { getBracketData } from './getBracketData';
import { displayConfig } from 'config/displayConfig';

// constants
import { DRAWS_VIEW, ROUNDS_BRACKET } from 'constants/tmxConstants';

/** Flatten all matchUps across rounds in a structure. */
function getStructureMatchUps(structure: any): any[] {
  return Object.values(structure?.roundMatchUps ?? {}).flat();
}

/** True when every matchUp in a group has a winner or is a BYE. */
function isGroupComplete(structureMatchUps: any[], groupId: string): boolean {
  const groupMatchUps = structureMatchUps.filter((mu: any) => mu.structureId === groupId);
  return groupMatchUps.length > 0 && groupMatchUps.every((mu: any) => mu.winningSide || mu.matchUpStatus === 'BYE');
}

/** Walk the raw drawDefinition's structure tree (CONTAINER -> ITEM groups,
 *  or a flat list of ITEM structures) and return the leaf group structures
 *  keyed by structureId. Used to read each group's positionAssignments —
 *  the projected structure from `getEventData()` is flat and drops the
 *  child structures, so resolving from `getEventData` returns nothing for
 *  the CONTAINER case (which is exactly the round-robin shape we care about
 *  here, and was producing false-amber bars in the Grid view). */
function leafStructuresByGroupId(drawDefinition: any): Record<string, any> {
  const leaves = (drawDefinition?.structures ?? []).flatMap((s: any) =>
    s?.structures?.length ? s.structures : [s],
  );
  const byId: Record<string, any> = {};
  for (const g of leaves) {
    if (g?.structureId) byId[g.structureId] = g;
  }
  return byId;
}

/** True when at least one positionAssignment in the group carries a saved tally
 *  (first-class `tally` field per the CODES schema, or the legacy `tally`
 *  extension). Used to distinguish "complete" from "complete-but-stale" — the
 *  state created when matchUps were imported with scores already populated
 *  and the auto-tally save path never fired. */
function hasGroupTally(groupStructure: any): boolean {
  const assignments = groupStructure?.positionAssignments ?? [];
  return assignments.some(
    (a: any) => a?.tally !== undefined || (a?.extensions ?? []).some((ext: any) => ext?.name === 'tally'),
  );
}

/** Toggle both `rr-group-complete` and `rr-group-stale` on a container based
 *  on the matchUp completion + tally state for the given group. */
function applyRRGroupClasses(
  container: HTMLElement,
  groupsById: Record<string, any>,
  structureMatchUps: any[],
  groupId: string,
): void {
  const complete = isGroupComplete(structureMatchUps, groupId);
  const stale = complete && !hasGroupTally(groupsById[groupId]);
  container.classList.toggle('rr-group-stale', stale);
  container.classList.toggle('rr-group-complete', complete && !stale);
}

const BRACKET_STYLE_ID = 'bracket-table-style';
function ensureBracketStyles() {
  if (document.getElementById(BRACKET_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BRACKET_STYLE_ID;
  style.textContent = `
    .bracket-table .tabulator-cell {
      border-right: 1px solid var(--tmx-tab-border);
    }
    .bracket-table .tabulator-col {
      border-right: 1px solid var(--tmx-tab-border);
    }
    .bracket-table .tabulator {
      /* fitDataTable already sets display:inline-block; max-width keeps
       * a wider-than-viewport table from overflowing horizontally. */
      max-width: 100%;
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

  // Map from groupId to its Tabulator instance and container element
  const tablesByGroup: Record<string, any> = {};
  const containersByGroup: Record<string, HTMLElement> = {};

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

    if (!participantMap) participantMap = getParticipantMap(participants ?? []);

    const participantResults = (structure?.participantResults ?? []).filter((pr: any) => {
      if (!participantFilter) return true;
      const participant = participantMap[pr.participantId];
      return participant?.participantName?.toLowerCase().includes(participantFilter.toLowerCase());
    });

    return getBracketData({ structure, participantMap, participantResults, drawId });
  };

  // Re-fetch data and update specific rows in place by drawPosition
  const updateRows = (drawPositions: number[]): void => {
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
            table.updateColumnDefinition(def.field, { title: newTitle }).then((updatedCol: any) => {
              if (updatedCol && p.participantName) {
                attachHeaderTooltip(updatedCol, p.participantName);
              }
            });
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

  // Re-evaluate completion / stale accent for a specific group. Resolves
  // the raw group structure (with positionAssignments + tally) on every
  // call so post-mutation state shows up — the `structure` closure from
  // getEventData is a flat projection without child structures, so a
  // tally check against it always reports stale for CONTAINERs.
  const refreshGroupHighlight = (groupId: string) => {
    const container = containersByGroup[groupId];
    if (!container) return;
    const drawDefinition = tournamentEngine.q.drawDefinition({ drawId });
    applyRRGroupClasses(container, leafStructuresByGroupId(drawDefinition), getStructureMatchUps(structure), groupId);
  };

  // After scoring, update all rows in the affected group (stats change for everyone)
  const updateGroupAfterScore = (matchUpId: string) => {
    for (const [groupId, table] of Object.entries(tablesByGroup)) {
      const rows = table.getRows();
      const hasMatchUp = rows.some((row: any) => {
        const data = row.getData();
        return Object.keys(data).some((key) => key.startsWith('opponent_') && data[key]?.matchUpId === matchUpId);
      });
      if (hasMatchUp) {
        updateRows(rows.map((row: any) => row.getData().drawPosition));
        refreshGroupHighlight(groupId);
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
    const matchUp = getStructureMatchUps(structure).find(
      (mu: any) => mu.structureId === childStructureId && mu.sides?.some((s: any) => s.drawPosition === drawPosition),
    );
    if (!matchUp) return;

    const { validActions: actions } =
      tournamentEngine.positionActions({
        structureId: childStructureId,
        matchUpId: matchUp.matchUpId,
        drawId,
        drawPosition,
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

    const allMatchUps = getStructureMatchUps(structure);
    // Read group structures (and their positionAssignments + tally) off
    // the raw drawDefinition — getEventData's projection drops these.
    const groupsById = leafStructuresByGroupId(tournamentEngine.q.drawDefinition({ drawId }));

    for (const group of groups) {
      // Wrap each group's header + table in a container for the accent bar.
      // flex-column + align-items:flex-start stacks the title and the
      // (now display:inline-block, courtesy of fitDataTable) Tabulator
      // vertically while letting each child stay at its own natural width
      // — without this they sit side-by-side and the title "falls" next
      // to the table.
      const groupContainer = document.createElement('div');
      applyRRGroupClasses(groupContainer, groupsById, allMatchUps, group.groupId);
      groupContainer.style.cssText =
        'border-radius:4px; margin-bottom:4px; padding:2px; display:flex; flex-direction:column; align-items:flex-start;';
      element.appendChild(groupContainer);

      if (groups.length > 1) {
        const header = document.createElement('div');
        header.style.cssText = 'font-weight:bold;font-size:1.1em;padding:8px 4px 4px; cursor:pointer; display:inline-block;';
        header.textContent = group.groupName;
        header.title = 'Click to view tiebreak report';
        header.onclick = () => {
          const groupMatchUps = getStructureMatchUps(structure).filter((mu: any) => mu.structureId === group.groupId);
          if (groupMatchUps.length) {
            showTallyReportModal({ groupMatchUps, groupName: group.groupName, eventId, drawId });
          }
        };
        groupContainer.appendChild(header);
      }

      ensureBracketStyles();
      const tableDiv = document.createElement('div');
      tableDiv.classList.add('bracket-table');
      groupContainer.appendChild(tableDiv);

      const columns = getBracketColumns({
        participants: group.participants,
        participantClick,
        scoreClick,
        updateRows,
        eventId,
        drawId,
        structureId,
      });
      const table = new Tabulator(tableDiv, {
        height: groups.length > 1 ? undefined : window.innerHeight * (displayConfig.get().tableHeightMultiplier ?? 0.85),
        placeholder: 'No participants',
        // fitDataTable (instead of fitData) makes the `.tabulator` root
        // display:inline-block, so it shrinks to the column row's width
        // and the header's bottom border stops at the rightmost column
        // instead of running across the screen. Same column sizing as
        // fitData otherwise.
        layout: 'fitDataTable',
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
      containersByGroup[group.groupId] = groupContainer;
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
