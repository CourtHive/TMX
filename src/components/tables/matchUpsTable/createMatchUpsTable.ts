/**
 * Create matchUps table with scoring and predictive accuracy.
 * Dynamically calculates predictive accuracy for all rating types present in participant data.
 */
import { startCrowdPoller, type CrowdPoller } from 'services/crowd/crowdPoller';
import { subscribeCrowdActivity } from 'services/crowd/crowdActivityIndex';
import { mapMatchUp } from 'pages/tournament/tabs/matchUpsTab/mapMatchUp';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { fixtures, unwrapOr } from 'tods-competition-factory';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'pages/tournament/destroyTable';
import { tournamentEngine } from 'services/factory/engine';
import { findAncestor } from 'services/dom/parentAndChild';
import { getMatchUpColumns } from './getMatchUpColumns';
import { getPresentRatings } from './getPresentRatings';
import { displayConfig } from 'config/displayConfig';
import { hotKeyScoring } from './hotKeyScoring';
import { t } from 'i18n';

// constants
import { NONE, TOURNAMENT_MATCHUPS } from 'constants/tmxConstants';

const { ratingsParameters } = fixtures;

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
      height: window.innerHeight * (displayConfig.get().tableHeightMultiplier ?? 0.85),
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

      const presentRatings = getPresentRatings();

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

        const { accuracy } = unwrapOr(
          tournamentEngine.getPredictiveAccuracy({
            valueAccessor: params.accessor,
            scaleName,
            zoneMargin,
            matchUps,
          }),
          { accuracy: undefined as any },
        );
        if (accuracy?.percent) {
          element.style.display = '';
          element.innerHTML = `${scaleName} ${accuracy.percent}%`;
        } else {
          element.style.display = NONE;
        }
      }
    });
  };

  render(data);

  // ─── Phase 4 — crowd activity poller + row reformat on change ───────────
  // Start a tournament-level poll into the crowdActivityIndex so the three-dot
  // icon can glow and the "View crowd trackers (N)" menu item knows whether
  // to render. Stop on tableDestroyed so a tab switch doesn't leak the timer.
  const tournamentId = tournamentEngine.getState?.()?.tournamentRecord?.tournamentId;
  let crowdPoller: CrowdPoller | undefined;
  let unsubscribeCrowd: (() => void) | undefined;
  if (tournamentId) {
    crowdPoller = startCrowdPoller({ tournamentId });
    unsubscribeCrowd = subscribeCrowdActivity((matchUpId: string) => {
      try {
        const row = table.getRow(matchUpId);
        if (row) row.reformat();
      } catch {
        // Row may not exist on this table view; ignore.
      }
    });
    table.on('tableDestroyed', () => {
      crowdPoller?.stop();
      unsubscribeCrowd?.();
    });
  }

  return { table, data, replaceTableData };
}
