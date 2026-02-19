import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import Quill from 'quill';

export function openNotesEditor({ notes, onSave }: { notes?: string; onSave: (html: string) => void }): void {
  const content = document.createElement('div');

  const editorContainer = document.createElement('div');
  editorContainer.id = 'notesEditorQuill';
  editorContainer.style.minHeight = '300px';
  content.appendChild(editorContainer);

  const initQuill = () => {
    const quill = new Quill('#notesEditorQuill', {
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          [{ font: [] }],
          ['bold', 'italic', 'underline'],
          [{ color: [] }, { background: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ align: [] }],
          ['blockquote', 'code-block', 'link', 'video'],
          ['clean'],
        ],
      },
      theme: 'snow',
    });

    if (notes) {
      const editor = editorContainer.querySelector('.ql-editor') as HTMLElement;
      if (editor) editor.innerHTML = notes;
    }

    return quill;
  };

  // Defer Quill init to after the modal has rendered the content into the DOM
  requestAnimationFrame(() => {
    initQuill();
  });

  const handleSave = () => {
    const editor = document.querySelector('#notesEditorQuill .ql-editor') as HTMLElement;
    const innerText = editor?.innerText?.replace('\n', '');
    const html = innerText ? editor.innerHTML : '';
    onSave(html);
    closeModal();
  };

  openModal({
    title: 'Edit Overview',
    content,
    config: { maxWidth: 800, padding: '1' },
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Save', intent: 'is-primary', onClick: handleSave },
    ],
  });
}
