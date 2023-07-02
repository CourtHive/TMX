import { tournamentEngine, participantConstants, genderConstants, participantRoles } from 'tods-competition-factory';
import { createParticipantsTable } from 'components/tables/participantsTable/createParticipantsTable';
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { getEventFilter } from 'components/tables/common/filters/eventFilter';
import { updateRegisteredPlayers } from 'services/updateRegisteredPlayers';
import { deleteSelectedParticipants } from './deleteSelectedParticipants';
import { getSexFilter } from 'components/tables/common/filters/sexFilter';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { editRegistrationLink as sheetsLink } from './sheetsLink';
import { addParticipantsToEvent } from './addParticipantsToEvent';
import { eventFromParticipants } from './eventFromParticipants';
import { controlBar } from 'components/controlBar/controlBar';
import { participantOptions } from './participantOptions';
import { editParticipant } from './editParticipant';

import { PARTICIPANT_CONTROL, OVERLAY, RIGHT, LEFT, ALL_EVENTS } from 'constants/tmxConstants';
import { MODIFY_SIGN_IN_STATUS } from 'constants/mutationConstants';

const { INDIVIDUAL, SIGNED_IN, SIGNED_OUT } = participantConstants;
const { OFFICIAL } = participantRoles;
const { MIXED } = genderConstants;

export function renderIndividuals({ view }) {
  const { table, replaceTableData, teamParticipants } = createParticipantsTable({ view });

  const setSearchFilter = createSearchFilter(table);

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

  const selectOnEnter = (e) => {
    if (e.key === 'Enter') {
      const selected = table.getSelectedData();
      const selectedParticipantIds = selected.map(({ participantId }) => participantId);
      const active = table.getData('active');
      const activeParticipantIds = active.map(({ participantId }) => participantId);
      const activeNotSelected = activeParticipantIds.filter((a) => !selectedParticipantIds.includes(a));
      if (activeNotSelected.length === 1) {
        table.selectRow(activeNotSelected);
        e.target.value = '';
        table.clearFilter();
      }
    }
  };

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

  const addToEventOptions = events
    .map((event) => ({
      onClick: () => addParticipantsToEvent({ event, participantType: INDIVIDUAL, table, callback: replaceTableData }),
      label: event.eventName,
      close: true
    }))
    .concat([
      { divider: true },
      {
        label: '<p style="font-weight: bold">Create new event</p>',
        onClick: () => eventFromParticipants(table),
        close: true
      }
    ]);

  /*
  const addToTeamOptions = teamParticipants
    .map((team) => ({
      onClick: () => {
        console.log('add participants to team');
        // addParticipantsToTeam({ team, table, callback: replaceTableData });
      },
      label: team.participantName,
      close: true
    }))
    .concat([
      { divider: true },
      {
        label: '<p style="font-weight: bold">Create new team</p>',
        onClick: () => {
          console.log('creat team from participants');
          // teamFromParticipants(table);
        },
        close: true
      }
    ]);
    */

  const items = [
    {
      onKeyDown: (e) => {
        e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter('');
        selectOnEnter(e);
      },
      onChange: (e) => setSearchFilter(e.target.value),
      onKeyUp: (e) => setSearchFilter(e.target.value),
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
      // options: addToTeamOptions,
      hide: !teamParticipants.length,
      label: 'Add to team',
      intent: 'is-none',
      location: OVERLAY
    },
    {
      onClick: () => eventFromParticipants(table),
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
      onKeyDown: (e) => {
        e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter('');
        selectOnEnter(e);
      },
      onChange: (e) => setSearchFilter(e.target.value),
      onKeyUp: (e) => setSearchFilter(e.target.value),
      placeholder: 'Search participants',
      location: LEFT,
      search: true
    },
    {
      hide: eventOptions.length < 2,
      options: eventOptions,
      label: ALL_EVENTS,
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
