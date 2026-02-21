import { eventControlBar } from 'pages/tournament/tabs/eventsTab/renderDraws/eventControlBar/eventControlBar';
import { renderDrawView } from 'pages/tournament/tabs/eventsTab/renderDraws/renderDrawView';
import { drawControlBar } from 'pages/tournament/tabs/eventsTab/renderDraws/drawControlBar';
import { cleanupDrawPanel } from 'pages/tournament/tabs/eventsTab/cleanupDrawPanel';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { mapParticipantResults } from './mapParticiapantResults';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'pages/tournament/destroyTable';
import { tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { orderSorter } from '../common/sorters/orderSorter';
import { getStatsColumns } from './getStatsColumns';
import { env } from 'settings/env';

// constants
import { DRAWS_VIEW, ROUNDS_STATS } from 'constants/tmxConstants';

type CreateStatsTableParams = {
  structureId: string;
  eventId: string;
  drawId: string;
};

type CreateStatsTableResult = {
  replaceTableData: (params?: { participantFilter?: string }) => void;
  table: any;
};

export async function createStatsTable({
  structureId,
  eventId,
  drawId,
}: CreateStatsTableParams): Promise<CreateStatsTableResult> {
  let participantFilter: string | undefined;
  let participantMap: Record<string, any>;
  let structure: any;
  let table: any;

  const getParticipantMap = (participants: any[]) =>
    (participants ?? []).reduce((map: Record<string, any>, participant: any) => {
      map[participant.participantId] = participant;
      return map;
    }, {});

  const groupNames: Record<string, string> = {};

  const getParticipantResults = () => {
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
    const matchUps = structure?.roundMatchUps ? Object.values(structure.roundMatchUps).flat() : [];
    matchUps.forEach(({ sides, structureName, structureId }: any) => {
      groupNames[structureId] = structureName;
      sides.forEach((side: any) => {
        if (side.participantId) {
          participantMap[side.participantId].groupName = structureName;
        }
      });
    });

    return (structure?.participantResults ?? []).filter((pResults: any) => {
      const participant = participantMap[pResults.participantId];
      return (
        !participantFilter || participant?.participantName?.toLowerCase().includes(participantFilter?.toLowerCase())
      );
    });
  };

  const participantResults = getParticipantResults();
  const getTableData = () =>
    participantResults
      ?.map((participantInfo: any) => mapParticipantResults({ ...participantInfo, participantMap }))
      .sort((a: any, b: any) => orderSorter(a.order, b.order));

  const updateTableData = () =>
    getParticipantResults()?.map((participantInfo: any) =>
      mapParticipantResults({ ...participantInfo, participantMap }),
    );
  const replaceTableData = (params?: { participantFilter?: string }) => {
    if (params?.participantFilter !== undefined) participantFilter = params.participantFilter;
    table.replaceData(updateTableData());
  };

  const data = getTableData();
  const columns = getStatsColumns();

  const render = (data: any[]) => {
    destroyTable({ anchorId: DRAWS_VIEW });
    const element = document.getElementById(DRAWS_VIEW);

    const groupBy = Object.values(groupNames).length > 1 ? ['groupName'] : undefined;
    table = new Tabulator(element, {
      headerSortElement: headerSortElement([
        'averageVariation',
        'averagePressure',
        'participantName',
        'pressureOrder',
        'pointsResult',
        'gamesResult',
        'matchUpsPct',
        'setsResult',
        'pointsPct',
        'gamesPct',
        'setsPct',
        'result',
        'order',
      ]),
      responsiveLayoutCollapseStartOpen: false,
      height: window.innerHeight * (env.tableHeightMultiplier ?? 0.85),
      groupHeader: [(value: string) => value],
      placeholder: 'No participants',
      responsiveLayout: 'collapse',
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

  drawControlBar({ structure, drawId, existingView: ROUNDS_STATS, callback, updateDisplay: replaceTableData });
  eventControlBar({ eventId, drawId, structureId, updateDisplay: replaceTableData });

  return { table, replaceTableData };
}
