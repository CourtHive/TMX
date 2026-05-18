/**
 * Create table for tournament participants.
 * Displays individual participant details, ratings, and event assignments.
 * Rating columns and averages are determined dynamically from participant data.
 */
import { tournamentEngine } from 'services/factory/engine';
import { participantConstants, participantRoles, tools, fixtures } from 'tods-competition-factory';
import { mapParticipant } from 'pages/tournament/tabs/participantTab/mapParticipant';
import { getRatingColumns } from '../common/getRatingColumns';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { getParticipantColumns } from './getParticipantColumns';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'pages/tournament/destroyTable';
import { findAncestor } from 'services/dom/parentAndChild';
import { displayConfig } from 'config/displayConfig';
import { debugConfig } from 'config/debugConfig';
import { t } from 'i18n';
import { buildScalingsChart, collectAvailableScales } from 'components/charts/participantScalings';

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
      height: window.innerHeight * (displayConfig.get().tableHeightMultiplier ?? 0.85),
      placeholder: 'No participants',
      index: 'participantId',
      layout: 'fitColumns',
      reactiveData: true,
      columns,
      data,
    });

    const headerLabel = view === OFFICIAL ? t('pages.participants.officials') : t('pages.participants.title');

    // Reshape the section's .tabHeader from a plain text label into a
    // flex row: [Participants (n)] on the left, [scale selector + sparkline]
    // on the right. The chart re-binds against the currently visible rows
    // so it tracks filter state without needing to re-query the engine.
    const headerHandle = headerElement ? installScalingsHeader(headerElement as HTMLElement, headerLabel) : null;

    // Refresh from row-data objects (works with both the `dataChanged`
    // signature, which passes the data array, and our manual call in
    // `tableBuilt` via `table.getData()`).
    const refreshFromData = (rowData: any[]) => {
      if (!headerHandle) return;
      const list = Array.isArray(rowData) ? rowData : [];
      headerHandle.setCount(list.length);
      const participants = list.map((d: any) => d?.participant).filter(Boolean);
      headerHandle.setScales(collectAvailableScales(participants));
    };

    // Refresh from Row components (the `dataFiltered` signature).
    const refreshFromRows = (rows: any[]) => refreshFromData((rows || []).map((r: any) => r.getData?.()));

    // `dataChanged` fires with the (possibly empty) data array — use it
    // directly instead of `table.getRows('active')` which is empty at
    // initial replaceData time.
    table.on('dataChanged', (rowData: any[]) => refreshFromData(rowData));
    table.on('dataFiltered', (_filters: any, rows: any[]) => {
      refreshFromRows(rows);
      if (!debugConfig.get().averages) return;

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
            ratingValues[upperKey].push(Number.parseFloat(value));
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
    table.on('tableBuilt', () => {
      ready = true;
      // Initial render. `dataChanged` may not fire when data is seeded
      // via the constructor's `data:` option, so prime the header
      // explicitly the moment the table is interactive.
      refreshFromData(table.getData());
    });
  };

  render(data);

  return { table, replaceTableData, teamParticipants, groupParticipants };
}

interface ScalingsHeaderHandle {
  setCount: (n: number) => void;
  setScales: (scales: ReturnType<typeof collectAvailableScales>) => void;
}

/**
 * Replace the section's `.tabHeader` text with a flex row hosting the
 * "Participants (n)" label on the left and a compact scalings sparkline
 * (with optional scale selector) on the right. Returns setters the
 * caller drives from Tabulator's dataChanged / dataFiltered events.
 */
function installScalingsHeader(headerElement: HTMLElement, labelText: string): ScalingsHeaderHandle {
  headerElement.style.cssText =
    'display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: nowrap;';
  headerElement.replaceChildren();

  const label = document.createElement('span');
  label.textContent = `${labelText} (0)`;
  headerElement.appendChild(label);

  const chartHandle = buildScalingsChart([], { variant: 'compact' });
  // Keep the chart on the right and prevent it from pushing the label
  // off-screen when the participants section is narrow.
  chartHandle.element.style.minWidth = '0';
  chartHandle.element.style.flex = '0 1 auto';
  headerElement.appendChild(chartHandle.element);

  return {
    setCount: (n: number) => {
      label.textContent = `${labelText} (${n})`;
    },
    setScales: chartHandle.update,
  };
}
