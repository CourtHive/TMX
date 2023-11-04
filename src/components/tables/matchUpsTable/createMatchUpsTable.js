import { mapMatchUp } from 'Pages/Tournament/Tabs/matchUpsTab/mapMatchUp';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'Pages/Tournament/destroyTable';
import { tournamentEngine } from 'tods-competition-factory';
import { getMatchUpColumns } from './getMatchUpColumns';

import { TOURNAMENT_MATCHUPS } from 'constants/tmxConstants';

export function createMatchUpsTable() {
  let table;

  const getTableData = () => {
    const matchUps = (
      tournamentEngine.allTournamentMatchUps({
        participantsProfile: { withISO2: true, withScaleValues: true },
        contextProfile: { withCompetitiveness: true }
      }).matchUps || []
    ).filter(({ matchUpStatus }) => matchUpStatus !== 'BYE');

    // TODO: sort matchUps 1st: scoreHasValue but incomplete, 2nd: readyToScore, 3rd: ordered rounds with most matchUps

    return matchUps.map(mapMatchUp);
  };

  const replaceTableData = () => {
    table.replaceData(getTableData());
  };

  const data = getTableData();
  const columns = getMatchUpColumns({ data, replaceTableData });

  const render = (data) => {
    destroyTable({ anchorId: TOURNAMENT_MATCHUPS });
    const element = document.getElementById(TOURNAMENT_MATCHUPS);

    table = new Tabulator(element, {
      headerSortElement: headerSortElement(['complete', 'duration', 'score']),
      responsiveLayoutCollapseStartOpen: false,
      height: window.innerHeight * 0.85,
      responsiveLayout: 'collapse',
      placeholder: 'No matches',
      layout: 'fitColumns',
      reactiveData: true,
      index: 'matchUpId',
      columns,
      data
    });
    table.on('dataFiltered', (filters, rows) => {
      const matchUps = rows.map((row) => row.getData().matchUp);
      !!matchUps;
      /*
      console.log(
        'WTN',
        tournamentEngine.getPredictiveAccuracy({
          valueAccessor: 'wtnRating',
          scaleName: 'WTN',
          zoneMargin: 2.5,
          matchUps
        })
      );
      console.log(
        'UTR',
        tournamentEngine.getPredictiveAccuracy({
          valueAccessor: 'utrRating',
          singlesForDoubles: true,
          scaleName: 'UTR',
          zoneMargin: 1,
          matchUps
        })
      );
      */
    });
  };

  render(data);

  return { table, replaceTableData };
}
