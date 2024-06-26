import { enableManualRatings } from 'components/tables/participantsTable/editRatings/enableManualRatings';
import { createParticipantsTable } from 'components/tables/participantsTable/createParticipantsTable';
import { enableEditWTID } from 'components/tables/participantsTable/editWTID/enableEditWTID';
import { saveRatings } from 'components/tables/participantsTable/editRatings/saveRatings';
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { getAddToGroupingSelection } from './controlBar/getAddToGroupingSelection';
import { createSelectOnEnter } from 'components/tables/common/createSelectOnEnter';
import { saveWTID } from 'components/tables/participantsTable/editWTID/saveWTID';
import { getEventFilter } from 'components/tables/common/filters/eventFilter';
import { updateRegisteredPlayers } from 'services/updateRegisteredPlayers';
import { getTeamFilter } from 'components/tables/common/filters/teamFilter';
import { deleteSelectedParticipants } from './deleteSelectedParticipants';
import { getSexFilter } from 'components/tables/common/filters/sexFilter';
import { editIndividualParticipant } from './editIndividualParticipant';
import { signInParticipants } from './controlBar/signInParticipants';
import { signOutUnapproved } from './controlBar/signOutUnapproved';
import { getLoginState } from 'services/authentication/loginState';
import { editRegistrationLink as sheetsLink } from './sheetsLink';
import { addParticipantsToEvent } from './addParticipantsToEvent';
import { eventFromParticipants } from './eventFromParticipants';
import { controlBar } from 'components/controlBar/controlBar';
import { participantOptions } from './participantOptions';
import {
  participantConstants,
  genderConstants,
  participantRoles,
  tournamentEngine,
  extensionConstants,
} from 'tods-competition-factory';

import { PARTICIPANT_CONTROL, OVERLAY, RIGHT, LEFT, ALL_EVENTS } from 'constants/tmxConstants';

const { INDIVIDUAL, GROUP } = participantConstants;
const { OFFICIAL } = participantRoles;
const { ANY } = genderConstants;

const isPrimary = 'is-primary';

export function renderIndividuals({ view }) {
  const { table, replaceTableData, teamParticipants, groupParticipants } = createParticipantsTable({ view });

  const setSearchFilter = createSearchFilter(table);

  const { eventOptions, events } = getEventFilter(table);
  const { sexOptions, genders } = getSexFilter(table);
  const { teamOptions } = getTeamFilter({ table, teamParticipants });

  const editRegistrationLink = () => sheetsLink({ callback: replaceTableData });

  const synchronizePlayers = () => {
    updateRegisteredPlayers({
      callback: () => {
        replaceTableData();
        table?.redraw(true);
      },
      showNotice: true,
    });
  };

  const participantLabel = view === OFFICIAL ? 'Officials' : 'Individuals';
  const { extension } = tournamentEngine.findExtension({ discover: true, name: extensionConstants.REGISTRATION });
  const registration = extension?.value;

  const state = getLoginState();
  const canEditTennisId = state?.roles?.includes('superadmin') || state?.permissions?.includes('editTennisId');

  const actionOptions = [
    {
      onClick: () => signOutUnapproved(replaceTableData),
      label: 'Sign out players not approved for events',
      close: true,
    },
    {
      onClick: (e) => enableManualRatings(e, table),
      label: 'Edit ratings',
      close: true,
    },
    {
      onClick: (e) => enableEditWTID(e, table),
      hide: !canEditTennisId,
      label: 'Edit WTID',
      close: true,
    },
    { divider: true },
    { heading: 'Add participants' },
    { hide: registration, label: 'Generate mock participants', onClick: synchronizePlayers, close: true },
    { label: 'Import from Google sheet', onClick: editRegistrationLink, close: true },
    {
      onClick: () => editIndividualParticipant({ callback: replaceTableData, view }),
      label: 'New participant',
      close: true,
    },
  ];

  const addToEventOptions = events
    .map((event) => ({
      onClick: () => addParticipantsToEvent({ event, participantType: INDIVIDUAL, table, callback: replaceTableData }),
      label: event.eventName,
      close: true,
    }))
    .concat([
      { divider: true },
      {
        label: '<p style="font-weight: bold">Create new event</p>',
        onClick: () => eventFromParticipants(table, replaceTableData),
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
      onKeyDown: (e) => {
        e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter('');
        selectOnEnter(e);
      },
      onChange: (e) => setSearchFilter(e.target.value),
      onKeyUp: (e) => setSearchFilter(e.target.value),
      clearSearch: () => setSearchFilter(''),
      placeholder: 'Search participants',
      location: OVERLAY,
      search: true,
    },
    {
      options: addToEventOptions,
      label: 'Add to event',
      hide: !events.length,
      intent: 'is-none',
      location: OVERLAY,
    },
    {
      onClick: () => eventFromParticipants(table, replaceTableData),
      label: 'Create event',
      hide: events.length,
      intent: 'is-info',
      location: OVERLAY,
    },
    {
      selection: addToTeam,
      label: 'Add to team',
      intent: 'is-none',
      location: OVERLAY,
    },
    {
      selection: addToGroup,
      label: 'Add to group',
      intent: 'is-none',
      location: OVERLAY,
    },
    {
      onClick: () => signInParticipants(table),
      intent: isPrimary,
      location: OVERLAY,
      label: 'Sign in',
    },
    {
      onClick: () => deleteSelectedParticipants(table),
      label: 'Delete selected',
      intent: 'is-danger',
      stateChange: true,
      location: OVERLAY,
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
      search: true,
    },
    {
      hide: (events || []).length < 1,
      options: eventOptions,
      label: ALL_EVENTS,
      modifyLabel: true,
      selection: true,
      location: LEFT,
    },
    {
      label: teamOptions[0]?.label,
      options: teamOptions,
      modifyLabel: true,
      selection: true,
      location: LEFT,
    },
    {
      options: sexOptions,
      label: genders[ANY],
      modifyLabel: true,
      selection: true,
      location: LEFT,
    },
    {
      options: participantOptions(view),
      label: participantLabel,
      intent: 'is-info',
      modifyLabel: true,
      location: RIGHT,
      selection: true,
      align: RIGHT,
    },
    {
      options: actionOptions,
      label: 'Actions',
      selection: false,
      location: RIGHT,
      align: RIGHT,
    },
    {
      onClick: (e) => saveWTID(e, table),
      class: 'saveTennisId',
      intent: isPrimary,
      label: 'Save WTID',
      location: RIGHT,
      visible: false,
    },
    {
      onClick: (e) => saveRatings(e, table),
      label: 'Save ratings',
      intent: isPrimary,
      class: 'saveRatings',
      location: RIGHT,
      visible: false,
    },
  ];

  const participantControl = document.getElementById(PARTICIPANT_CONTROL);
  controlBar({ table, target: participantControl, items });
}
