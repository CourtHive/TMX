/**
 * Renders individuals (players) tab with table and controls.
 * Displays individual participants with filtering, editing, and management options.
 */
import { enableManualRatings } from 'components/tables/participantsTable/editRatings/enableManualRatings';
import { createParticipantsTable } from 'components/tables/participantsTable/createParticipantsTable';
import { enableEditWTID } from 'components/tables/participantsTable/editWTID/enableEditWTID';
import { saveRatings } from 'components/tables/participantsTable/editRatings/saveRatings';
import { filterPopoverButton } from 'components/tables/common/filters/filterPopoverButton';
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
import { controlBar } from 'courthive-components';
import { selectItem } from 'components/modals/selectItem';
import { participantChips } from './participantChips';
import { participantConstants, tournamentEngine, extensionConstants } from 'tods-competition-factory';
import { t } from 'i18n';

import { PARTICIPANT_CONTROL, OVERLAY, RIGHT, LEFT } from 'constants/tmxConstants';

const { INDIVIDUAL, GROUP } = participantConstants;

const isPrimary = 'is-primary';

export function renderIndividuals({ view }: { view: string }): void {
  const { table, replaceTableData, teamParticipants, groupParticipants } = createParticipantsTable({ view });

  const setSearchFilter = createSearchFilter(table);
  const { extension } = tournamentEngine.findExtension({ discover: true, name: extensionConstants.REGISTRATION });
  const registration = extension?.value;
  const state = getLoginState();
  const canEditTennisId = state?.roles?.includes('superadmin') || state?.permissions?.includes('editTennisId');

  // Callback that refreshes data and rebuilds the component after event changes
  const refreshAfterEventChange = () => renderIndividuals({ view });

  const { eventOptions, events, isFiltered: isEventFiltered } = getEventFilter(table);
  const { sexOptions, isFiltered: isSexFiltered } = getSexFilter(table);
  const { teamOptions, isFiltered: isTeamFiltered } = getTeamFilter({ table, teamParticipants });

  const filterSections = [
    { label: t('pages.participants.allEvents'), options: events.length ? eventOptions : [], isFiltered: isEventFiltered },
    { label: t('pages.participants.anyTeam'), options: teamParticipants?.length ? teamOptions : [], isFiltered: isTeamFiltered },
    { label: t('pages.participants.allGenders'), options: sexOptions, isFiltered: isSexFiltered },
  ];
  const { item: filterButton } = filterPopoverButton(filterSections);

  const editRegistrationLink = () => sheetsLink({ callback: replaceTableData });

  const synchronizePlayers = () => {
    (updateRegisteredPlayers as any)({
      callback: () => {
        replaceTableData();
        table?.redraw(true);
      },
      showNotice: true,
    });
  };

  const actionOptions: any[] = [
    {
      onClick: () => signOutUnapproved(replaceTableData),
      label: t('pages.participants.signOutUnapproved'),
      close: true,
    },
    {
      onClick: (e: any) => enableManualRatings(e, table),
      label: t('pages.participants.editRatings'),
      close: true,
    },
    {
      onClick: (e: any) => enableEditWTID(e, table),
      hide: !canEditTennisId,
      label: t('pages.participants.editWTID'),
      close: true,
    },
    { divider: true } as any,
    { heading: t('pages.participants.addParticipants') } as any,
    { hide: registration, label: t('pages.participants.generateMock'), onClick: synchronizePlayers, close: true },
    { label: t('pages.participants.importGoogleSheet'), onClick: editRegistrationLink, close: true },
    {
      onClick: () => editIndividualParticipant({ callback: replaceTableData, view }),
      label: t('pages.participants.newParticipant'),
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
      location: OVERLAY,
      search: true,
    },
    {
      options: addToEventOptions,
      label: t('pages.participants.addToEvent.label'),
      hide: !events.length,
      intent: 'is-none',
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
      intent: 'is-none',
      location: OVERLAY,
    },
    {
      selection: addToGroup,
      selectionTitle: t('pages.participants.addToGroup'),
      label: t('pages.participants.addToGroup'),
      intent: 'is-none',
      location: OVERLAY,
    },
    {
      onClick: () => signInParticipants(table),
      intent: isPrimary,
      location: OVERLAY,
      label: t('pages.participants.signIn'),
    },
    {
      onClick: () => deleteSelectedParticipants(table),
      label: t('pages.participants.deleteSelected'),
      intent: 'is-danger',
      stateChange: true,
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
      location: LEFT,
      search: true,
    },
    filterButton,
    ...participantChips(view),
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
}
