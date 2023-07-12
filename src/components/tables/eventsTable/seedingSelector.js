import { findAncestor, getChildrenByClassName } from 'services/dom/parentAndChild';
import { cellBorder } from '../common/formatters/cellBorder';
import { scaleConstants } from 'tods-competition-factory';

import { SET_PARTICIPANT_SCALE_ITEMS } from 'constants/mutationConstants';
import { NONE, RIGHT } from 'constants/tmxConstants';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { isFunction } from 'functions/typeOf';

const { SEEDING, MANUAL } = scaleConstants;

function hideSaveSeeding(e, table) {
  const optionsRight = findAncestor(e.target, 'options_right');
  const seedingOptions = getChildrenByClassName(optionsRight, 'seedingOptions')?.[0];
  const cancelSeeding = getChildrenByClassName(optionsRight, 'cancelSeeding')?.[0];
  const saveSeeding = getChildrenByClassName(optionsRight, 'saveSeeding')?.[0];
  if (seedingOptions) {
    if (cancelSeeding) cancelSeeding.style.display = NONE;
    if (saveSeeding) saveSeeding.style.display = NONE;
    seedingOptions.style.display = '';
  }
  table.updateColumnDefinition('seedNumber', { formatter: undefined, editable: false });
}

export const cancelSeeding = (event) => (table) => {
  const onClick = (e) => {
    hideSaveSeeding(e, table);
    removeSeeding(table);
  };

  !!event;

  return {
    class: 'cancelSeeding',
    intent: 'is-warning',
    location: RIGHT,
    label: 'Cancel',
    visible: false,
    onClick
  };
};

export function saveSeedingValues({ event, rows, callback }) {
  const { eventId, eventType } = event;
  const scaleItemsWithParticipantIds = rows.map(({ participantId, seedNumber }) => ({
    participantId,
    scaleItems: [
      {
        scaleValue: seedNumber,
        scaleType: SEEDING,
        scaleName: eventId,
        eventType
      }
    ]
  }));

  const methods = [
    {
      method: SET_PARTICIPANT_SCALE_ITEMS,
      params: {
        scaleItemsWithParticipantIds,
        removePriorValues: true,
        context: {
          scaleAttributes: { scaleType: SEEDING },
          scaleBasis: { scaleType: MANUAL },
          eventId
        }
      }
    }
  ];

  const postMutation = (result) => {
    if (result.success) {
      isFunction(callback) && callback();
    }
  };
  mutationRequest({ methods, callback: postMutation });
}

export const saveSeeding = (event) => (table) => {
  const onClick = (e) => {
    hideSaveSeeding(e, table);
    const rows = table.getData();
    saveSeedingValues({ event, rows });
  };

  return {
    label: 'Save seeding',
    class: 'saveSeeding',
    intent: 'is-info',
    location: RIGHT,
    visible: false,
    onClick
  };
};

function removeSeeding({ event, table }) {
  const rows = table.getRows();
  for (const row of rows) {
    const data = row.getData();
    data.seedNumber = undefined;
    row.update(data);
  }
  !!event;
}

function clearSeeding({ event, table }) {
  removeSeeding({ event, table });
  const rows = table.getData();
  saveSeedingValues({ event, rows });
}

export const seedingSelector = (event) => (table) => {
  const labelMap = {
    ranking: 'Seed by ranking',
    'ratings.wtn.wtnRating': 'Seed by WTN'
  };

  const seedingColumns = table
    .getColumns()
    .map((col) => col.getDefinition())
    .filter((def) => ['ranking', 'ratings.wtn.wtnRating'].includes(def.field));

  const enableManualSeeding = (e) => {
    const optionsRight = findAncestor(e.target, 'options_right');
    const saveSeeding = getChildrenByClassName(optionsRight, 'saveSeeding')?.[0];
    const cancelSeeding = getChildrenByClassName(optionsRight, 'cancelSeeding')?.[0];
    if (saveSeeding) {
      const dropdown = findAncestor(e.target, 'dropdown');
      if (cancelSeeding) cancelSeeding.style.display = '';
      saveSeeding.style.display = '';
      dropdown.style.display = NONE;
    }
    table.updateColumnDefinition('seedNumber', { formatter: cellBorder, editable: true });
  };

  const options = [
    { label: 'Manual seeding', onClick: enableManualSeeding, close: true },
    { label: 'Clear seeding', onClick: () => clearSeeding({ event, table }), close: true }
  ].concat(
    ...seedingColumns.map((column) => ({
      onClick: () => console.log(`Seed by ${column.field}`),
      label: labelMap[column.field],
      value: column.field,
      close: true
    }))
  );

  return {
    class: 'seedingOptions',
    label: 'Seeding',
    selection: false,
    location: RIGHT,
    align: RIGHT,
    options
  };
};

export function generateSeedingScaleItems() {
  // getScaledEntries...
  return {
    method: 'generateSeedingScaleItems',
    params: {
      scaledEntries: [
        // { participantId: 'pid', value: '33', order: 1 },
      ],
      seedsCount: 8,
      scaleAttributes: {
        // scaleName: eventId, scaleType: 'RANKING', eventType: 'SINGLES'
      },
      scaleName: 'eventId',
      stageEntries: [
        // { participantId: 'pid', entryStatus, entryStage, entryPosition }
      ]
    }
  };
}
