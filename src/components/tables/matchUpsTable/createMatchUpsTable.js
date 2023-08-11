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
        contextProfile: { withCompetitiveness: true },
        participantsProfile: { withISO2: true }
      }).matchUps || []
    ).filter(({ matchUpStatus }) => matchUpStatus !== 'BYE');

    // TODO: sort matchUps 1st: scoreHasValue but incomplete, 2nd: readyToScore, 3rd: ordered rounds with most matchUps

    return matchUps.map(mapMatchUp);
  };

  const replaceTableData = () => {
    table.replaceData(getTableData());
  };

  // TODO: add competitiveness column and/or highlight scores based on competitiveness
  // matchUp.competitiveness ['ROUTINE', 'DECISIVE', 'COMPETITIVE']
  const columns = getMatchUpColumns(replaceTableData);

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
  };

  render(getTableData());

  return { table, replaceTableData };
}