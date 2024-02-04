import { mapMatchUp } from 'pages/tournament/tabs/matchUpsTab/mapMatchUp';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'pages/tournament/destroyTable';
import { tournamentEngine } from 'tods-competition-factory';
import { findAncestor } from 'services/dom/parentAndChild';
import { getMatchUpColumns } from './getMatchUpColumns';

import { NONE, TOURNAMENT_MATCHUPS } from 'constants/tmxConstants';

export function createMatchUpsTable() {
  let table;

  const getTableData = () => {
    const matchUps = (
      tournamentEngine.allTournamentMatchUps({
        participantsProfile: { withISO2: true, withScaleValues: true },
        contextProfile: { withCompetitiveness: true },
      }).matchUps || []
    ).filter(({ matchUpStatus }) => matchUpStatus !== 'BYE');

    // TODO: sort matchUps 1st: checkScoreHasValue but incomplete, 2nd: readyToScore, 3rd: ordered rounds with most matchUps

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
    const headerElement = findAncestor(element, 'section')?.querySelector('.tabHeader');

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
      data,
    });
    table.on('dataFiltered', (filters, rows) => {
      const matchUps = rows.map((row) => row.getData().matchUp);
      headerElement && (headerElement.innerHTML = `Matches (${matchUps.length})`);
      const predictiveWTN = document.getElementById('wtnPredictiveAccuracy');
      const wtn = tournamentEngine.getPredictiveAccuracy({
        valueAccessor: 'wtnRating',
        scaleName: 'WTN',
        zoneMargin: 2.5,
        matchUps,
      });
      if (wtn?.accuracy?.percent) {
        predictiveWTN.style.display = '';
        predictiveWTN.innerHTML = `WTN ${wtn.accuracy.percent}%`;
      } else {
        predictiveWTN.style.display = NONE;
      }

      const predictiveUTR = document.getElementById('utrPredictiveAccuracy');
      const utr = tournamentEngine.getPredictiveAccuracy({
        valueAccessor: 'utrRating',
        singlesForDoubles: true,
        scaleName: 'UTR',
        zoneMargin: 1,
        matchUps,
      });
      if (utr?.accuracy?.percent) {
        predictiveUTR.style.display = '';
        predictiveUTR.innerHTML = `UTR ${utr.accuracy.percent}%`;
      } else {
        predictiveUTR.style.display = NONE;
      }
    });
  };

  render(data);

  return { table, replaceTableData };
}
