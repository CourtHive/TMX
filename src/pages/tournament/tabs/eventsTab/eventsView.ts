/**
 * Events view with table and control bar.
 * Provides event management actions including add, delete, and search.
 */
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { createEventsTable } from 'components/tables/eventsTable/createEventsTable';
import { mapEvent } from 'pages/tournament/tabs/eventsTab/mapEvent';
import { deleteEvents } from 'components/modals/deleteEvents';
import { controlBar } from 'courthive-components';
import { editEvent } from './editEvent';
import { t } from 'i18n';

// constants
import { EVENTS_CONTROL, LEFT, OVERLAY, RIGHT } from 'constants/tmxConstants';

export function eventsView(): void {
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

  const items = [
    {
      onClick: deleteAction,
      label: t('pages.events.deleteSelected'),
      intent: 'is-danger',
      stateChange: true,
      location: OVERLAY,
    },
    {
      onKeyDown: (e: KeyboardEvent) =>
        e.key === 'Backspace' && (e.target as HTMLInputElement).value.length === 1 && setSearchFilter(''),
      onChange: (e: Event) => setSearchFilter((e.target as HTMLInputElement).value),
      onKeyUp: (e: Event) => setSearchFilter((e.target as HTMLInputElement).value),
      clearSearch: () => setSearchFilter(''),
      placeholder: t('pages.events.searchEvents'),
      location: LEFT,
      search: true,
    },
    {
      onClick: () => (editEvent as any)({ callback: eventAdded }),
      label: t('pages.events.addEvent'),
      location: RIGHT,
    },
  ];

  const target = document.getElementById(EVENTS_CONTROL) || undefined;
  controlBar({ table, target, items });
}
