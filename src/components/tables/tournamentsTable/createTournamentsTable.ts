import { editTournament } from 'components/drawers/editTournamentDrawer';
import { mapTournamentRecord } from 'pages/tournaments/mapTournamentRecord';
import { calendarControls } from 'pages/tournaments/tournamentsControls';
import { mockTournaments, EXAMPLE_TOURNAMENT_CATALOG } from 'pages/tournaments/mockTournaments';
import { getUserContext } from 'services/authentication/getUserContext';
import { renderWelcomeView } from 'pages/tournaments/welcomeView';
import { listPicker } from 'components/modals/listPicker';
import { getLoginState } from 'services/authentication/loginState';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { getTournamentColumns } from './getTournamentColumn';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'pages/tournament/destroyTable';
import { getCalendar, getMyCalendars } from 'services/apis/servicesApi';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';
import { displayConfig } from 'config/displayConfig';

// constants
import { TOURNAMENTS_CONTROL, TOURNAMENTS_TABLE } from 'constants/tmxConstants';

const recreateTable = () => createTournamentsTable();
const handleDbError = (error: any) => console.log('db Error', { error });
const sortByStartDateDesc = (a: any, b: any) =>
  new Date(b.startDate || b.start).getTime() - new Date(a.startDate || a.start).getTime();
const sortCalendarTournamentsDesc = (a: any, b: any) =>
  new Date(b.tournament.startDate).getTime() - new Date(a.tournament.startDate).getTime();
const isTournamentImage = ({ name }: any) => name === 'tournamentImage';

function handleExampleSelection({ selection }: any): void {
  const value = selection?.selection?.value;
  const indices = value === -1 ? undefined : [value];
  mockTournaments(undefined, recreateTable, indices);
}

function openExampleTournamentPicker(): void {
  const options = [{ label: 'All', value: -1 }, ...EXAMPLE_TOURNAMENT_CATALOG];
  listPicker({
    title: 'Example Tournaments',
    actionLabel: 'Generate',
    actionIntent: 'is-success',
    options,
    callback: handleExampleSelection,
  });
}

function openCreateTournament(): void {
  editTournament({ onCreated: recreateTable });
}

function decorateCalendarTournament(t: any, provider: any): any {
  const offline = t.tournament.timeItemValues?.TMX?.offline;
  t.tournament.offline = offline;
  const imageResource = t.tournament.onlineResources?.find(isTournamentImage);
  if (imageResource?.resourceType === 'URL') {
    t.tournament.tournamentImageURL = imageResource.identifier;
  } else if (imageResource?.resourceSubType === 'COURT_SVG') {
    t.tournament.courtSvgSport = imageResource.identifier;
  }
  return { ...t, provider };
}

function buildCalendarTableData(tournaments: any[], provider: any): any[] {
  return [...tournaments]
    .sort(sortCalendarTournamentsDesc)
    .map((t) => decorateCalendarTournament(t, provider));
}

function mergeCalendars(calendars: any[], fallbackProvider: any): { tournaments: any[]; provider: any } {
  const tournaments: any[] = [];
  let provider = fallbackProvider;
  for (const cal of calendars) {
    if (!provider && cal.provider) provider = cal.provider;
    for (const t of cal.tournaments ?? []) tournaments.push(t);
  }
  return { tournaments, provider };
}

function renderTable(tableData: any[], columns: any[]): any {
  destroyTable({ anchorId: TOURNAMENTS_TABLE });
  const calendarAnchor = document.getElementById(TOURNAMENTS_TABLE);
  if (!calendarAnchor) return undefined;

  if (tableData.length === 0) {
    const controlEl = document.getElementById(TOURNAMENTS_CONTROL);
    if (controlEl) controlEl.innerHTML = '';
    renderWelcomeView(calendarAnchor, {
      onGenerate: openExampleTournamentPicker,
      onCreate: openCreateTournament,
    });
    return undefined;
  }

  const table = new Tabulator(calendarAnchor, {
    height: window.innerHeight * (displayConfig.get().tableHeightMultiplier ?? 0.85),
    placeholder: 'No tournaments',
    layout: 'fitColumns',
    index: 'tournamentId',
    headerVisible: false,
    reactiveData: true,
    data: tableData,
    columns,
  });

  table.on('tableBuilt', () => calendarControls(table));
  table.on('scrollVertical', destroyTipster);
  return table;
}

function renderLocal(data: any[], columns: any[]): any {
  data.sort(sortByStartDateDesc);
  return renderTable(data.map(mapTournamentRecord), columns);
}

function renderCalendarTable(
  { tournaments, provider }: { tournaments: any[]; provider: any },
  columns: any[],
): any {
  return renderTable(buildCalendarTableData(tournaments, provider), columns);
}

function renderFromLocalDb(columns: any[]): Promise<any> {
  return tmx2db.findAllTournaments().then((data: any) => renderLocal(data, columns), handleDbError);
}

function handlePublicCalendarFallback(provider: any, columns: any[]): Promise<any> {
  if (!provider?.organisationAbbreviation) return renderFromLocalDb(columns);
  return getCalendar({ providerAbbr: provider.organisationAbbreviation }).then(
    (result: any) =>
      result?.data?.calendar
        ? renderCalendarTable(result.data.calendar, columns)
        : renderFromLocalDb(columns),
    () => renderFromLocalDb(columns),
  );
}

function handleMyCalendars(result: any, provider: any, columns: any[]): any {
  const calendars = result?.data?.calendars;
  if (!calendars?.length) return renderFromLocalDb(columns);
  const merged = mergeCalendars(calendars, provider);
  return merged.tournaments.length
    ? renderCalendarTable(merged, columns)
    : renderFromLocalDb(columns);
}

function handlePublicCalendar(result: any, columns: any[]): any {
  return result?.data?.calendar ? renderCalendarTable(result.data.calendar, columns) : renderFromLocalDb(columns);
}

export function createTournamentsTable(): { table: any } {
  const dnav = document.getElementById('dnav');
  if (dnav) dnav.style.backgroundColor = '';

  const columns = getTournamentColumns();

  const loginState = getLoginState();
  // Impersonation (context.provider) wins over the user's own JWT provider so
  // a super-admin who picked a provider via the switcher / handoff sees that
  // provider's calendar, not their own.
  const provider = context?.provider || loginState?.provider;
  const impersonatedAbbr = context?.provider?.organisationAbbreviation;
  const userContext = getUserContext();

  let table: any;

  if (userContext) {
    getMyCalendars(impersonatedAbbr ? { providerAbbr: impersonatedAbbr } : {}).then(
      (result: any) => {
        table = handleMyCalendars(result, provider, columns);
      },
      () => {
        table = handlePublicCalendarFallback(provider, columns);
      },
    );
  } else if (provider?.organisationAbbreviation) {
    getCalendar({ providerAbbr: provider.organisationAbbreviation }).then((result: any) => {
      table = handlePublicCalendar(result, columns);
    });
  } else {
    table = renderFromLocalDb(columns);
  }

  return { table };
}
