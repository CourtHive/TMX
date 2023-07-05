import { createTieFormatTable } from 'components/tables/tieFormat/createTieFormatTable';
import { nameValidator } from 'components/validators/nameValidator';
import { controlBar } from 'components/controlBar/controlBar';
import { closeOverlay, openOverlay } from '../overlay';
import { utilities } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';

import { LEFT, OVERLAY, RIGHT } from 'constants/tmxConstants';

function winCriteriaText(value) {
  return `<div style="font-weight: bold">Win criteria: <span class="has-text-success">${value}</span></div>`;
}

export function editTieFormat({ title, tieFormat, onClose }) {
  const { content, inputs, elements, table } = renderEditor({ tieFormat });

  window.elements = elements;
  if (tieFormat?.winCriteria) {
    console.log(elements['winCriteria']);
  }

  const constructTieFormat = (rows) => {
    const tieFormatName = inputs['tieFormatName'].value;

    const collectionDefinitions = rows.map((row) =>
      utilities.definedAttributes({
        collectionValue: row.awardType === 'Collection value' ? row.awardValue : undefined,
        matchUpValue: row.awardType === 'Match value' ? row.awardValue : undefined,
        scoreValue: row.awardType === 'Score value' ? row.awardValue : undefined,
        setValue: row.awardType === 'Set value' ? row.awardValue : undefined,

        matchUpType: row.matchUpType.toUpperCase(),
        collectionName: row.collectionName,
        matchUpFormat: row.matchUpFormat,
        gender: row.gender.toUpperCase(),
        collectionId: row.collectionId,
        matchUpCount: row.matchUpCount
      })
    );

    const winCriteria = utilities.calculateWinCriteria({ collectionDefinitions });

    return {
      collectionDefinitions,
      tieFormatName,
      winCriteria
    };
  };

  table.on('dataChanged', () => {
    const tieFormat = constructTieFormat(table.getData());
    const valueGoal = tieFormat.winCriteria.valueGoal;
    const aggregateValue = tieFormat.collectionDefinitions?.length
      ? tieFormat.winCriteria.aggregateValue && 'Aggregate value'
      : 'none';
    elements['winCriteria'].innerHTML = winCriteriaText(valueGoal || aggregateValue);
  });

  const prepareExit = (rows) => {
    const tieFormat = constructTieFormat(rows);
    isFunction(onClose) && onClose(tieFormat?.collectionDefinitions?.length && tieFormat);
  };

  const footer = getFooter({ table, onClose: prepareExit });

  return openOverlay({ title, content, footer });
}

function renderEditor({ tieFormat }) {
  const contentContainer = document.createElement('div');
  contentContainer.className = 'overlay-content-container';
  contentContainer.style.backgroundColor = 'white';

  const tableElement = document.createElement('div');
  const { table } = createTieFormatTable({ tieFormat, tableElement });

  const overview = getOverview(table);
  contentContainer.appendChild(overview);

  const controlTarget = document.createElement('div');
  contentContainer.appendChild(controlTarget);
  contentContainer.appendChild(tableElement);

  const deleteRows = () => {
    const collectionIds = table?.getSelectedData().map(({ collectionId }) => collectionId);
    table?.deleteRow(collectionIds);
  };

  const items = [
    {
      error: 'Please enter a name of at least 5 characters',
      placeholder: 'Scorecard name',
      validator: nameValidator(5),
      value: 'Custom scorecard',
      field: 'tieFormatName',
      id: 'tieFormatName',
      location: LEFT
    },
    {
      text: winCriteriaText('none'),
      id: 'winCriteria',
      location: LEFT
    },
    {
      onClick: deleteRows,
      label: 'Delete selected',
      intent: 'is-danger',
      stateChange: true,
      location: OVERLAY
    },
    {
      onClick: () => {
        const rowCount = table.getData().length;

        table.addRow({
          collectionName: `Collection ${rowCount + 1}`,
          collectionId: utilities.UUID(),
          awardType: 'Match value', // collection value, set value, score value
          matchUpFormat: 'SET3-S:6/TB7',
          collectionOrder: rowCount + 1,
          matchUpType: 'Singles',
          matchUpCount: 1,
          gender: 'Mixed',
          awardValue: 1
        });
      },
      label: 'Add collection',
      intent: 'is-info',
      location: RIGHT
    }
  ];

  const { elements, inputs } = controlBar({ table, target: controlTarget, items });

  return { content: contentContainer, table, elements, inputs };
}

function getOverview(table) {
  const overview = document.createElement('div');
  overview.className = 'overlay-content-overview';
  const overviewBody = document.createElement('div');
  overviewBody.className = 'overlay-content-body';

  overview.appendChild(overviewBody);

  !!table;

  return overview;
}

function getFooter({ table, onClose }) {
  const cleanup = () => {
    table.destroy();
    closeOverlay();
  };
  const cancel = document.createElement('button');
  cancel.className = 'button is-warning is-light';
  cancel.onclick = cleanup;
  cancel.innerHTML = 'Cancel';

  const close = document.createElement('button');
  close.className = 'button is-info button-spacer';
  close.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const data = table.getData();
    cleanup();
    isFunction(onClose) && onClose(data);
  };
  close.innerHTML = 'Done';

  const footer = document.createElement('div');
  footer.className = 'overlay-footer-wrap';
  footer.appendChild(cancel);
  footer.appendChild(close);

  return footer;
}
