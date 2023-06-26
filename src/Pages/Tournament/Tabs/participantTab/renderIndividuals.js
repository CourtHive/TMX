import { tournamentEngine, participantConstants, genderConstants, participantRoles } from 'tods-competition-factory';
import { createParticipantsTable } from 'components/tables/participantsTable/createParticipantsTable';
import { getEventFilter } from 'components/tables/common/filters/eventFilter';
import { updateRegisteredPlayers } from 'services/updateRegisteredPlayers';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { deleteSelectedParticipants } from './deleteSelectedParticipants';
import { getSexFilter } from 'components/tables/common/filters/sexFilter';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { editRegistrationLink as sheetsLink } from './sheetsLink';
import { addParticipantsToEvent } from './addParticipantsToEvent';
import { controlBar } from 'components/controlBar/controlBar';
import { participantOptions } from './participantOptions';
import { editParticipant } from './editParticipant';
import { editEvent } from '../eventsTab/editEvent';

import { PARTICIPANT_CONTROL, OVERLAY, RIGHT, LEFT } from 'constants/tmxConstants';
import { MODIFY_SIGN_IN_STATUS } from 'constants/mutationConstants';

const { INDIVIDUAL, SIGNED_IN, SIGNED_OUT } = participantConstants;
const { OFFICIAL } = participantRoles;
const { MIXED } = genderConstants;

export function renderIndividuals({ view }) {
  const { table, replaceTableData } = createParticipantsTable({ view });
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

  const { eventOptions, events } = getEventFilter(table);
  const { sexOptions, genders } = getSexFilter(table);

  const editRegistrationLink = () => sheetsLink({ callback: replaceTableData });

  const synchronizePlayers = () => {
    updateRegisteredPlayers({
      showNotice: true,
      callback: replaceTableData
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

  const participantLabel = view === OFFICIAL ? 'Officials' : 'Individuals';

  const actionOptions = [
    { label: 'Sign out players not approved for events', onClick: signOutUnapproved, close: true },
    { divider: true },
    { heading: 'Add participants' },
    { label: 'Generate mock participants', onClick: synchronizePlayers, close: true },
    { label: 'Import from Google sheet', onClick: editRegistrationLink, close: true },
    {
      onClick: () => editParticipant({ refresh: replaceTableData, view }),
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

    const postEventCreation = (result) => {
      table.deselectRow();
      if (result?.success) {
        const eventId = result?.event?.eventId;
        if (eventId) navigateToEvent({ eventId });
      }
    };
    editEvent({ callback: postEventCreation, participants });
  };

  const addToEventOptions = events
    .map((event) => ({
      onClick: () => addParticipantsToEvent({ event, participantType: INDIVIDUAL, table, callback: replaceTableData }),
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
      onClick: () => deleteSelectedParticipants(table),
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
