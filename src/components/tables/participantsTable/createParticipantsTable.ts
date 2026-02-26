/**
 * Create table for tournament participants.
 * Displays individual participant details, ratings, and event assignments.
 * Rating columns and averages are determined dynamically from participant data.
 */
import { tournamentEngine, participantConstants, participantRoles, tools, fixtures } from 'tods-competition-factory';
import { mapParticipant } from 'pages/tournament/tabs/participantTab/mapParticipant';
import { getRatingColumns } from '../common/getRatingColumns';
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

const { ratingsParameters } = fixtures;

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
    if (cityState) table?.showColumn('cityState');
    if (tennisId) table?.showColumn('tennisId');

    // Check if new rating types appeared that the table doesn't have columns for
    const existingFields = new Set(table?.getColumns().map((c: any) => c.getField()));
    const neededColumns = getRatingColumns(data, 'participant');
    const hasNewRatings = neededColumns.some((col: any) => !existingFields.has(col.field));

    if (hasNewRatings) {
      // Rebuild columns to include new rating types
      table?.setColumns(getParticipantColumns({ data, replaceTableData }));
    } else {
      // Just show existing rating columns
      for (const col of neededColumns) {
        table?.showColumn(col.field);
      }
    }

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

    // Build dynamic list of rating fields to exclude from header sort
    const ratingFields = getRatingColumns(data, 'participant').map((col: any) => col.field);

    table = new Tabulator(element, {
      headerSortElement: headerSortElement([
        'sex',
        'signedIn',
        'events',
        'teams',
        ...ratingFields,
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
      if (!env.averages) return;

      // Dynamically calculate averages for all present rating types
      const ratingValues: Record<string, number[]> = {};
      for (const row of rows) {
        const rowData = row.getData();
        if (!rowData.ratings) continue;
        for (const [key, ratingData] of Object.entries(rowData.ratings)) {
          if (!ratingData) continue;
          const upperKey = key.toUpperCase();
          const params = ratingsParameters[upperKey];
          if (!params) continue;
          const value = (ratingData as any)?.[params.accessor];
          if (tools.isNumeric(value)) {
            if (!ratingValues[upperKey]) ratingValues[upperKey] = [];
            ratingValues[upperKey].push(parseFloat(value));
          }
        }
      }
      for (const [ratingType, values] of Object.entries(ratingValues)) {
        const total = values.reduce(simpleAddition, 0);
        const average = (values.length ? total / values.length : 0).toFixed(2);
        console.log(`${ratingType} ${average}x̄`);
      }
    });
    table.on('scrollVertical', destroyTipster);
    table.on('tableBuilt', () => (ready = true));
  };

  render(data);

  return { table, replaceTableData, teamParticipants, groupParticipants };
}
