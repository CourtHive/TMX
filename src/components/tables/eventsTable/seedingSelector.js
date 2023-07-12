import { findAncestor, getChildrenByClassName } from 'services/dom/parentAndChild';
import { cellBorder } from '../common/formatters/cellBorder';

import { NONE, RIGHT } from 'constants/tmxConstants';

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

export const cancelSeeding = (table) => {
  const onClick = (e) => {
    hideSaveSeeding(e, table);
    // TODO: reset seeding column values to previous values
  };

  return {
    class: 'cancelSeeding',
    intent: 'is-warning',
    location: RIGHT,
    label: 'Cancel',
    visible: false,
    onClick
  };
};

export function saveSeedingValues({ entries, eventId, eventType }) {
  const scaleItemsWithParticipantIds = entries.map(({ participantId, seedNumber }) => ({
    participantId,
    scaleItems: [
      {
        scaleValue: seedNumber,
        scaleType: 'SEEDING',
        scaleName: eventId,
        eventType
      }
    ]
  }));
  const methods = [
    {
      method: 'setParticipantScaleItems',
      params: {
        scaleItemsWithParticipantIds,
        context: {
          scaleAttributes: { scaleType: 'SEEDING' },
          scaleBasis: { scaleType: 'MANUAL' },
          eventId: 'E0B3E1F0-event-2'
        }
      }
    }
  ];
  console.log({ methods });
}

export const saveSeeding = (table) => {
  const onClick = (e) => {
    hideSaveSeeding(e, table);
    const tableData = table.getData();
    console.log({ tableData });
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

export const seedingSelector = (table) => {
  const labelMap = {
    ranking: 'Seed by ranking',
    'ratings.wtn.wtnRating': 'Seed by WTN'
  };

  const seedingColumns = table
    .getColumns()
    .map((col) => col.getDefinition())
    .filter((def) => ['ranking', 'ratings.wtn.wtnRating'].includes(def.field));

  const updateSeedColumnDefinition = (e) => {
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

  const options = [{ label: 'Manual seeding', onClick: updateSeedColumnDefinition, close: true }].concat(
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
