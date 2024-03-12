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
import { getStatsColumns } from './getStatsColumns';

import { DRAWS_VIEW, ROUNDS_STATS } from 'constants/tmxConstants';

export async function createStatsTable({ eventId, drawId, structureId }) {
  let table, structure, participantFilter, participantMap;
  const getParticipantMap = (participants) =>
    (participants ?? []).reduce((map, participant) => {
      map[participant.participantId] = participant;
      return map;
    }, {});

  const groupNames = {};

  const getParticipantResults = () => {
    const { participants, eventData } = tournamentEngine.getEventData({
      participantsProfile: { withScaleValues: true },
      allParticipantResults: true,
      pressureRating: true,
      // refreshResults: true,
      eventId,
    });
    const drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);
    structure = drawData?.structures?.find((s) => s.structureId === structureId);

    if (!participantMap) participantMap = getParticipantMap(participants);
    const matchUps = structure?.roundMatchUps ? Object.values(structure.roundMatchUps).flat() : [];
    matchUps.forEach(({ sides, structureName, structureId }) => {
      groupNames[structureId] = structureName;
      sides.forEach((side) => {
        if (side.participantId) {
          participantMap[side.participantId].groupName = structureName;
        }
      });
    });

    return (structure?.participantResults ?? []).filter((pResults) => {
      const participant = participantMap[pResults.participantId];
      return (
        !participantFilter || participant?.participantName?.toLowerCase().includes(participantFilter?.toLowerCase())
      );
    });
  };

  const participantResults = getParticipantResults();
  const getTableData = () =>
    participantResults?.map((participantInfo) => mapParticipantResults({ ...participantInfo, participantMap }));

  const updateTableData = () =>
    getParticipantResults()?.map((participantInfo) => mapParticipantResults({ ...participantInfo, participantMap }));
  const replaceTableData = (params) => {
    if (params?.participantFilter !== undefined) participantFilter = params.participantFilter;
    table.replaceData(updateTableData());
  };

  const data = getTableData();
  const columns = getStatsColumns();

  const render = (data) => {
    destroyTable({ anchorId: DRAWS_VIEW });
    const element = document.getElementById(DRAWS_VIEW);

    const groupBy = Object.values(groupNames).length > 1 ? ['groupName'] : undefined;
    table = new Tabulator(element, {
      headerSortElement: headerSortElement([
        'averageVariation',
        'averagePressure',
        'participantName',
        'gamesResult',
        'matchUpsPct',
        'setsResult',
        'gamesPct',
        'setsPct',
        'result',
        'order',
      ]),
      responsiveLayoutCollapseStartOpen: false,
      height: window.innerHeight * 0.85,
      groupHeader: [(value) => value],
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

  const callback = ({ refresh, view } = {}) => {
    cleanupDrawPanel();
    if (view) {
      navigateToEvent({ eventId, drawId, structureId, renderDraw: true, view });
    } else {
      renderDrawView({ eventId, drawId, structureId, redraw: refresh, roundsView: view });
    }
  };

  drawControlBar({ structure, drawId, existingView: ROUNDS_STATS, callback });
  eventControlBar({ eventId, drawId, structureId, updateDisplay: replaceTableData });

  return { table, replaceTableData };
}
