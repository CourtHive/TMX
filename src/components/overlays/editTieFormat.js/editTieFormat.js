import { createTieFormatTable } from 'components/tables/tieFormat/createTieFormatTable';
import { utilities, eventConstants } from 'tods-competition-factory';
import { closeOverlay, openOverlay } from '../overlay';
import { isFunction } from 'functions/typeOf';

const { SINGLES } = eventConstants;

export function editTieFormat({ title, tieFormat, onClose }) {
  const { content, table } = renderEditor({ tieFormat });
  const footer = getFooter({ table, onClose });

  return openOverlay({ title, content, footer });
}

function renderEditor({ tieFormat }) {
  const contentContaner = document.createElement('div');
  contentContaner.className = 'overlay-content-container';

  const tableElement = document.createElement('div');
  const { table } = createTieFormatTable({ tieFormat, tableElement });

  const overview = getOverview(table);
  contentContaner.appendChild(overview);
  contentContaner.appendChild(tableElement);

  return { content: contentContaner, table };
}

function getOverview(table) {
  const overview = document.createElement('div');
  overview.className = 'overlay-content-overview';
  const overviewBody = document.createElement('div');
  overviewBody.className = 'overlay-content-body';

  overview.appendChild(overviewBody);

  const button = document.createElement('button');
  button.className = 'button is-info';
  button.innerHTML = 'Add collection';
  button.onclick = () =>
    table.addRow({
      collectionName: 'Singles collection',
      collectionId: utilities.UUID(),
      matchUpType: SINGLES,
      matchUpCount: 1
    });
  overview.appendChild(button);

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
    cleanup();

    !!table; // TODO: extract collectionDefinitions from table rows

    isFunction(onClose) && onClose({ tieFormat: true });
  };
  close.innerHTML = 'Done';

  const footer = document.createElement('div');
  footer.className = 'overlay-footer-wrap';
  footer.appendChild(cancel);
  footer.appendChild(close);

  return footer;
}
