import { tournamentEngine, participantConstants, genderConstants, participantRoles } from 'tods-competition-factory';
import { createParticipantsTable } from 'components/tables/participantsTable/createParticipantsTable';
import { createTeamsTable } from 'components/tables/participantsTable/createTeamsTable';
import { createTeamsFromAttribute } from 'components/modals/createTeamFromAttribute';
import { updateRegisteredPlayers } from 'services/updateRegisteredPlayers';
import { deleteParticipants } from 'modules/participants/deleteParticipants';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { getSexFilter } from 'components/tables/common/filters/sexFilter';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { editRegistrationLink as sheetsLink } from './sheetsLink';
import { controlBar } from 'components/controlBar/controlBar';
import { participantOptions } from './participantOptions';
import { addToEvent } from 'components/modals/addToEvent';
import { editParticipant } from './editParticipant';
import { addTeam } from 'components/modals/addTeam';
import { editEvent } from '../eventsTab/editEvent';
import { context } from 'services/context';

import { PARTICIPANT_CONTROL, TEAMS_CONTROL, OVERLAY, RIGHT, LEFT, NONE } from 'constants/tmxConstants';
import { ADD_EVENT_ENTRIES, MODIFY_SIGN_IN_STATUS } from 'constants/mutationConstants';

const { INDIVIDUAL, SIGNED_IN, SIGNED_OUT, TEAM, GROUP } = participantConstants;
const { OFFICIAL } = participantRoles;
const { MIXED } = genderConstants;

export function renderParticipantTab({ participantView = INDIVIDUAL } = {}) {
  const view = participantView.toUpperCase();
  const teams = [TEAM, GROUP].includes(view);
  let eventIdFilter;

  const p = document.getElementById('individuals');
  const g = document.getElementById('participantGroupings');
  if (teams) {
    p.style.display = NONE;
    g.style.display = '';
  } else {
    g.style.display = NONE;
    p.style.display = '';
  }

  const { table, replaceTableData } = teams ? createTeamsTable({ view }) : createParticipantsTable({ view });
  const ALL_EVENTS = 'All events';

  // SEARCH filter
  let searchText;
  const searchFilter = (rowData) => rowData.searchText?.includes(searchText);
  const updateSearchFilter = (value) => {
    if (!value) {
      console.log('removing search filter');
      table.removeFilter(searchFilter);
    }
    searchText = value;
    if (value) table.addFilter(searchFilter);
  };

  // FILTER: events
  const eventFilter = (rowData) => rowData.eventIds.includes(eventIdFilter);
  const updateEventFilter = (eventId) => {
    if (eventIdFilter) table.removeFilter(eventFilter);
    eventIdFilter = eventId;
    if (eventId) table.addFilter(eventFilter);
  };
  const events = tournamentEngine.getEvents().events || [];
  const allEvents = { label: ALL_EVENTS, onClick: updateEventFilter, close: true };
  const eventOptions = [allEvents].concat(
    events.map((event) => ({
      onClick: () => updateEventFilter(event.eventId),
      label: event.eventName,
      close: true
    }))
  );

  const { sexOptions, genders } = getSexFilter(table);

  const refresh = () => replaceTableData();
  const editRegistrationLink = () => sheetsLink({ callback: refresh });

  const synchronizePlayers = () => {
    updateRegisteredPlayers({
      showNotice: true,
      callback: refresh
    });
  };

  const signOutUnapproved = () => {
    const signedInNoEvents = tournamentEngine
      .getParticipants({
        participantFilters: { participantTypes: [INDIVIDUAL] },
        withSignInStatus: true,
        withEvents: true
      })
      .participants.filter((p) => p.signedIn && !p.events.length);

    const participantIds = signedInNoEvents.map((p) => p.participantId);

    const methods = [
      {
        params: { signInState: SIGNED_OUT, participantIds },
        method: MODIFY_SIGN_IN_STATUS
      }
    ];
    const postMutation = (result) => {
      if (result.success) {
        replaceTableData();
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const deleteSelectedParticipants = () => {
    const selected = table.getSelectedData();
    const participantIds = selected.filter((p) => !p.events?.length).map(({ participantId }) => participantId);
    const okAction = () => {
      const callback = (result) => result.success && table.deleteRow(participantIds);
      deleteParticipants({ participantIds, callback });
    };
    context.modal.confirm({
      query: `Delete ${participantIds.length} participants?`,
      title: 'Delete participants',
      okIntent: 'is-danger',
      okAction
    });
  };

  const addParticipantsToEvent = (event) => {
    const selected = table.getSelectedData();
    const { eventId, eventName, eventType } = event;
    const participantIds = selected
      .filter((p) => !p.events.map((e) => e.eventId).includes(eventId))
      .map(({ participantId }) => participantId);
    const callback = ({ entryStatus, entryStage } = {}) => {
      table.deselectRow();
      const methods = [
        {
          params: { eventId, participantIds, entryStatus, entryStage },
          method: ADD_EVENT_ENTRIES
        }
      ];
      const postMutation = (result) => result.success && replaceTableData();
      mutationRequest({ methods, callback: postMutation });
    };
    addToEvent({ callback, teams, eventName, eventType, participantIds });
  };

  if (teams) {
    const actionOptions = [
      { label: 'New team', onClick: () => addTeam({ callback: refresh }) },
      { label: 'Create team', onClick: () => createTeamsFromAttribute({ callback: refresh }) }
    ];
    const addToEventOptions = [{ label: 'Create new event', close: true }].concat(
      events
        .filter(({ eventType }) => eventType === TEAM)
        .map((event) => ({
          onClick: () => addParticipantsToEvent(event),
          label: event.eventName,
          close: true
        }))
    );

    const participantLabel = view === 'GROUP' ? 'Groups' : 'Teams';
    const items = [
      {
        onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
        onChange: (e) => updateSearchFilter(e.target.value),
        onKeyUp: (e) => updateSearchFilter(e.target.value),
        placeholder: 'Search teams',
        location: OVERLAY,
        search: true
      },
      {
        hide: !addToEventOptions.length,
        options: addToEventOptions,
        label: 'Add to event',
        intent: 'is-none',
        location: OVERLAY
      },
      {
        onClick: deleteSelectedParticipants,
        label: 'Delete selected',
        intent: 'is-danger',
        stateChange: true,
        location: OVERLAY
      },
      {
        onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
        onChange: (e) => updateSearchFilter(e.target.value),
        onKeyUp: (e) => updateSearchFilter(e.target.value),
        placeholder: 'Search teams',
        location: LEFT,
        search: true
      },
      {
        hide: eventOptions.length < 2,
        options: eventOptions,
        modifyLabel: true,
        label: ALL_EVENTS,
        location: LEFT,
        selection: true
      },
      {
        options: participantOptions(view),
        label: participantLabel,
        modifyLabel: true,
        intent: 'is-info',
        location: RIGHT,
        selection: true,
        align: RIGHT
      },
      {
        options: actionOptions,
        label: 'Actions',
        selection: false,
        location: RIGHT,
        align: RIGHT
      }
    ];

    const target = document.getElementById(TEAMS_CONTROL);
    controlBar({ table, target, items });
  } else {
    const participantLabel = view === OFFICIAL ? 'Officials' : 'Individuals';

    const actionOptions = [
      { label: 'Sign out players not approved for events', onClick: signOutUnapproved, close: true },
      { divider: true },
      { heading: 'Add participants' },
      { label: 'Generate mock participants', onClick: synchronizePlayers, close: true },
      { label: 'Import from Google sheet', onClick: editRegistrationLink, close: true },
      {
        onClick: () => editParticipant({ refresh, view }),
        label: 'New participant',
        close: true
      }
    ];

    const signInParticipants = () => {
      const selected = table.getSelectedData();
      const participantIds = selected.map(({ participantId }) => participantId);

      const methods = [
        {
          params: { signInState: SIGNED_IN, participantIds },
          method: MODIFY_SIGN_IN_STATUS
        }
      ];
      const postMutation = (result) => {
        if (result.success) {
          selected.forEach((participant) => (participant.signedIn = true));
          table.updateData(selected);
          table.deselectRow(); // necessary after data update, not after replaceTableData
        }
      };
      mutationRequest({ methods, callback: postMutation });
    };

    const eventFromParticipants = () => {
      const selected = table.getSelectedData();
      const active = table.getData('active').map((a) => a.participantId);
      const participants = selected.filter((s) => active.includes(s.participantId));

      const callback = (result) => {
        table.deselectRow();
        if (result?.success) {
          const eventId = result.results?.[0]?.event?.eventId;
          if (eventId) navigateToEvent({ eventId });
        }
      };
      editEvent({ callback, participants });
    };

    const addToEventOptions = events
      .map((event) => ({
        onClick: () => addParticipantsToEvent(event),
        label: event.eventName,
        close: true
      }))
      .concat([
        { divider: true },
        { label: '<p style="font-weight: bold">Create new event</p>', onClick: eventFromParticipants, close: true }
      ]);

    const items = [
      {
        onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
        onChange: (e) => updateSearchFilter(e.target.value),
        onKeyUp: (e) => updateSearchFilter(e.target.value),
        placeholder: 'Search participants',
        location: OVERLAY,
        search: true
      },
      {
        options: addToEventOptions,
        label: 'Add to event',
        hide: !events.length,
        intent: 'is-none',
        location: OVERLAY
      },
      {
        onClick: eventFromParticipants,
        label: 'Create event',
        hide: events.length,
        intent: 'is-info',
        location: OVERLAY
      },
      {
        onClick: signInParticipants,
        intent: 'is-primary',
        location: OVERLAY,
        label: 'Sign in'
      },
      {
        onClick: deleteSelectedParticipants,
        label: 'Delete selected',
        intent: 'is-danger',
        stateChange: true,
        location: OVERLAY
      },
      {
        onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
        onChange: (e) => updateSearchFilter(e.target.value),
        onKeyUp: (e) => updateSearchFilter(e.target.value),
        placeholder: 'Search participants',
        location: LEFT,
        search: true
      },
      {
        hide: eventOptions.length < 2,
        options: eventOptions,
        label: 'All events',
        modifyLabel: true,
        location: LEFT,
        selection: true
      },
      {
        options: sexOptions,
        label: genders[MIXED],
        modifyLabel: true,
        location: LEFT,
        selection: true
      },
      {
        options: participantOptions(view),
        label: participantLabel,
        intent: 'is-info',
        modifyLabel: true,
        selection: true,
        location: RIGHT,
        align: RIGHT
      },
      {
        options: actionOptions,
        label: 'Actions',
        selection: false,
        location: RIGHT,
        align: RIGHT
      }
    ];

    const participantControl = document.getElementById(PARTICIPANT_CONTROL);
    controlBar({ table, target: participantControl, items });
  }
}
