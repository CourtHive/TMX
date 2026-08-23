/**
 * Renders individuals (players) tab with table and controls.
 * Displays individual participants with filtering, editing, and management options.
 */
import { enableManualRatings } from 'components/tables/participantsTable/editRatings/enableManualRatings';
import { createParticipantsTable } from 'components/tables/participantsTable/createParticipantsTable';
import { enableEditWTID } from 'components/tables/participantsTable/editWTID/enableEditWTID';
import { filterPopoverButton } from 'components/tables/common/filters/filterPopoverButton';
import { saveRatings } from 'components/tables/participantsTable/editRatings/saveRatings';
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { getAddToGroupingSelection } from './controlBar/getAddToGroupingSelection';
import { createSelectOnEnter } from 'components/tables/common/createSelectOnEnter';
import { participantConstants, participantRoles } from 'tods-competition-factory';
import { saveWTID } from 'components/tables/participantsTable/editWTID/saveWTID';
import { getEventFilter } from 'components/tables/common/filters/eventFilter';
import { getTeamFilter } from 'components/tables/common/filters/teamFilter';
import { updateRegisteredPlayers } from 'services/updateRegisteredPlayers';
import { deleteSelectedParticipants } from './deleteSelectedParticipants';
import { getSexFilter } from 'components/tables/common/filters/sexFilter';
import { editIndividualParticipant } from './editIndividualParticipant';
import { signInParticipants } from './controlBar/signInParticipants';
import { printPlayerList } from 'components/modals/printPlayerList';
import { callSheet } from 'components/modals/callSheet';
import { signOutUnapproved } from './controlBar/signOutUnapproved';
import { getLoginState } from 'services/authentication/loginState';
import { editRegistrationLink as sheetsLink } from './sheetsLink';
import { addParticipantsToEvent } from './addParticipantsToEvent';
import { eventFromParticipants } from './eventFromParticipants';
import { selectItem } from 'components/modals/selectItem';
import { providerConfig } from 'config/providerConfig';
import { importPlayersCsv } from './importPlayersCsv';
import { participantChips } from './participantChips';
import { controlBar } from 'courthive-components';
import { t } from 'i18n';

// Constants
import { PARTICIPANT_CONTROL, OVERLAY, STAFF, RIGHT, LEFT } from 'constants/tmxConstants';
import { context } from 'services/context';

const { INDIVIDUAL, GROUP } = participantConstants;
const { OFFICIAL } = participantRoles;

const isPrimary = 'is-primary';

export function renderIndividuals({ view }: { view: string }): void {
  const { table, replaceTableData, teamParticipants, groupParticipants, data } = createParticipantsTable({ view });
  context.refreshActiveTable = replaceTableData;

  const setSearchFilter = createSearchFilter(table, { persistKey: 'search', filterContext: 'participantFilters' });
  const state = getLoginState();
  const canEditTennisId = state?.roles?.includes('superadmin') || state?.permissions?.includes('editTennisId');

  // Callback that refreshes data and rebuilds the component after event changes
  const refreshAfterEventChange = () => renderIndividuals({ view });

  const { eventOptions, events, isFiltered: isEventFiltered, activeIndex: eventActiveIndex } = getEventFilter(table);
  const { sexOptions, isFiltered: isSexFiltered, activeIndex: sexActiveIndex } = getSexFilter(table);
  const {
    teamOptions,
    isFiltered: isTeamFiltered,
    activeIndex: teamActiveIndex,
  } = getTeamFilter({ table, teamParticipants });

  const filterSections = [
    {
      label: t('pages.participants.allEvents'),
      options: events.length ? eventOptions : [],
      isFiltered: isEventFiltered,
      activeIndex: eventActiveIndex,
    },
    {
      label: t('pages.participants.anyTeam'),
      options: teamParticipants?.length ? teamOptions : [],
      isFiltered: isTeamFiltered,
      activeIndex: teamActiveIndex,
    },
    {
      label: t('pages.participants.allGenders'),
      options: sexOptions,
      isFiltered: isSexFiltered,
      activeIndex: sexActiveIndex,
    },
  ];
  const { item: filterButton, clearAllFilters, updateBadge } = filterPopoverButton(filterSections);

  // Update placeholder when filters hide all participants
  // Tabulator re-reads table.options.placeholder each time it renders the
  // placeholder, so we swap the option value rather than mutating the DOM.
  const buildFilteredPlaceholder = () => {
    const el = document.createElement('div');
    el.style.textAlign = 'center';
    el.textContent = 'No matches — adjust or clear filters';
    const btn = document.createElement('button');
    btn.className = 'clear-filters-btn';
    btn.textContent = 'Clear Filters';
    btn.onclick = () => {
      clearAllFilters();
      renderIndividuals({ view });
    };
    el.appendChild(document.createElement('br'));
    el.appendChild(btn);
    return el;
  };

  table.on('dataFiltered', (filters: any, rows: any[]) => {
    table.options.placeholder = rows.length === 0 && filters?.length ? buildFilteredPlaceholder() : 'No participants';
  });

  const editRegistrationLink = () => sheetsLink({ callback: replaceTableData });

  const viewLabel =
    view === OFFICIAL
      ? t('pages.participants.officials')
      : view === STAFF
        ? t('pages.participants.staff')
        : t('pages.participants.title');

  /**
   * Open the call sheet.
   *
   * Selection wins when there is one — "text these six" means the six the director just ticked. With
   * nothing selected the sheet covers every row the current filters leave visible, which is what the
   * Actions-menu entry means. `getRows('active')` rather than `getData()` deliberately: `getData()`
   * returns the unfiltered set, so a director who filtered to the medical team and pressed Print
   * would get the whole tournament.
   */
  const openCallSheet = () => {
    const selected = table?.getSelectedData?.() ?? [];
    const visible = (table?.getRows('active') ?? []).map((row: any) => row.getData());
    const rows = selected.length ? selected : visible;
    const subtitle = selected.length ? `${viewLabel} (${t('pages.participants.selected')})` : viewLabel;
    callSheet({ rows, subtitle });
  };

  const synchronizePlayers = () => {
    (updateRegisteredPlayers as any)({
      callback: () => {
        replaceTableData();
        table?.redraw(true);
      },
      showNotice: true,
    });
  };

  // From the seeded data array, NOT `table.getDataCount()` — Tabulator answers 0 until `tableBuilt`
  // fires, which is after `createParticipantsTable` returns. Reading the table here hid three Actions
  // items on every first render of a table that was visibly showing rows.
  const hasParticipants = data.length > 0;
  const isLoggedIn = !!state;

  const actionOptions: any[] = [
    {
      onClick: () => signOutUnapproved(replaceTableData),
      label: t('pages.participants.signOutUnapproved'),
      hide: !hasParticipants,
      close: true,
    },
    {
      onClick: (e: any) => enableManualRatings(e, table),
      label: t('pages.participants.editRatings'),
      hide: !hasParticipants,
      close: true,
    },
    {
      onClick: (e: any) => enableEditWTID(e, table),
      hide: !canEditTennisId,
      label: t('pages.participants.editWTID'),
      close: true,
    },
    { divider: true } as any,
    {
      onClick: () => printPlayerList({}),
      label: '<i class="fa-solid fa-print"></i> Print Player List',
      close: true,
    },
    {
      // Available from every view, not personnel alone. The population is whatever the table is
      // showing, so on the Competitors view this is the alternates list a director works from.
      onClick: openCallSheet,
      label: `<i class="fa-solid fa-address-book"></i> ${t('modals.callSheet.title')}`,
      hide: !hasParticipants,
      close: true,
    },
    { divider: true } as any,
    {
      hide: !providerConfig.isAllowed('canImportParticipants'),
      label: t('pages.participants.importGoogleSheet'),
      onClick: editRegistrationLink,
      close: true,
    },
    {
      hide: !providerConfig.isAllowed('canImportParticipants'),
      label: t('pages.participants.importFromCsv'),
      onClick: () => importPlayersCsv({ callback: replaceTableData }),
      close: true,
    },
    {
      onClick: () => editIndividualParticipant({ callback: replaceTableData, view }),
      label: t('pages.participants.newParticipant'),
      // Different cap depending on whether the user is creating a COMPETITOR
      // or an OFFICIAL — both are PARTICIPANTS but are gated separately.
      hide: !providerConfig.isAllowed(view === OFFICIAL ? 'canCreateOfficials' : 'canCreateCompetitors'),
      close: true,
    },
  ];

  const addToEventOptions = events
    .map((event: any) => ({
      onClick: () =>
        addParticipantsToEvent({ event, participantType: INDIVIDUAL, table, callback: refreshAfterEventChange }),
      label: event.eventName,
      close: true,
    }))
    .concat([
      { divider: true } as any,
      {
        label: `<p style="font-weight: bold">${t('pages.participants.createNewEvent')}</p>`,
        onClick: () => eventFromParticipants(table, refreshAfterEventChange),
        close: true,
      },
    ]);

  const addToGroup = getAddToGroupingSelection({
    participants: groupParticipants,
    participantType: GROUP,
    replaceTableData,
    table,
  });
  const addToTeam = getAddToGroupingSelection({ participants: teamParticipants, table, replaceTableData });
  const selectOnEnter = createSelectOnEnter(table);

  const items = [
    {
      onKeyDown: (e: any) => {
        e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter('');
        selectOnEnter(e);
      },
      onChange: (e: any) => setSearchFilter(e.target.value),
      onKeyUp: (e: any) => setSearchFilter(e.target.value),
      clearSearch: () => setSearchFilter(''),
      placeholder: t('pages.participants.searchParticipants'),
      value: context.participantFilters.search || '',
      location: OVERLAY,
      search: true,
    },
    {
      options: addToEventOptions,
      label: t('pages.participants.addToEvent.label'),
      hide: !events.length,
      intent: 'none',
      location: OVERLAY,
    },
    {
      onClick: () => eventFromParticipants(table, refreshAfterEventChange),
      label: t('pages.participants.createEvent'),
      hide: events.length,
      intent: 'is-info',
      location: OVERLAY,
    },
    {
      selection: addToTeam,
      selectionTitle: t('pages.participants.addToTeam'),
      label: t('pages.participants.addToTeam'),
      intent: 'none',
      location: OVERLAY,
    },
    {
      selection: addToGroup,
      selectionTitle: t('pages.participants.addToGroup'),
      label: t('pages.participants.addToGroup'),
      intent: 'none',
      location: OVERLAY,
    },
    {
      onClick: () => signInParticipants(table),
      intent: isPrimary,
      location: OVERLAY,
      label: t('pages.participants.signIn'),
    },
    {
      // "Text these six." The selection overlay is where a director already stands after ticking
      // rows, so the reach-them action belongs beside Sign In rather than three clicks away in the
      // Actions menu.
      onClick: openCallSheet,
      label: t('modals.callSheet.contactSelected'),
      location: OVERLAY,
      intent: 'none',
    },
    {
      onClick: () => deleteSelectedParticipants(table),
      label: t('pages.participants.deleteSelected'),
      intent: 'is-danger',
      stateChange: true,
      hide: !providerConfig.isAllowed('canDeleteParticipants'),
      location: OVERLAY,
    },
    {
      onKeyDown: (e: any) => {
        e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter('');
        selectOnEnter(e);
      },
      onChange: (e: any) => setSearchFilter(e.target.value),
      onKeyUp: (e: any) => setSearchFilter(e.target.value),
      clearSearch: () => setSearchFilter(''),
      placeholder: t('pages.participants.searchParticipants'),
      value: context.participantFilters.search || '',
      location: LEFT,
      search: true,
    },
    filterButton,
    ...participantChips(view),
    {
      onClick: synchronizePlayers,
      label: t('pages.participants.generateMock'),
      hide: isLoggedIn,
      intent: 'is-info',
      location: RIGHT,
    },
    {
      options: actionOptions,
      label: t('pages.participants.actions'),
      selection: false,
      location: RIGHT,
      align: RIGHT,
    },
    {
      onClick: (e: any) => saveWTID(e, table),
      class: 'saveTennisId',
      intent: isPrimary,
      label: t('pages.participants.saveWTID'),
      location: RIGHT,
      visible: false,
    },
    {
      onClick: (e: any) => saveRatings(e, table),
      label: t('pages.participants.saveRatings'),
      intent: isPrimary,
      class: 'saveRatings',
      location: RIGHT,
      visible: false,
    },
  ];

  const participantControl = document.getElementById(PARTICIPANT_CONTROL) || undefined;
  controlBar({ table, target: participantControl, items, selectItemFn: selectItem });

  // Apply filter-active styling if a filter was persisted from a previous session
  updateBadge();
}
