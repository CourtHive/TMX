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

export function createTournamentsTable(): { table: any } {
  const handleError = (error: any) => console.log('db Error', { error });
  const dnav = document.getElementById('dnav');
  if (dnav) dnav.style.backgroundColor = '';
  let table: any;

  const columns = getTournamentColumns();

  const renderTable = (tableData: any[]) => {
    destroyTable({ anchorId: TOURNAMENTS_TABLE });
    const calendarAnchor = document.getElementById(TOURNAMENTS_TABLE);
    if (!calendarAnchor) return;

    if (tableData.length === 0) {
      const controlEl = document.getElementById(TOURNAMENTS_CONTROL);
      if (controlEl) controlEl.innerHTML = '';

      renderWelcomeView(calendarAnchor, {
        onGenerate: () => {
          const options = [{ label: 'All', value: -1 }, ...EXAMPLE_TOURNAMENT_CATALOG];
          listPicker({
            title: 'Example Tournaments',
            actionLabel: 'Generate',
            actionIntent: 'is-success',
            options,
            callback: ({ selection }: any) => {
              const value = selection?.selection?.value;
              const indices = value === -1 ? undefined : [value];
              mockTournaments(undefined, () => createTournamentsTable(), indices);
            },
          });
        },
        onCreate: () => editTournament({ onCreated: () => createTournamentsTable() }),
      });
      return;
    }

    table = new Tabulator(calendarAnchor, {
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
  };

  const render = (data: any[]) => {
    data.sort((a, b) => new Date(b.startDate || b.start).getTime() - new Date(a.startDate || a.start).getTime());
    renderTable(data.map(mapTournamentRecord));
  };
  const renderCalendarTable = ({ tournaments, provider }: { tournaments: any[]; provider: any }) => {
    const sortedTournaments = [...tournaments].sort(
      (a, b) => new Date(b.tournament.startDate).getTime() - new Date(a.tournament.startDate).getTime(),
    );
    const tableData = sortedTournaments.map((t) => {
      const offline = t.tournament.timeItemValues?.TMX?.offline;
      t.tournament.offline = offline;
      const imageResource = t.tournament.onlineResources?.find(
        ({ name }: any) => name === 'tournamentImage',
      );
      if (imageResource?.resourceType === 'URL') {
        t.tournament.tournamentImageURL = imageResource.identifier;
      } else if (imageResource?.resourceSubType === 'COURT_SVG') {
        t.tournament.courtSvgSport = imageResource.identifier;
      }
      return { ...t, provider };
    });
    renderTable(tableData);
  };
  const loginState = getLoginState();
  const provider = loginState?.provider || context?.provider;
  const userContext = getUserContext();

  const noProvider = () => tmx2db.findAllTournaments().then(render, handleError);

  if (userContext) {
    // Logged in with a user context — use the authenticated, user-scoped
    // multi-provider calendar endpoint. Merges tournaments across all
    // providers the user is associated with.
    const showMyCalendars = (result: any) => {
      const calendars = result?.data?.calendars;
      if (calendars?.length) {
        // Merge all per-provider calendars into a single tournaments array
        const allTournaments: any[] = [];
        let mergedProvider = provider;
        for (const cal of calendars) {
          if (!mergedProvider && cal.provider) mergedProvider = cal.provider;
          for (const t of cal.tournaments ?? []) {
            allTournaments.push(t);
          }
        }
        if (allTournaments.length) {
          renderCalendarTable({ tournaments: allTournaments, provider: mergedProvider });
        } else {
          noProvider();
        }
      } else {
        noProvider();
      }
    };
    getMyCalendars().then(showMyCalendars, () => {
      // Authenticated endpoint failed (offline?) — fall back to public calendar
      if (provider?.organisationAbbreviation) {
        getCalendar({ providerAbbr: provider.organisationAbbreviation }).then((result) => {
          if (result?.data?.calendar) renderCalendarTable(result.data.calendar);
          else noProvider();
        }, noProvider);
      } else {
        noProvider();
      }
    });
  } else if (provider?.organisationAbbreviation) {
    // Not logged in but have a provider context — use the public calendar
    const showResults = (result: any) => {
      if (result?.data?.calendar) {
        renderCalendarTable(result.data.calendar);
      } else {
        noProvider();
      }
    };
    getCalendar({ providerAbbr: provider.organisationAbbreviation }).then(showResults);
  } else {
    noProvider();
  }

  return { table };
}
