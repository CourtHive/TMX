import { eventControlBar } from 'pages/tournament/tabs/eventsTab/renderDraws/eventControlBar/eventControlBar';
import { renderDrawView } from 'pages/tournament/tabs/eventsTab/renderDraws/renderDrawView';
import { drawControlBar } from 'pages/tournament/tabs/eventsTab/renderDraws/drawControlBar';
import { tournamentEngine, drawDefinitionConstants } from 'tods-competition-factory';
import { cleanupDrawPanel } from 'pages/tournament/tabs/eventsTab/cleanupDrawPanel';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'pages/tournament/destroyTable';
import { roundGroupingHeader } from './roundGroupingHeader';
import { navigateToEvent } from '../common/navigateToEvent';
import { getRoundsColumns } from './getRoundsColumns';
import { mapRound } from './mapRound';

import { DRAWS_VIEW, ROUNDS_TABLE } from 'constants/tmxConstants';
const { CONTAINER } = drawDefinitionConstants;

export async function createRoundsTable({ eventId, drawId, structureId, matchUps, eventData }) {
  let table, structure, participantFilter, isRoundRobin;

  const getMatchUps = async () => {
    // TODO: it is inefficient to call both getEventData and allTournamentMatchUps
    // Can getEventData be modified to return participants array
    const eventData = tournamentEngine.getEventData({ eventId }).eventData;
    const drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);
    structure = drawData?.structures?.find((s) => s.structureId === structureId);
    isRoundRobin = structure?.structureType === CONTAINER;

    // TODO: if both engine methods need to be called, use allEventMatchUps();
    return (
      tournamentEngine.allTournamentMatchUps({
        matchUpFilters: { drawIds: [drawId], structureIds: [structureId] },
        participantsProfile: { withISO2: true, withScaleValues: true },
        contextProfile: { withCompetitiveness: true },
      }).matchUps || []
    )
      .filter(({ matchUpStatus }) => matchUpStatus !== 'BYE')
      .filter(
        ({ sides }) =>
          !participantFilter ||
          sides.find((side) =>
            side.participant?.participantName?.toLowerCase().includes(participantFilter?.toLowerCase()),
          ),
      );
  };

  // eventName necessary for team scorecard
  if (!matchUps) matchUps = await getMatchUps();
  if (eventData) {
    matchUps.forEach((matchUp) => (matchUp.eventName = eventData.eventInfo.eventName));
  }

  const getTableData = () => matchUps.map(mapRound);

  const updateTableData = () => {
    const matchUps = getMatchUps();
    return matchUps.map(mapRound);
  };
  const replaceTableData = (params) => {
    if (params.participantFilter) participantFilter = params.participantFilter;
    table.replaceData(updateTableData());
  };

  const data = getTableData();
  const columns = getRoundsColumns({ data, replaceTableData });
  const groupBy = isRoundRobin ? ['roundName', 'structureName'] : ['roundName'];

  const render = (data) => {
    destroyTable({ anchorId: DRAWS_VIEW });
    const element = document.getElementById(DRAWS_VIEW);

    table = new Tabulator(element, {
      groupHeader: [roundGroupingHeader, (value) => value],
      headerSortElement: headerSortElement(['complete', 'duration', 'score']),
      responsiveLayoutCollapseStartOpen: false,
      height: window.innerHeight * 0.85,
      /*
      groupStartOpen: [
        true, // use function to determine if all matchUps are completed, and if so, start closed
        (a, count, rows, group) => {
          console.log({ count, rows }, group.getField(), group.getKey());
          return a;
        },
      ],
      */
      responsiveLayout: 'collapse',
      // groupUpdateOnCellEdit: true,
      placeholder: 'No matches',
      layout: 'fitColumns',
      reactiveData: true,
      index: 'matchUpId',
      groupBy,
      columns,
      data,
    });
  };

  render(data);

  const callback = ({ refresh, view } = {}) => {
    cleanupDrawPanel();
    if (view) {
      navigateToEvent({ eventId, drawId, structureId, renderDraw: true, view });
    } else {
      renderDrawView({ eventId, drawId, structureId, redraw: refresh, roundsView: view });
    }
  };

  drawControlBar({ structure, drawId, existingView: ROUNDS_TABLE, callback });
  eventControlBar({ eventId, drawId, structureId, updateDisplay: replaceTableData });

  return { table, replaceTableData };
}
