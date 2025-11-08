/**
 * Create matchUps table with scoring and predictive accuracy.
 * Displays all tournament matchUps with WTN/UTR predictive accuracy calculations.
 */
import { mapMatchUp } from 'pages/tournament/tabs/matchUpsTab/mapMatchUp';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'pages/tournament/destroyTable';
import { tournamentEngine } from 'tods-competition-factory';
import { findAncestor } from 'services/dom/parentAndChild';
import { getMatchUpColumns } from './getMatchUpColumns';
import { hotKeyScoring } from './hotKeyScoring';

import { NONE, TOURNAMENT_MATCHUPS } from 'constants/tmxConstants';

export function createMatchUpsTable(): { table: any; data: any[]; replaceTableData: () => void } {
  let table: any;

  const { setFocusData } = hotKeyScoring();

  const getTableData = () => {
    const matchUps = (
      tournamentEngine.allTournamentMatchUps({
        participantsProfile: { withISO2: true, withScaleValues: true },
        contextProfile: { withCompetitiveness: true },
      }).matchUps || []
    ).filter(({ matchUpStatus }: any) => matchUpStatus !== 'BYE');

    return matchUps.map((mapMatchUp as any));
  };

  const replaceTableData = () => {
    table.replaceData(getTableData());
  };

  const data = getTableData();
  const columns = (getMatchUpColumns as any)({ data, replaceTableData, setFocusData });

  const render = (data: any[]) => {
    destroyTable({ anchorId: TOURNAMENT_MATCHUPS });
    const element = document.getElementById(TOURNAMENT_MATCHUPS)!;
    const headerElement = findAncestor(element, 'section')?.querySelector('.tabHeader') as HTMLElement;

    table = new Tabulator(element, {
      headerSortElement: headerSortElement(['complete', 'duration', 'score', 'scheduledTime']),
      height: window.innerHeight * 0.85,
      placeholder: 'No matches',
      layout: 'fitColumns',
      reactiveData: true,
      index: 'matchUpId',
      columns,
      data,
    });
    table.on('dataFiltered', (_filters: any, rows: any[]) => {
      const matchUps = rows.map((row) => row.getData().matchUp);
      headerElement && (headerElement.innerHTML = `Matches (${matchUps.length})`);
      const predictiveWTN = document.getElementById('wtnPredictiveAccuracy')!;
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

      const predictiveUTR = document.getElementById('utrPredictiveAccuracy')!;
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

  return { table, data, replaceTableData };
}
