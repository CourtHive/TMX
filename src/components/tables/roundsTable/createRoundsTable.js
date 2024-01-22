import { headerSortElement } from '../common/sorters/headerSortElement';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'pages/tournament/destroyTable';
import { roundGroupingHeader } from './roundGroupingHeader';
import { tournamentEngine } from 'tods-competition-factory';
import { getRoundsColumns } from './getRoundsColumns';
import { mapRound } from './mapRound';

import { DRAWS_VIEW } from 'constants/tmxConstants';

export function createRoundsTable({ drawId, structureId, matchUps, eventData }) {
  let table;

  const getMatchUps = () => {
    return (
      tournamentEngine.allTournamentMatchUps({
        matchUpFilters: { drawIds: [drawId], structureIds: [structureId] },
        participantsProfile: { withISO2: true, withScaleValues: true },
        contextProfile: { withCompetitiveness: true },
      }).matchUps || []
    ).filter(({ matchUpStatus }) => matchUpStatus !== 'BYE');
  };

  // eventName necessary for team scorecard
  if (!matchUps) matchUps = getMatchUps();
  if (eventData) {
    matchUps.forEach((matchUp) => (matchUp.eventName = eventData.eventInfo.eventName));
  }

  const getTableData = () => matchUps.map(mapRound);

  const updateTableData = () => {
    const matchUps = getMatchUps();
    return matchUps.map(mapRound);
  };
  const replaceTableData = () => {
    table.replaceData(updateTableData());
  };

  const data = getTableData();
  const columns = getRoundsColumns({ data, replaceTableData });

  const render = (data) => {
    destroyTable({ anchorId: DRAWS_VIEW });
    const element = document.getElementById(DRAWS_VIEW);

    table = new Tabulator(element, {
      groupHeader: [roundGroupingHeader, (value) => (value === true ? 'Complete' : 'Incomplete')],
      headerSortElement: headerSortElement(['complete', 'duration', 'score']),
      responsiveLayoutCollapseStartOpen: false,
      height: window.innerHeight * 0.85,
      groupStartOpen: [
        true,
        (a, count, rows, group) => {
          console.log({ count, rows }, group.getField(), group.getKey());
          return a;
        },
      ],
      // groupBy: ['roundName', 'complete'],
      groupBy: ['roundName'],
      responsiveLayout: 'collapse',
      // groupUpdateOnCellEdit: true,
      placeholder: 'No matches',
      layout: 'fitColumns',
      reactiveData: true,
      index: 'matchUpId',
      columns,
      data,
    });
  };

  render(data);

  return { table, replaceTableData };
}
