/**
 * Panel definitions for event entries table.
 * Organizes participants by entry status (accepted, qualifying, alternates, etc.).
 */
import { drawDefinitionConstants, eventConstants, entryStatusConstants } from 'tods-competition-factory';
import { cancelManualSeeding } from './seeding/canceManuallSeeding';
import { seedingSelector } from './seeding/seedingSelector';
import { changeEntryStatus } from './changeEntryStatus';
import { panelItems, togglePanel } from './panelItems';
import { searchField } from '../common/tableSearch';
import { saveSeeding } from './seeding/saveSeeding';
import { destroySelected } from './destroyPairs';
import { createFlight } from './createFlight';
import { moveSelected } from './moveSelected';
import { addEntries } from './addEntries';
import { createPair } from './createPair';
import { addToDraw } from './addToDraw';

import { acceptedEntryStatuses } from 'constants/acceptedEntryStatuses';
import {
  ACCEPTED,
  ACCEPTED_PANEL,
  ALTERNATES_PANEL,
  LEFT,
  OVERLAY,
  QUALIFYING_PANEL,
  RIGHT,
  UNGROUPED_PANEL,
  WITHDRAWN_PANEL,
} from 'constants/tmxConstants';

const { DIRECT_ACCEPTANCE, ALTERNATE, UNGROUPED, WITHDRAWN } = entryStatusConstants;
const { MAIN, QUALIFYING } = drawDefinitionConstants;
const { SINGLES, DOUBLES } = eventConstants;

export function panelDefinitions({ drawDefinition, event, entryData, hasFlights }: any): any[] {
  const filterEntries = (groupings: string[]) =>
    entryData.filter(({ entryStage = MAIN, entryStatus }: any) => {
      return groupings.includes(`${entryStage}.${entryStatus}`);
    });

  const drawCreated = !!drawDefinition;
  const drawId = drawDefinition?.drawId;
  const eventId = event?.eventId;

  const moves: Record<string, string[]> = {
    [ACCEPTED]: [ALTERNATE, WITHDRAWN],
    [QUALIFYING]: [ACCEPTED, ALTERNATE, WITHDRAWN],
    [ALTERNATE]: [ACCEPTED, QUALIFYING, WITHDRAWN],
    [WITHDRAWN]: event?.eventType === DOUBLES ? [UNGROUPED] : [ALTERNATE],
  };

  // Get createPair functionality - we handle auto-pair logic separately via toggle
  const { createPairButton } = createPair(event, false);
  const excludeColumns = !hasFlights ? ['flights'] : [];

  const selectWithEnter = (table: any): boolean => {
    const active = table.getData('active');
    const participantIds = active.map(({ participantId }: any) => participantId);
    if (active.length === 1) {
      table.selectRow(participantIds);
      return true;
    } else if (active.length === 2) {
      table.selectRow(participantIds);
      return false;
    }
    return false;
  };

  const handleUngroupedSelection = (selectedRows: any[]) => {
    // Clear LEFT search fields and focus OVERLAY search when selection occurs
    if (selectedRows?.length) {
      const searchFields = document.getElementsByClassName('search');
      Array.from(searchFields).forEach((field: any) => {
        if (field.value) field.value = '';
      });
      
      // Focus the OVERLAY search field after a brief delay
      setTimeout(() => {
        const overlaySearch = document.querySelector('.options_overlay .search') as HTMLInputElement;
        if (overlaySearch) overlaySearch.focus();
      }, 50);
    }
    
    // Initialize and check auto-pair state
    const createPairBtn = document.getElementById('create-pair') as HTMLButtonElement;
    const autoPairToggle = document.getElementById('auto-pair-toggle');
    
    // Initialize data-enabled attribute if not set
    if (autoPairToggle && !autoPairToggle.hasAttribute('data-enabled')) {
      autoPairToggle.setAttribute('data-enabled', 'true');
    }
    
    const isAutoPairEnabled = autoPairToggle?.getAttribute('data-enabled') === 'true';
    const twoSelected = selectedRows?.length === 2;
    
    // Handle pair creation based on auto-pair state
    if (event?.eventType === DOUBLES && twoSelected) {
      if (isAutoPairEnabled) {
        // Auto-pair is ON: programmatically click the create pair button
        createPairBtn?.click();
      } else {
        // Auto-pair is OFF: show the Create Pair button
        if (createPairBtn) createPairBtn.style.display = '';
      }
    } else {
      // Not 2 selected: hide the Create Pair button
      if (createPairBtn) createPairBtn.style.display = 'none';
    }
  };

  const acceptedEntries = filterEntries(acceptedEntryStatuses(MAIN));
  const qualifyingEntries = filterEntries([`${QUALIFYING}.${DIRECT_ACCEPTANCE}`]);
  const alternateEntries = filterEntries([`${MAIN}.${ALTERNATE}`]);
  const ungroupedEntries = filterEntries([`${MAIN}.${UNGROUPED}`]);
  const withdrawnEntries = filterEntries([`${MAIN}.${WITHDRAWN}`]);

  return [
    {
      placeholder: 'No accepted participants',
      items: [
        moveSelected(moves[ACCEPTED], eventId, drawId),
        changeEntryStatus(acceptedEntryStatuses(MAIN), eventId, drawId),
        addToDraw(event, drawId),
        createFlight(event, drawId),
        ...panelItems({ heading: 'Accepted', count: acceptedEntries.length }),
        !drawCreated && seedingSelector(event, ACCEPTED),
        cancelManualSeeding(event),
        saveSeeding(event),
        !drawCreated && addEntries(event, ACCEPTED),
      ],
      actions: moves[ACCEPTED],
      anchorId: ACCEPTED_PANEL,
      entries: acceptedEntries,
      group: ACCEPTED,
      excludeColumns,
      drawCreated,
      togglePanel,
    },
    {
      placeholder: 'No qualifying participants',
      items: [
        ...panelItems({ heading: 'Qualifying', count: qualifyingEntries.length }),
        moveSelected(moves[QUALIFYING], eventId, drawId),
        !drawCreated && seedingSelector(event, QUALIFYING),
        cancelManualSeeding(event),
        saveSeeding(event),
        !drawCreated && addEntries(event, QUALIFYING),
      ],
      actions: [ACCEPTED, ALTERNATE, WITHDRAWN],
      anchorId: QUALIFYING_PANEL,
      entries: qualifyingEntries,
      group: QUALIFYING,
      excludeColumns,
      drawCreated,
      togglePanel,
    },
    {
      items: [
        ...panelItems({ heading: 'Alternates', count: alternateEntries.length }),
        moveSelected(moves[ALTERNATE], eventId, drawId),
        event?.eventType === DOUBLES && destroySelected(eventId, drawId),
        !drawCreated && addEntries(event, ALTERNATE),
      ],
      actions: [ACCEPTED, QUALIFYING, WITHDRAWN],
      excludeColumns: ['seedNumber', 'flights'],
      placeholder: 'No alternates',
      anchorId: ALTERNATES_PANEL,
      entries: alternateEntries,
      group: ALTERNATE,
      drawCreated,
      togglePanel,
    },
    {
      hide: !!([SINGLES].includes(event?.eventType) || drawCreated),
      items: [
        ...panelItems({ heading: 'Ungrouped', count: ungroupedEntries.length }),
        searchField(LEFT, 'participantId', selectWithEnter),
        searchField(OVERLAY, 'participantId', selectWithEnter),
        createPairButton,
        moveSelected([WITHDRAWN], eventId, drawId),
        {
          hide: event?.eventType !== DOUBLES,
          onClick: (e: any) => {
            const button = e.target.closest('button');
            const isEnabled = button.getAttribute('data-enabled') === 'true';
            const newState = !isEnabled;
            button.setAttribute('data-enabled', String(newState));
            button.innerHTML = `Auto Pair: ${newState ? 'ON' : 'OFF'}`;
            
            // Hide create pair button if auto-pair is enabled
            const createPairBtn = document.getElementById('create-pair');
            if (createPairBtn && newState) {
              createPairBtn.style.display = 'none';
            }
          },
          label: 'Auto Pair: ON',
          intent: 'is-info',
          id: 'auto-pair-toggle',
          location: RIGHT,
        },
      ],
      placeholder: 'No ungrouped participants',
      excludeColumns: ['seedNumber', 'flights'],
      onSelection: handleUngroupedSelection,
      anchorId: UNGROUPED_PANEL,
      entries: ungroupedEntries,
      actions: [WITHDRAWN],
      group: UNGROUPED,
      drawCreated,
      togglePanel,
    },
    {
      items: [
        ...panelItems({ heading: 'Withdrawn', count: withdrawnEntries.length }),
        !drawCreated && moveSelected(moves[WITHDRAWN], eventId, drawId),
      ],
      placeholder: 'No withdrawn participants',
      excludeColumns: ['seedNumber', 'flights'],
      anchorId: WITHDRAWN_PANEL,
      entries: withdrawnEntries,
      actions: moves[WITHDRAWN],
      hide: drawCreated,
      group: WITHDRAWN,
      collapsed: true,
      drawCreated,
      togglePanel,
    },
  ];
}
