/**
 * Dropzone modal for file upload with drag-and-drop.
 * Accepts JSON and CSV files with FileReader processing and callback support.
 */
import { closeModal, openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import 'styles/dropzone.css';

export function dropzoneModal({
  callback,
  autoClose = true,
}: { callback?: (data: string) => void; autoClose?: boolean } = {}): void {
  const loadFile = async (file: File) => {
    const ending = file.name.split('.').reverse()[0];

    if (['csv', 'json'].includes(ending)) {
      try {
        const fileContent = await file.text();
        if (!fileContent.length) return;
        if (isFunction(callback)) {
          callback(fileContent);
        } else {
          console.log(fileContent);
        }
      } catch (error) {
        console.log('file error', error);
      }
    } else {
      console.log('not loaded');
    }
  };

  const dropzone = document.createElement('div');
  dropzone.className = 'dzx-dropzone';
  dropzone.id = 'tmxDropzone';

  const label = document.createElement('label');
  label.className = 'dzx-inputLabel';
  label.innerHTML = t('phrases.draganddrop');

  const dropzone_input = document.createElement('input');
  dropzone_input.className = 'dzx-input';
  dropzone_input.setAttribute('type', 'file');
  dropzone_input.setAttribute('accept', 'application/json');
  label.appendChild(dropzone_input);
  dropzone.appendChild(label);

  openModal({
    buttons: [{ label: t('common.cancel'), intent: 'none', close: true }, { label: t('actions.done') }],
    title: t('modals.dropzone.title'),
    content: dropzone,
  });

  ['drag', 'dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop'].forEach((dragEvent) => {
    dropzone.addEventListener(dragEvent, function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  const DRAGGING = 'dropone-dragging';
  dropzone.addEventListener(
    'dragover',
    function () {
      this.classList.add(DRAGGING);
    },
    false,
  );

  dropzone.addEventListener(
    'dragleave',
    function () {
      this.classList.remove(DRAGGING);
    },
    false,
  );

  dropzone.addEventListener(
    'drop',
    function (e) {
      this.classList.remove(DRAGGING);
      const files = e.dataTransfer!.files;
      const dataTransfer = new DataTransfer();

      Array.prototype.forEach.call(files, (file: File) => {
        dataTransfer.items.add(file);
      });

      const filesToBeAdded = dataTransfer.files;
      Array.from(filesToBeAdded).forEach(loadFile);
      if (autoClose) closeModal();
    },
    false,
  );
}
