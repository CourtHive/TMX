/**
 * Create matchUps table with scoring and predictive accuracy.
 * Dynamically calculates predictive accuracy for all rating types present in participant data.
 */
import { mapMatchUp } from 'pages/tournament/tabs/matchUpsTab/mapMatchUp';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'pages/tournament/destroyTable';
import { tournamentEngine, fixtures, factoryConstants } from 'tods-competition-factory';
import { findAncestor } from 'services/dom/parentAndChild';
import { getMatchUpColumns } from './getMatchUpColumns';
import { hotKeyScoring } from './hotKeyScoring';
import { env } from 'settings/env';
import { t } from 'i18n';

// constants
import { NONE, TOURNAMENT_MATCHUPS } from 'constants/tmxConstants';

const { ratingsParameters } = fixtures;
const { SINGLES } = factoryConstants.eventConstants;

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

    return matchUps.map(mapMatchUp as any);
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
      height: window.innerHeight * (env.tableHeightMultiplier ?? 0.85),
      placeholder: 'No matches',
      layout: 'fitColumns',
      reactiveData: true,
      index: 'matchUpId',
      columns,
      data,
    });
    table.on('dataFiltered', (_filters: any, rows: any[]) => {
      const matchUps = rows.map((row) => row.getData().matchUp);
      headerElement && (headerElement.innerHTML = `${t('pages.matchUps.title')} (${matchUps.length})`);

      // Discover which ratings are present in tournament participants
      const { participants: allParticipants = [] } =
        tournamentEngine.getParticipants({ withScaleValues: true }) ?? {};
      const presentRatings = new Set<string>();
      for (const p of allParticipants) {
        for (const item of p.ratings?.[SINGLES] || []) {
          presentRatings.add(item.scaleName);
        }
      }

      // Calculate predictive accuracy for each present rating type
      for (const scaleName of presentRatings) {
        const params = ratingsParameters[scaleName];
        if (!params) continue;

        const elementId = `${scaleName.toLowerCase()}PredictiveAccuracy`;
        const element = document.getElementById(elementId);
        if (!element) continue;

        const [rangeA, rangeB] = params.range || [0, 100];
        const rangeSpan = Math.abs(rangeB - rangeA);
        const zoneMargin = rangeSpan * 0.05;

        const result = tournamentEngine.getPredictiveAccuracy({
          valueAccessor: params.accessor,
          scaleName,
          zoneMargin,
          matchUps,
        });

        if (result?.accuracy?.percent) {
          element.style.display = '';
          element.innerHTML = `${scaleName} ${result.accuracy.percent}%`;
        } else {
          element.style.display = NONE;
        }
      }
    });
  };

  render(data);

  return { table, data, replaceTableData };
}
