import { notesToolbar, updateToolbarState, updateHeadingSelect } from 'courthive-components';
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { TextStyle } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';
import Youtube from '@tiptap/extension-youtube';
import StarterKit from '@tiptap/starter-kit';
import { Editor } from '@tiptap/core';
import { t } from 'i18n';

export function openNotesEditor({ notes, onSave }: { notes?: string; onSave: (html: string) => void }): void {
  const content = document.createElement('div');
  let editor: Editor | undefined;

  const toolbar = notesToolbar({
    onHeading: (level) => {
      if (!editor) return;
      if (level === false) {
        editor.chain().focus().setParagraph().run();
      } else {
        editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
      }
    },
    onBold: () => editor?.chain().focus().toggleBold().run(),
    onItalic: () => editor?.chain().focus().toggleItalic().run(),
    onUnderline: () => editor?.chain().focus().toggleUnderline().run(),
    onStrike: () => editor?.chain().focus().toggleStrike().run(),
    onColor: (color) => editor?.chain().focus().setColor(color).run(),
    onBackground: (color) => editor?.chain().focus().setHighlight({ color }).run(),
    onBulletList: () => editor?.chain().focus().toggleBulletList().run(),
    onOrderedList: () => editor?.chain().focus().toggleOrderedList().run(),
    onAlign: (align) => editor?.chain().focus().setTextAlign(align).run(),
    onBlockquote: () => editor?.chain().focus().toggleBlockquote().run(),
    onCodeBlock: () => editor?.chain().focus().toggleCodeBlock().run(),
    onLink: (url) => editor?.chain().focus().setLink({ href: url }).run(),
    onVideo: (url) => editor?.commands.setYoutubeVideo({ src: url }),
    onClearFormatting: () => editor?.chain().focus().clearNodes().unsetAllMarks().run(),
  });

  content.appendChild(toolbar);

  const editorContainer = document.createElement('div');
  editorContainer.className = 'notes-editor-content';
  editorContainer.style.minHeight = '300px';
  content.appendChild(editorContainer);

  const syncToolbarState = () => {
    if (!editor) return;
    updateToolbarState(toolbar, {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      orderedList: editor.isActive('orderedList'),
      bulletList: editor.isActive('bulletList'),
      blockquote: editor.isActive('blockquote'),
      codeBlock: editor.isActive('codeBlock'),
      alignLeft: editor.isActive({ textAlign: 'left' }),
      alignCenter: editor.isActive({ textAlign: 'center' }),
      alignRight: editor.isActive({ textAlign: 'right' }),
      alignJustify: editor.isActive({ textAlign: 'justify' }),
    });

    for (let i = 1; i <= 6; i++) {
      if (editor.isActive('heading', { level: i })) {
        updateHeadingSelect(toolbar, i);
        return;
      }
    }
    updateHeadingSelect(toolbar, false);
  };

  requestAnimationFrame(() => {
    editor = new Editor({
      element: editorContainer,
      extensions: [
        StarterKit,
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Youtube.configure({ inline: false }),
      ],
      content: notes || '',
      onSelectionUpdate: syncToolbarState,
      onTransaction: syncToolbarState,
    });
  });

  const handleSave = () => {
    if (!editor) return;
    const html = editor.isEmpty ? '' : editor.getHTML();
    editor.destroy();
    onSave(html);
    closeModal();
  };

  openModal({
    title: t('modals.notesEditor.title'),
    content,
    config: { maxWidth: 800, padding: '1' },
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('common.save'), intent: 'is-primary', onClick: handleSave },
    ],
  });
}
