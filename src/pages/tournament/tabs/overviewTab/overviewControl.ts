import { removeAllChildNodes } from 'services/dom/transformers';
import { controlBar } from 'components/controlBar/controlBar';
import { context } from 'services/context';
import Quill from 'quill';

import { RIGHT } from 'constants/tmxConstants';

export function overviewControl({ controlAnchor }) {
  const overviewState = { editing: false };
  const toggleEditor = () => {
    const editButton = document.getElementById('editOverview');
    editButton.innerHTML = !overviewState.editing ? 'Save overview' : 'Edit overview';
    const notesView = document.getElementById('notes');
    if (!overviewState.editing) {
      notesView.style.border = '.5px solid';
      notesView.style.borderTop = '';
      const quill = new Quill('#notes', { theme: 'snow' });
      context.quill = quill;
    } else {
      notesView.previousElementSibling.remove();
      notesView.style.border = 'none';
      notesView.className = '';
      const content = notesView.querySelector('.ql-editor').innerHTML;
      removeAllChildNodes(notesView);
      notesView.innerHTML = content;
    }
    overviewState.editing = !overviewState.editing;
  };
  const items = [
    {
      label: 'Edit overview',
      onClick: toggleEditor,
      id: 'editOverview',
      location: RIGHT,
      intent: 'none',
    },
  ];

  return controlBar({ target: controlAnchor, items }).elements;
}
