import { drawDefinitionConstants, eventConstants, entryStatusConstants } from 'tods-competition-factory';
import { changeEntryStatus } from './changeEntryStatus';
import { seedingSelector } from './seedingSelector';
import { searchField } from '../common/tableSearch'; // if searchFields are preferred on each table
import { moveSelected } from './moveSelected';
import { panelItems } from './panelItems';
import { createPair } from './createPair';
import { addToDraw } from './addToDraw';

import {
  ACCEPTED,
  ACCEPTED_PANEL,
  ALTERNATES_PANEL,
  LEFT,
  OVERLAY,
  QUALIFYING_PANEL,
  UNGROUPED_PANEL,
  WITHDRAWN_PANEL,
  acceptedEntryStatuses
} from 'constants/tmxConstants';

const { DIRECT_ACCEPTANCE, ALTERNATE, UNGROUPED, WITHDRAWN } = entryStatusConstants;
const { MAIN, QUALIFYING } = drawDefinitionConstants;
const { SINGLES } = eventConstants;

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

  const { createPairButton, createPairVisibility } = createPair(event);
  const excludeColumns = !hasFlights ? ['flights'] : [];

  // NOTE: QUALIFYING.ALTERNATE and e.g. QUALIFYING.WILDCARD are not yet supported by the UI
  return [
    {
      entries: filterEntries(acceptedEntryStatuses),
      placeholder: 'No accepted participants',
      items: [
        moveSelected(moves[ACCEPTED], eventId, drawId),
        changeEntryStatus(acceptedEntryStatuses),
        addToDraw(event),
        ...panelItems('Accepted'),
        seedingSelector
        // searchField(),
        // searchField(OVERLAY, 'participantId')
      ],
      actions: moves[ACCEPTED],
      anchorId: ACCEPTED_PANEL,
      group: ACCEPTED,
      excludeColumns
    },
    {
      entries: filterEntries([`${QUALIFYING}.${DIRECT_ACCEPTANCE}`]),
      placeholder: 'No qualifying participants',
      items: [
        // searchField(),
        // searchField(OVERLAY, 'participantId'),
        seedingSelector,
        ...panelItems('Qualifying'),
        moveSelected(moves[QUALIFYING], eventId, drawId)
      ],
      actions: [ACCEPTED, ALTERNATE, WITHDRAWN],
      anchorId: QUALIFYING_PANEL,
      group: QUALIFYING,
      excludeColumns
    },
    {
      items: [
        // searchField(),
        // searchField(OVERLAY, 'participantId'),
        ...panelItems('Alternates'),
        moveSelected(moves[ALTERNATE], eventId, drawId)
      ],
      entries: filterEntries([`${MAIN}.${ALTERNATE}`]),
      actions: [ACCEPTED, QUALIFYING, WITHDRAWN],
      excludeColumns: ['seedNumber', 'flights'],
      placeholder: 'No alternates',
      anchorId: ALTERNATES_PANEL,
      hide: drawDefinition,
      group: ALTERNATE
    },
    {
      hide: [SINGLES].includes(event?.eventType) || drawDefinition,
      items: [
        searchField(LEFT, 'participantId'),
        searchField(OVERLAY, 'participantId'),
        ...panelItems('Ungrouped'),
        createPairButton
      ],
      entries: filterEntries([`${MAIN}.${UNGROUPED}`]),
      placeholder: 'No ungrouped participants',
      excludeColumns: ['seedNumber', 'flights'],
      onSelection: createPairVisibility,
      anchorId: UNGROUPED_PANEL,
      group: UNGROUPED
    },
    {
      items: [
        // searchField(),
        // searchField(OVERLAY, 'participantId'),
        ...panelItems('Withdrawn'),
        moveSelected(moves[WITHDRAWN], eventId, drawId)
      ],
      entries: filterEntries([`${MAIN}.${WITHDRAWN}`]),
      placeholder: 'No withdrawn participants',
      excludeColumns: ['seedNumber', 'flights'],
      anchorId: WITHDRAWN_PANEL,
      hide: drawDefinition,
      actions: [ALTERNATE],
      group: WITHDRAWN,
      collapsed: true
    }
  ];
}
