/**
 * Renders groupings (teams/groups) tab with table and controls.
 * Displays team or group participants with filtering and management options.
 */
import { filterPopoverButton } from 'components/tables/common/filters/filterPopoverButton';
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { createTeamsTable } from 'components/tables/participantsTable/createTeamsTable';
import { createTeamsFromAttribute } from 'components/modals/createTeamFromAttribute';
import { getEventFilter } from 'components/tables/common/filters/eventFilter';
import { deleteSelectedParticipants } from './deleteSelectedParticipants';
import { editGroupingParticipant } from './editGroupingParticipant';
import { getLoginState } from 'services/authentication/loginState';
import { addParticipantsToEvent } from './addParticipantsToEvent';
import { eventFromParticipants } from './eventFromParticipants';
import { participantConstants } from 'tods-competition-factory';
import { generateTeams } from 'components/modals/generateTeams';
import { participantChips } from './participantChips';
import { controlBar } from 'courthive-components';
import { t } from 'i18n';

// Constants
import { TEAMS_CONTROL, OVERLAY, RIGHT, LEFT } from 'constants/tmxConstants';

const { TEAM, GROUP } = participantConstants;

export function renderGroupings({ view }: { view: string }): void {
  const { table, replaceTableData } = createTeamsTable({ view });

  const setSearchFilter = createSearchFilter(table);

  const { eventOptions, events, isFiltered: isEventFiltered, activeIndex: eventActiveIndex } = getEventFilter(table);

  const filterSections = [
    {
      label: t('pages.participants.allEvents'),
      options: events.length ? eventOptions : [],
      isFiltered: isEventFiltered,
      activeIndex: eventActiveIndex,
    },
  ];
  const { item: filterButton } = filterPopoverButton(filterSections);

  const isLoggedIn = !!getLoginState();
  const isTeamView = view === TEAM;

  const newLabel = isTeamView ? t('pages.participants.newTeam') : t('pages.participants.newGroup');
  const searchPlaceholder = isTeamView ? 'Search teams' : 'Search groups';

  const actionOptions: any[] = [
    {
      label: newLabel,
      onClick: () =>
        editGroupingParticipant({
          participantType: isTeamView ? TEAM : GROUP,
          title: newLabel,
          refresh: replaceTableData,
        }),
    },
  ];

  if (isTeamView) {
    actionOptions.push({
      label: t('pages.participants.generateTeams'),
      onClick: () => createTeamsFromAttribute({ callback: replaceTableData }),
    });
  }

  const createNewEvent = {
    label: '<p style="font-weight: bold">Create new event</p>',
    onClick: () => eventFromParticipants(table, replaceTableData),
    close: true,
  };
  const addToEventOptions = [createNewEvent, { divider: true }].concat(
    events
      .filter(({ eventType }: any) => eventType === TEAM)
      .map((event: any) => ({
        onClick: () => addParticipantsToEvent({ event, participantType: TEAM, table, callback: replaceTableData }),
        label: event.eventName,
        close: true,
      })),
  );

  const items = [
    {
      onKeyDown: (e: any) => e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter(''),
      onChange: (e: any) => setSearchFilter(e.target.value),
      onKeyUp: (e: any) => setSearchFilter(e.target.value),
      clearSearch: () => setSearchFilter(''),
      placeholder: searchPlaceholder,
      location: OVERLAY,
      search: true,
    },
    {
      options: addToEventOptions,
      label: 'Add to event',
      hide: !events.length || !isTeamView,
      intent: 'none',
      location: OVERLAY,
    },
    {
      onClick: () => eventFromParticipants(table, replaceTableData),
      label: 'Create event',
      hide: events.length || !isTeamView,
      intent: 'is-info',
      location: OVERLAY,
    },
    {
      onClick: () => deleteSelectedParticipants(table),
      label: 'Delete selected',
      intent: 'is-danger',
      stateChange: true,
      location: OVERLAY,
    },
    {
      onKeyDown: (e: any) => e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter(''),
      onChange: (e: any) => setSearchFilter(e.target.value),
      onKeyUp: (e: any) => setSearchFilter(e.target.value),
      clearSearch: () => setSearchFilter(''),
      placeholder: searchPlaceholder,
      location: LEFT,
      search: true,
    },
    filterButton,
    ...participantChips(view),
    {
      onClick: () => generateTeams({ callback: replaceTableData }),
      label: 'Generate Mock Teams',
      hide: isLoggedIn || !isTeamView,
      intent: 'is-info',
      location: RIGHT,
    },
    {
      options: actionOptions,
      label: 'Actions',
      selection: false,
      location: RIGHT,
      align: RIGHT,
    },
  ];

  const target = document.getElementById(TEAMS_CONTROL) || undefined;
  controlBar({ table, target, items });
}
