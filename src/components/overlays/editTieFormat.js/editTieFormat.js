import { createTieFormatTable } from 'components/tables/tieFormat/createTieFormatTable';
import { closeOverlay, openOverlay } from '../overlay';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

export function editTieFormat({ title, tieFormat, onClose }) {
  const { content, table } = renderEditor({ tieFormat });
  const footer = getFooter({ table, onClose });

  return openOverlay({ title, content, footer });
}

function renderEditor({ tieFormat }) {
  const contentContaner = document.createElement('div');
  contentContaner.className = 'overlay-content-container';
  const tableElement = document.createElement('div');
  contentContaner.appendChild(tableElement);

  const { table } = createTieFormatTable({ tieFormat, tableElement });

  return { content: contentContaner, table };
}

function getFooter({ table, onClose }) {
  const cleanup = () => {
    // TODO: destroy tieFormat table
    context.tables;
    closeOverlay();
  };
  const cancel = document.createElement('button');
  cancel.className = 'button is-warning is-light';
  cancel.onclick = () => {
    console.log('reset');
  };
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
  footer.appendChild(close);

  return footer;
}
