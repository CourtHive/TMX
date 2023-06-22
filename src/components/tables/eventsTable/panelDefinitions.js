import { drawDefinitionConstants, eventConstants, entryStatusConstants } from 'tods-competition-factory';
import { changeEntryStatus } from './changeEntryStatus';
import { seedingSelector } from './seedingSelector';
import { searchField } from '../common/tableSearch'; // if searchFields are preferred on each table
import { destroySelected } from './destroyPairs';
import { moveSelected } from './moveSelected';
import { panelItems } from './panelItems';
import { createPair } from './createPair';
import { addToDraw } from './addToDraw';

import {
  ACCEPTED,
  ACCEPTED_PANEL,
  ALTERNATES_PANEL,
  LEFT,
  QUALIFYING_PANEL,
  UNGROUPED_PANEL,
  WITHDRAWN_PANEL,
  acceptedEntryStatuses
} from 'constants/tmxConstants';

const { DIRECT_ACCEPTANCE, ALTERNATE, UNGROUPED, WITHDRAWN } = entryStatusConstants;
const { MAIN, QUALIFYING } = drawDefinitionConstants;
const { SINGLES, DOUBLES } = eventConstants;

export function panelDefinitions({ drawDefinition, event, entryData, hasFlights }) {
  const filterEntries = (groupings) =>
    entryData.filter(({ entryStage = MAIN, entryStatus }) => {
      return groupings.includes(`${entryStage}.${entryStatus}`);
    });

  const drawId = drawDefinition?.drawId;
  const eventId = event?.eventId;

  const moves = {
    [ACCEPTED]: [ALTERNATE, WITHDRAWN],
    [QUALIFYING]: [ACCEPTED, ALTERNATE, WITHDRAWN],
    [ALTERNATE]: [ACCEPTED, QUALIFYING, WITHDRAWN],
    [WITHDRAWN]: [ALTERNATE]
  };

  // NOTE: auto-pair can be turned off and createPairButton enabled
  const { /*createPairButton,*/ createPairFromSelected } = createPair(event);
  const excludeColumns = !hasFlights ? ['flights'] : [];

  const selectWithEnter = (table) => {
    const active = table.getData('active');
    const participantIds = active.map(({ participantId }) => participantId);
    if (active.length === 1) {
      table.selectRow(participantIds);
      return true;
    } else if (active.length === 2) {
      table.selectRow(participantIds);
    }
  };

  // group entries
  const acceptedEntries = filterEntries(acceptedEntryStatuses);
  const qualifyingEntries = filterEntries([`${QUALIFYING}.${DIRECT_ACCEPTANCE}`]);
  const alternateEntries = filterEntries([`${MAIN}.${ALTERNATE}`]);
  const ungroupedEntries = filterEntries([`${MAIN}.${UNGROUPED}`]);
  const withdrawnEntries = filterEntries([`${MAIN}.${WITHDRAWN}`]);

  // NOTE: QUALIFYING.ALTERNATE and e.g. QUALIFYING.WILDCARD are not yet supported by the UI
  return [
    {
      placeholder: 'No accepted participants',
      items: [
        moveSelected(moves[ACCEPTED], eventId, drawId),
        changeEntryStatus(acceptedEntryStatuses),
        addToDraw(event),
        ...panelItems({ heading: 'Accepted', count: acceptedEntries.length }),
        seedingSelector
        // searchField(),
        // searchField(OVERLAY, 'participantId')
      ],
      actions: moves[ACCEPTED],
      anchorId: ACCEPTED_PANEL,
      entries: acceptedEntries,
      group: ACCEPTED,
      excludeColumns
    },
    {
      placeholder: 'No qualifying participants',
      items: [
        ...panelItems({ heading: 'Qualifying', count: qualifyingEntries.length }),
        moveSelected(moves[QUALIFYING], eventId, drawId),
        seedingSelector
        // searchField(),
        // searchField(OVERLAY, 'participantId'),
      ],
      actions: [ACCEPTED, ALTERNATE, WITHDRAWN],
      anchorId: QUALIFYING_PANEL,
      entries: qualifyingEntries,
      group: QUALIFYING,
      excludeColumns
    },
    {
      items: [
        // searchField(),
        // searchField(OVERLAY, 'participantId'),
        ...panelItems({ heading: 'Alternates', count: alternateEntries.length }),
        moveSelected(moves[ALTERNATE], eventId, drawId),
        event?.eventType === DOUBLES && destroySelected(eventId, drawId)
      ],
      actions: [ACCEPTED, QUALIFYING, WITHDRAWN],
      excludeColumns: ['seedNumber', 'flights'],
      placeholder: 'No alternates',
      anchorId: ALTERNATES_PANEL,
      entries: alternateEntries,
      hide: drawDefinition,
      group: ALTERNATE
    },
    {
      hide: [SINGLES].includes(event?.eventType) || drawDefinition,
      items: [
        ...panelItems({ heading: 'Ungrouped', count: ungroupedEntries.length }),
        searchField(LEFT, 'participantId', selectWithEnter)
        // searchField(OVERLAY, 'participantId'),
        // createPairButton
      ],
      placeholder: 'No ungrouped participants',
      excludeColumns: ['seedNumber', 'flights'],
      onSelection: createPairFromSelected,
      anchorId: UNGROUPED_PANEL,
      entries: ungroupedEntries,
      group: UNGROUPED
    },
    {
      items: [
        // searchField(),
        // searchField(OVERLAY, 'participantId'),
        ...panelItems({ heading: 'Withdrawn', count: withdrawnEntries.length }),
        moveSelected(moves[WITHDRAWN], eventId, drawId)
      ],
      placeholder: 'No withdrawn participants',
      excludeColumns: ['seedNumber', 'flights'],
      anchorId: WITHDRAWN_PANEL,
      entries: withdrawnEntries,
      hide: drawDefinition,
      actions: [ALTERNATE],
      group: WITHDRAWN,
      collapsed: true
    }
  ];
}
