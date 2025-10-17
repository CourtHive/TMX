import { editTournamentImage } from 'components/modals/tournamentImage';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { removeAllChildNodes } from 'services/dom/transformers';
import { controlBar } from 'components/controlBar/controlBar';
import { context } from 'services/context';
import Quill from 'quill';

import { SET_TOURNAMENT_NOTES } from 'constants/mutationConstants';
import { RIGHT } from 'constants/tmxConstants';

export function overviewControl({ controlAnchor }) {
  const overviewState = { editing: false };
  const toggleEditor = () => {
    const editButton = document.getElementById('editOverview');
    const notesView = document.getElementById('notes');
    if (editButton && notesView) {
      editButton.innerHTML = !overviewState.editing ? 'Save overview' : 'Edit overview';
      if (!overviewState.editing) {
        notesView.style.border = '.5px solid';
        notesView.style.borderTop = '';
        const quill = new Quill('#notes', {
          modules: {
            toolbar: [
              [{ header: [1, 2, 3, 4, 5, 6, false] }],
              [{ font: [] }],
              ['bold', 'italic', 'underline'],
              [{ color: [] }, { background: [] }],
              [{ list: 'ordered' }, { list: 'bullet' }],
              [{ align: [] }],

              ['blockquote', 'code-block', /* 'image', */ 'link', 'video'],
              ['clean'],
            ],
          },
          theme: 'snow',
        });
        context.quill = quill;
      }
    } else if (notesView) {
      if (notesView.previousElementSibling) notesView.previousElementSibling.remove();
      notesView.style.border = 'none';
      const editor: any = notesView.querySelector('.ql-editor');
      const innerText = editor?.innerText?.replace('\n', '');
      const content = innerText ? editor.innerHTML : '';
      removeAllChildNodes(notesView);
      notesView.innerHTML = content;
      const methods = [{ method: SET_TOURNAMENT_NOTES, params: { notes: content } }];
      mutationRequest({ methods });
    }
    overviewState.editing = !overviewState.editing;
  };
  const items = [
    {
      label: 'Tournament image',
      onClick: editTournamentImage,
      id: 'tournamentImage',
      location: RIGHT,
      intent: 'none',
    },
    {
      label: 'Edit overview',
      onClick: toggleEditor,
      id: 'editOverview',
      location: RIGHT,
      intent: 'none',
    },
  ];

  return controlBar({ target: controlAnchor, items })?.elements;
}
