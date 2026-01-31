/**
 * Draw Entries Modal - displays participants assigned to a specific draw
 * Shows table similar to Event Entries 'Accepted' panel with optional seeding functionality
 */
import { headerSortElement } from 'components/tables/common/sorters/headerSortElement';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { controlBar } from 'components/controlBar/controlBar';
import { tournamentEngine } from 'tods-competition-factory';
import { getDrawEntriesColumns } from './drawEntriesColumns/getDrawEntriesColumns';
import { drawEntriesSeedingSelector } from './drawEntriesColumns/seeding/drawEntriesSeedingSelector';
import { cancelManualSeeding } from 'components/tables/eventsTable/seeding/canceManuallSeeding';
import { saveSeeding } from 'components/tables/eventsTable/seeding/saveSeeding';
import { mapEntry } from 'pages/tournament/tabs/eventsTab/mapEntry';
import { isFunction } from 'functions/typeOf';
import { cModal } from 'courthive-components';

import { LEFT } from 'constants/tmxConstants';

export interface DrawEntriesModalParams {
  eventId: string;
  drawId: string;
  drawName?: string;
  eventName?: string;
}

export function drawEntriesModal({ eventId, drawId, drawName, eventName }: DrawEntriesModalParams): void {
  // Get draw and event data
  const { event, drawDefinition } = tournamentEngine.getEvent({ eventId, drawId });

  if (!event || !drawDefinition) {
    console.error('Event or draw not found', { eventId, drawId });
    return;
  }

  // Determine draw stage (MAIN or QUALIFYING) for seeding
  const drawStage = drawDefinition.stage || 'MAIN';

  const { participants, derivedDrawInfo } =
    tournamentEngine.getParticipants({
      participantFilters: { eventIds: [eventId] },
      withIndividualParticipants: true,
      withScaleValues: true,
      withDraws: true,
      withISO2: true,
    }) ?? {};

  // Get entries for this specific draw
  const drawEntries = drawDefinition.entries || [];
  const categoryName = event.category?.categoryName ?? event.category?.ageCategoryCode;

  // Map entries to include participant details, ratings, rankings, seeding
  const entryData = drawEntries
    .map((entry: any) =>
      mapEntry({
        eventType: event.eventType,
        derivedDrawInfo,
        categoryName,
        participants,
        eventId,
        entry,
      }),
    )
    .filter((entry: any) => entry.entryStatus !== 'WITHDRAWN'); // Exclude withdrawn entries

  // Create modal content
  const content = document.createElement('div');
  content.style.width = '100%';

  // Control bar container
  const controlElement = document.createElement('div');
  controlElement.className = 'controlBar flexrow flexcenter';
  controlElement.style.marginBottom = '1em';
  content.appendChild(controlElement);

  // Table container
  const tableElement = document.createElement('div');
  tableElement.className = 'tmxTable';
  tableElement.style.width = '100%';
  content.appendChild(tableElement);

  // Initialize Tabulator table
  const table = new Tabulator(tableElement, {
    headerSortElement: headerSortElement(['ratings.utr', 'ratings.wtn', 'seedNumber', 'ranking', 'participant']),
    columns: getDrawEntriesColumns({ entries: entryData }),
    placeholder: 'No entries in this draw',
    responsiveLayout: 'collapse',
    index: 'participantId',
    layout: 'fitColumns',
    reactiveData: true,
    height: '500px',
    data: entryData,
  });

  // Control bar items
  const items = [
    {
      label: `${entryData.length} ${entryData.length === 1 ? 'Entry' : 'Entries'}`,
      class: 'entriesCount',
      location: LEFT,
      stateDisplay: true,
    },
    drawEntriesSeedingSelector(event, drawStage, table),
    cancelManualSeeding(event),
    saveSeeding(event),
  ];

  table.on('tableBuilt', () => {
    // Process items: call functions with table to get their config objects
    const processedItems = items.map((item: any) => (isFunction(item) ? item(table) : item));
    controlBar({ target: controlElement, table, items: processedItems });
  });

  // Open modal
  const modalTitle =
    (drawName || 'Draw') +
    ' Entries' +
    (eventName ? ' - ' + eventName : '');

  // Clean up table when modal closes to prevent errors
  const onClose = () => {
    table?.destroy();
  };

  cModal.open({
    title: modalTitle,
    content,
    buttons: [
      {
        label: 'Close',
        close: true,
      },
    ],
    config: {
      maxWidth: 1400, // Set container max width to 1400px
    },
    onClose,
  });
}
