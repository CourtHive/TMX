// Notes-editor modal — TMX-specific wrapper around the shared
// `createNotesEditor` primitive in courthive-components (lifted there
// 2026-05-26 so TMX and the AMS console share one implementation). This file
// owns the TMX modal + the "Insert Contacts" affordance; the toolbar / editor
// body / Tiptap lifecycle now live in courthive-components.

import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { buildContactCardHtml } from './contactCardInsert';
import { createNotesEditor } from 'courthive-components';
import { t } from 'i18n';

export function openNotesEditor({ notes, onSave }: { notes?: string; onSave: (html: string) => void }): void {
  const content = document.createElement('div');
  content.style.cssText = 'display:flex; flex-direction:column; max-height:calc(100vh - 220px); overflow:hidden;';

  const handle = createNotesEditor({ initialHtml: notes });
  content.appendChild(handle.toolbar);

  // TMX-specific insert bar — sits between toolbar and editor body. The shared
  // primitive doesn't know about contact-card insertion; we add it here.
  const insertBar = document.createElement('div');
  insertBar.style.cssText =
    'display:flex; gap:8px; padding:4px 8px; border-bottom:1px solid var(--tmx-border-primary); background:var(--tmx-bg-secondary);';

  const contactBtn = document.createElement('button');
  contactBtn.type = 'button';
  contactBtn.style.cssText =
    'padding:4px 10px; border-radius:4px; border:1px solid var(--tmx-border-primary); background:var(--tmx-bg-primary); color:var(--tmx-text-primary); cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:4px;';
  contactBtn.innerHTML = '<i class="fa fa-address-card"></i> Insert Contacts';
  contactBtn.title = 'Insert tournament personnel contact card';
  contactBtn.addEventListener('click', () => {
    if (!handle.editor) return;
    const html = buildContactCardHtml();
    handle.editor.chain().focus().insertContent(html).run();
  });
  insertBar.appendChild(contactBtn);
  content.appendChild(insertBar);

  // The editor body element from the shared primitive — already styled with
  // `notes-editor-content` and ready to receive the Tiptap mount on the next
  // animation frame.
  handle.editorElement.style.cssText = 'flex:1 1 auto; min-height:200px; overflow-y:auto;';
  content.appendChild(handle.editorElement);

  const handleSave = () => {
    const html = handle.getHtml();
    handle.destroy();
    onSave(html);
    closeModal();
  };

  openModal({
    title: t('modals.notesEditor.title'),
    content,
    config: { maxWidth: 1100, padding: '1' },
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('common.save'), intent: 'is-primary', onClick: handleSave },
    ],
  });
}
