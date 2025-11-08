/**
 * Events view with table and control bar.
 * Provides event management actions including add, delete, search, and OOP publish/unpublish.
 */
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { createEventsTable } from 'components/tables/eventsTable/createEventsTable';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { mapEvent } from 'pages/tournament/tabs/eventsTab/mapEvent';
import { deleteEvents } from 'components/modals/deleteEvents';
import { controlBar } from 'components/controlBar/controlBar';
import { tournamentEngine } from 'tods-competition-factory';
import { editEvent } from './editEvent';

import { EVENTS_CONTROL, LEFT, OVERLAY, RIGHT } from 'constants/tmxConstants';

export function eventsView(): void {
  const tournamentPubState = tournamentEngine.getPublishState().publishState?.tournament;

  const { table } = createEventsTable();

  const eventAdded = (result: any) => {
    if (result?.event) {
      const tableRow = mapEvent({ event: result.event });
      table?.updateOrAddData([tableRow]);
    }
  };

  const setSearchFilter = createSearchFilter(table);
  const deleteAction = () => {
    const eventIds = table?.getSelectedData().map(({ eventId }: any) => eventId);

    const callback = (result: any) => result.success && table?.deleteRow(eventIds);
    return deleteEvents({ eventIds, callback });
  };

  const oopAction = (p: boolean) => (p ? 'Unpublish' : 'Publish');
  const oopButtonLabel = (pd: any) => `${oopAction(pd)} OOP`;
  const updateOopState = (result: any) => {
    if (result?.success) {
      const tournamentPubState = tournamentEngine.getPublishState().publishState?.tournament;
      const button = document.getElementById('oopButton')!;
      button.innerText = oopButtonLabel(tournamentPubState?.orderOfPlay?.published);
      button.classList.toggle('is-primary');
    }
  };

  const items = [
    {
      onClick: deleteAction,
      label: 'Delete selected',
      intent: 'is-danger',
      stateChange: true,
      location: OVERLAY,
    },
    {
      onKeyDown: (e: KeyboardEvent) => e.keyCode === 8 && (e.target as HTMLInputElement).value.length === 1 && setSearchFilter(''),
      onChange: (e: Event) => setSearchFilter((e.target as HTMLInputElement).value),
      onKeyUp: (e: Event) => setSearchFilter((e.target as HTMLInputElement).value),
      clearSearch: () => setSearchFilter(''),
      placeholder: 'Search events',
      location: LEFT,
      search: true,
    },
    {
      onClick: () => toggleOOP(updateOopState),
      label: oopButtonLabel(tournamentPubState?.orderOfPlay?.published),
      intent: tournamentPubState?.orderOfPlay?.published ? 'is-primary' : '',
      id: 'oopButton',
      location: RIGHT,
    },
    {
      onClick: () => (editEvent as any)({ callback: eventAdded }),
      label: 'Add event',
      location: RIGHT,
    },
  ];

  const target = document.getElementById(EVENTS_CONTROL);
  controlBar({ table, target, items });
}

function toggleOOP(callback: (result: any) => void) {
  const tournamentPubState = tournamentEngine.getPublishState().publishState?.tournament;
  const published = tournamentPubState?.orderOfPlay?.published;
  const method = published ? 'unPublishOrderOfPlay' : 'publishOrderOfPlay';
  const methods = [{ method }];
  mutationRequest({ methods, callback });
}
