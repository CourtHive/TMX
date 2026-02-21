/**
 * Create table for rounds display in event draw.
 * Displays matches grouped by rounds with scoring and scheduling information.
 */
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
import { env } from 'settings/env';

// constants
import { DRAWS_VIEW, ROUNDS_TABLE } from 'constants/tmxConstants';
const { CONTAINER } = drawDefinitionConstants;

export async function createRoundsTable({
  eventId,
  drawId,
  structureId,
  matchUps,
  eventData,
}: {
  eventId: string;
  drawId: string;
  structureId: string;
  matchUps?: any[];
  eventData?: any;
}): Promise<{ table: any; replaceTableData: (params?: { participantFilter?: string }) => void }> {
  let table: any;
  let structure: any;
  let participantFilter: string;
  let isRoundRobin: boolean = false;

  const getMatchUps = () => {
    const participantsProfile = { withISO2: true, withScaleValues: true };
    const contextProfile = { withCompetitiveness: true };
    const eventData = tournamentEngine.getEventData({ eventId, contextProfile, participantsProfile }).eventData;
    const drawData = eventData?.drawsData?.find((data: any) => data.drawId === drawId);
    structure = drawData?.structures?.find((s: any) => s.structureId === structureId);
    isRoundRobin = structure?.structureType === CONTAINER;

    const matchUps = structure?.roundMatchUps ? Object.values(structure?.roundMatchUps || {}).flat() : [];
    const tieMatchUps = matchUps.flatMap((matchUp: any) => matchUp.tieMatchUps || []);
    if (tieMatchUps.length) matchUps.push(...tieMatchUps);

    return matchUps
      .filter(({ matchUpStatus }: any) => matchUpStatus !== 'BYE')
      .filter(
        ({ sides }: any) =>
          !participantFilter ||
          sides.find((side: any) =>
            side.participant?.participantName?.toLowerCase().includes(participantFilter?.toLowerCase()),
          ),
      );
  };

  if (!matchUps) matchUps = getMatchUps();
  if (eventData) {
    matchUps.forEach((matchUp: any) => (matchUp.eventName = eventData.eventInfo.eventName));
  }

  const getTableData = () => matchUps?.map(mapRound);

  const updateTableData = () => {
    const matchUps = getMatchUps();
    return matchUps.map(mapRound);
  };
  const replaceTableData = (params?: { participantFilter?: string }) => {
    if (params?.participantFilter) participantFilter = params.participantFilter;
    table.replaceData(updateTableData());
  };

  const data = getTableData();
  const columns = getRoundsColumns({ data, replaceTableData });
  const groupBy = isRoundRobin ? ['roundName', 'structureName'] : ['roundName'];

  const render = (data: any) => {
    destroyTable({ anchorId: DRAWS_VIEW });
    const element = document.getElementById(DRAWS_VIEW);

    table = new Tabulator(element, {
      groupHeader: [roundGroupingHeader, (value: any) => value],
      headerSortElement: headerSortElement(['complete', 'duration', 'score']),
      responsiveLayoutCollapseStartOpen: false,
      height: window.innerHeight * (env.tableHeightMultiplier ?? 0.85),
      responsiveLayout: 'collapse',
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

  const callback = ({ refresh, view }: { refresh?: boolean; view?: string } = {}) => {
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
