import { renderDrawView } from 'pages/tournament/tabs/eventsTab/renderDraws/renderDrawView';
import { drawControlBar } from 'pages/tournament/tabs/eventsTab/renderDraws/drawControlBar';
import { cleanupDrawPanel } from 'pages/tournament/tabs/eventsTab/cleanupDrawPanel';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'pages/tournament/destroyTable';
import { tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { preferencesConfig } from 'config/preferencesConfig';
import { renderParticipant } from 'courthive-components';
import { scalesMap } from 'config/scalesConfig';

// Constants
import { DRAWS_VIEW, ROUNDS_STANDINGS } from 'constants/tmxConstants';

type CreateSwissStandingsTableParams = {
  structureId: string;
  eventId: string;
  drawId: string;
};

export async function createSwissStandingsTable({ structureId, eventId, drawId }: CreateSwissStandingsTableParams) {
  let structure: any;
  let table: any;

  const getData = () => {
    const standingsResult = tournamentEngine.getSwissStandings({ drawId });
    if (!standingsResult?.success) return { rows: [], roundsPlayed: 0 };

    const { drawDefinition } = tournamentEngine.getEvent({ drawId });
    structure = drawDefinition?.structures?.find((s: any) => s.structureId === structureId);

    const { participants } = tournamentEngine.getParticipants({
      participantFilters: { participantIds: standingsResult.standings.map((s) => s.participantId) },
    });
    const participantMap = (participants ?? []).reduce((map: Record<string, any>, p: any) => {
      map[p.participantId] = p;
      return map;
    }, {});

    const rows = standingsResult.standings.map((standing) => {
      const participant = participantMap[standing.participantId];
      return {
        participant,
        participantName: participant?.participantName ?? standing.participantId,
        rank: standing.rank,
        wins: standing.wins,
        losses: standing.losses,
        draws: standing.draws,
        points: standing.points,
        buchholz: standing.buchholz ?? '',
        sonnebornBerger: standing.sonnebornBerger ?? '',
        gamesPlayed: standing.wins + standing.losses + standing.draws,
      };
    });

    return { rows, roundsPlayed: standingsResult.roundsPlayed };
  };

  const columns = [
    {
      title: '#',
      field: 'rank',
      width: 60,
      hozAlign: 'center',
      headerHozAlign: 'center',
      headerSort: true,
      headerSortTristate: true,
      headerTooltip: 'Rank',
    },
    {
      title: 'Participant',
      field: 'participantName',
      minWidth: 180,
      headerSort: true,
      headerSortTristate: true,
      formatter: (cell: any) => {
        const data = cell.getRow().getData();
        if (!data.participant) return data.participantName || '';
        const scaleAttributes = scalesMap[preferencesConfig.get().activeScale];
        return renderParticipant({
          composition: { theme: 'default', configuration: { genderColor: true, scaleAttributes, flag: false } },
          participant: data.participant,
        });
      },
    },
    {
      title: 'W',
      field: 'wins',
      width: 60,
      hozAlign: 'center',
      headerHozAlign: 'center',
      headerSort: true,
      headerSortTristate: true,
      headerTooltip: 'Wins',
    },
    {
      title: 'L',
      field: 'losses',
      width: 60,
      hozAlign: 'center',
      headerHozAlign: 'center',
      headerSort: true,
      headerSortTristate: true,
      headerTooltip: 'Losses',
    },
    {
      title: 'T',
      field: 'draws',
      width: 60,
      hozAlign: 'center',
      headerHozAlign: 'center',
      headerSort: true,
      headerSortTristate: true,
      headerTooltip: 'Ties',
    },
    {
      title: 'Pts',
      field: 'points',
      width: 60,
      hozAlign: 'center',
      headerHozAlign: 'center',
      headerSort: true,
      headerSortTristate: true,
      headerTooltip: 'Points',
    },
    {
      title: 'B',
      field: 'buchholz',
      width: 60,
      hozAlign: 'center',
      headerHozAlign: 'center',
      headerSort: true,
      headerSortTristate: true,
      headerTooltip: 'Buchholz tiebreaker',
    },
    {
      title: 'SB',
      field: 'sonnebornBerger',
      width: 60,
      hozAlign: 'center',
      headerHozAlign: 'center',
      headerSort: true,
      headerSortTristate: true,
      headerTooltip: 'Sonneborn-Berger tiebreaker',
    },
  ];

  const { rows } = getData();

  destroyTable({ anchorId: DRAWS_VIEW });

  const drawsView = document.getElementById(DRAWS_VIEW);
  if (!drawsView) return { table: null, replaceTableData: () => {} };

  const tableEl = document.createElement('div');
  drawsView.appendChild(tableEl);

  table = new Tabulator(tableEl, {
    headerSortElement: () => '',
    layout: 'fitColumns',
    data: rows,
    columns,
    height: Math.min(window.innerHeight * 0.75, rows.length * 40 + 60),
    placeholder: 'No standings available — generate and complete rounds first',
  });

  const replaceTableData = () => {
    const { rows: newRows } = getData();
    table?.replaceData(newRows);
  };

  const callback = ({ refresh, view }: { refresh?: boolean; view?: string } = {}) => {
    cleanupDrawPanel();
    if (view) {
      navigateToEvent({ eventId, drawId, structureId, renderDraw: true, view });
    } else {
      renderDrawView({ eventId, drawId, structureId, redraw: refresh, roundsView: view });
    }
  };

  drawControlBar({ structure, drawId, existingView: ROUNDS_STANDINGS, callback, updateDisplay: replaceTableData });

  return { table, replaceTableData };
}
