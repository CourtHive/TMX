import { enableManualRatings } from 'components/tables/participantsTable/editRatings/enableManualRatings';
import { createParticipantsTable } from 'components/tables/participantsTable/createParticipantsTable';
import { participantConstants, genderConstants, participantRoles } from 'tods-competition-factory';
import { saveRatings } from 'components/tables/participantsTable/editRatings/saveRatings';
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { createSelectOnEnter } from 'components/tables/common/createSelectOnEnter';
import { getEventFilter } from 'components/tables/common/filters/eventFilter';
import { updateRegisteredPlayers } from 'services/updateRegisteredPlayers';
import { getAddToTeamSelection } from './controlBar/getAddToTeamSelection';
import { deleteSelectedParticipants } from './deleteSelectedParticipants';
import { getSexFilter } from 'components/tables/common/filters/sexFilter';
import { editIndividualParticipant } from './editIndividualParticipant';
import { signInParticipants } from './controlBar/signInParticipants';
import { signOutUnapproved } from './controlBar/signOutUnapproved';
import { editRegistrationLink as sheetsLink } from './sheetsLink';
import { addParticipantsToEvent } from './addParticipantsToEvent';
import { eventFromParticipants } from './eventFromParticipants';
import { controlBar } from 'components/controlBar/controlBar';
import { participantOptions } from './participantOptions';

import { PARTICIPANT_CONTROL, OVERLAY, RIGHT, LEFT, ALL_EVENTS } from 'constants/tmxConstants';

const { INDIVIDUAL } = participantConstants;
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

  const participantLabel = view === OFFICIAL ? 'Officials' : 'Individuals';

  const actionOptions = [
    {
      onClick: () => signOutUnapproved(replaceTableData),
      label: 'Sign out players not approved for events',
      close: true
    },
    {
      label: 'Edit ratings',
      onClick: (e) => enableManualRatings(e, table),
      close: true
    },
    { divider: true },
    { heading: 'Add participants' },
    { label: 'Generate mock participants', onClick: synchronizePlayers, close: true },
    { label: 'Import from Google sheet', onClick: editRegistrationLink, close: true },
    {
      onClick: () => editIndividualParticipant({ refresh: replaceTableData, view }),
      label: 'New participant',
      close: true
    }
  ];

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

  const addToTeam = getAddToTeamSelection({ teamParticipants, table, replaceTableData });
  const selectOnEnter = createSelectOnEnter(table);

  const items = [
    {
      onKeyDown: (e) => {
        e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter('');
        selectOnEnter(e);
      },
      onChange: (e) => setSearchFilter(e.target.value),
      onKeyUp: (e) => setSearchFilter(e.target.value),
      clearSearch: () => setSearchFilter(''),
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
      selection: addToTeam,
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
      onClick: () => signInParticipants(table),
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
      clearSearch: () => setSearchFilter(''),
      placeholder: 'Search participants',
      location: LEFT,
      search: true
    },
    {
      hide: (events || []).length < 1,
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
    },
    {
      onClick: (e) => saveRatings(e, table),
      label: 'Save ratings',
      intent: 'is-primary',
      class: 'saveRatings',
      location: RIGHT,
      visible: false
    }
  ];

  const participantControl = document.getElementById(PARTICIPANT_CONTROL);
  controlBar({ table, target: participantControl, items });
}