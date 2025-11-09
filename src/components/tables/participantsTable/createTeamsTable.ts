/**
 * Create teams/groups table with individual participants.
 * Displays team participants with events, members, matchUps, and win/loss records.
 */
import { participantResponsiveLayourFormatter } from './participantResponsiveLayoutFormatter';
import { mapTeamParticipant } from 'pages/tournament/tabs/participantTab/mapTeamParticipant';
import { tournamentEngine, participantConstants } from 'tods-competition-factory';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'pages/tournament/destroyTable';
import { findAncestor } from 'services/dom/parentAndChild';
import { teamRowFormatter } from './teamRowFormatter';
import { getGroupingsColumns } from './getGroupingsColumns';

import { TOURNAMENT_TEAMS } from 'constants/tmxConstants';

const { TEAM } = participantConstants;

export function createTeamsTable({ view }: { view?: string } = {}): { table: any; replaceTableData: () => void } {
  let table: any, participants: any[], derivedEventInfo: any, ready: boolean;

  const getTableData = () => {
    const result = tournamentEngine.getParticipants({
      participantFilters: { participantTypes: [view || TEAM] },
      withIndividualParticipants: true,
      withScaleValues: true,
      withEvents: true,
      withISO2: true,
    });
    ({ participants, derivedEventInfo } = result);

    return participants.map((p: any) => (mapTeamParticipant as any)(p, derivedEventInfo));
  };

  const replaceTableData = () => {
    const refresh = () => table.replaceData(getTableData());
    setTimeout(refresh, ready ? 0 : 1000);
  };

  const columns = (getGroupingsColumns as any)({ view });

  const render = (data: any[]) => {
    destroyTable({ anchorId: TOURNAMENT_TEAMS });
    const element = document.getElementById(TOURNAMENT_TEAMS)!;
    const headerElement = findAncestor(element, 'section')?.querySelector('.tabHeader') as HTMLElement;

    table = new Tabulator(element, {
      headerSortElement: headerSortElement(['events', 'membersCount', 'matchUpsCount', 'winLoss']),
      responsiveLayoutCollapseFormatter: participantResponsiveLayourFormatter,
      responsiveLayoutCollapseStartOpen: false,
      minHeight: window.innerHeight * 0.81,
      height: window.innerHeight * 0.86,
      placeholder: 'No team participants',
      rowFormatter: teamRowFormatter,
      responsiveLayout: 'collapse',
      index: 'participantId',
      layout: 'fitColumns',
      reactiveData: true,
      data,
      columns,
    });

    table.on('dataChanged', (rows: any[]) => {
      const type = view === TEAM ? 'Teams' : 'Groups';
      headerElement && (headerElement.innerHTML = `${type} (${rows.length})`);
    });
    table.on('dataFiltered', (_filters: any, rows: any[]) => {
      const type = view === TEAM ? 'Teams' : 'Groups';
      headerElement && (headerElement.innerHTML = `${type} (${rows.length})`);
    });
    table.on('scrollVertical', destroyTipster);
    table.on('tableBuilt', () => (ready = true));
  };

  render(getTableData());

  return { table, replaceTableData };
}
