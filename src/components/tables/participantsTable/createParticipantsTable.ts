/**
 * Create table for tournament participants.
 * Displays individual participant details, ratings, and event assignments.
 */
import { tournamentEngine, participantConstants, participantRoles, tools } from 'tods-competition-factory';
import { mapParticipant } from 'pages/tournament/tabs/participantTab/mapParticipant';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { getParticipantColumns } from './getParticipantColumns';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'pages/tournament/destroyTable';
import { findAncestor } from 'services/dom/parentAndChild';
import { env } from 'settings/env';
import { t } from 'i18n';

// constants
import { TOURNAMENT_PARTICIPANTS } from 'constants/tmxConstants';

const { INDIVIDUAL, GROUP, TEAM } = participantConstants;
const { OFFICIAL, COMPETITOR } = participantRoles;

export function createParticipantsTable({ view }: { view?: string } = {}): {
  table: any;
  replaceTableData: () => void;
  teamParticipants: any[];
  groupParticipants: any[];
} {
  let table: any;
  let groupParticipants: any[] = [];
  let participants: any[];
  let derivedEventInfo: any;
  let teamParticipants: any[] = [];
  let ready: boolean;

  const participantFilters = { participantRoles: [view === OFFICIAL ? OFFICIAL : COMPETITOR] };

  const getTableData = () => {
    const result = tournamentEngine.getParticipants({
      withSignInStatus: true,
      withScaleValues: true,
      participantFilters,
      withEvents: true,
      withISO2: true,
    });
    ({ participants = [], derivedEventInfo } = result);

    const individualParticipants = participants.filter(({ participantType }: any) => participantType === INDIVIDUAL);
    groupParticipants = participants.filter(({ participantType }: any) => participantType === GROUP);
    teamParticipants = participants.filter(({ participantType }: any) => participantType === TEAM);

    return individualParticipants?.map((p: any) => mapParticipant(p, derivedEventInfo)) || [];
  };

  const replaceTableData = () => {
    const data = getTableData();
    const cityState = data?.some((p: any) => p.cityState);
    const tennisId = data?.some((p: any) => p.tennisId);
    const utr = data?.some((p: any) => p.ratings?.utr);
    const wtn = data?.some((p: any) => p.ratings?.wtn);
    if (cityState) table?.showColumn('cityState');
    if (tennisId) table?.showColumn('tennisId');
    if (utr) table?.showColumn('ratings.utr.utrRating');
    if (wtn) table?.showColumn('ratings.wtn.wtnRating');
    const refresh = () => table.replaceData(data);
    setTimeout(refresh, ready ? 0 : 1000);
  };

  const data = getTableData();
  const columns = getParticipantColumns({ data, replaceTableData });

  const simpleAddition = (a: any, b: any) => {
    return ((tools.isNumeric(a) && a) || 0) + ((tools.isNumeric(b) && b) || 0);
  };

  const render = (data: any) => {
    destroyTable({ anchorId: TOURNAMENT_PARTICIPANTS });
    const element = document.getElementById(TOURNAMENT_PARTICIPANTS);
    const headerElement = findAncestor(element, 'section')?.querySelector('.tabHeader');

    table = new Tabulator(element, {
      headerSortElement: headerSortElement([
        'sex',
        'signedIn',
        'events',
        'teams',
        'ratings.wtn.wtnRating',
        'ratings.utr.utrRating',
        'cityState',
        'tennisId',
      ]),
      height: window.innerHeight * (env.tableHeightMultiplier ?? 0.85),
      placeholder: 'No participants',
      index: 'participantId',
      layout: 'fitColumns',
      reactiveData: true,
      columns,
      data,
    });

    const getHeader = (rows: any[]) => `${t('pages.participants.title')} (${rows.length})`;
    table.on('dataChanged', (rows: any[]) => headerElement && (headerElement.innerHTML = getHeader(rows)));
    table.on('dataFiltered', (_filters: any, rows: any[]) => {
      if (headerElement) headerElement.innerHTML = getHeader(rows);
      const wtns: number[] = [];
      const utrs: number[] = [];
      for (const row of rows) {
        const data = row.getData();
        const { wtn, utr } = data.ratings;
        if (tools.isNumeric(utr?.utrRating)) utrs.push(parseFloat(utr.utrRating));
        if (tools.isNumeric(wtn?.wtnRating)) wtns.push(parseFloat(wtn.wtnRating));
      }
      const utrTotal = utrs.reduce(simpleAddition, 0);
      const wtnTotal = wtns.reduce(simpleAddition, 0);
      const utrAverage = (utrs.length ? utrTotal / utrs.length : 0).toFixed(2);
      const wtnAverage = (wtns.length ? wtnTotal / wtns.length : 0).toFixed(2);
      if (env.averages) console.log(`UTR ${utrAverage}x̄`);
      if (env.averages) console.log(`WTN ${wtnAverage}x̄`);
    });
    table.on('scrollVertical', destroyTipster);
    table.on('tableBuilt', () => (ready = true));
  };

  render(data);

  return { table, replaceTableData, teamParticipants, groupParticipants };
}
