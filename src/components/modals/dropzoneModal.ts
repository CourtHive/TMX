/**
 * Dropzone modal for file upload with drag-and-drop.
 *
 * Now caller-configurable: callers pass the allowed file extensions, the
 * `<input accept>` attribute, and the modal title / instruction strings so
 * the same modal serves multiple flows (tournament JSON import, participant
 * CSV/TSV import, etc.).
 *
 * Defaults preserve the historical behavior — the participant import callsite
 * passes its own options.
 */
import { closeModal, openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import 'styles/dropzone.css';

export type DropzoneModalOptions = {
  callback?: (data: string) => void;
  autoClose?: boolean;
  extensions?: string[];
  accept?: string;
  title?: string;
  instruction?: string;
};

const DEFAULT_EXTENSIONS = ['csv', 'tsv', 'json'];

export function dropzoneModal({
  callback,
  autoClose = true,
  extensions = DEFAULT_EXTENSIONS,
  accept = '',
  title,
  instruction,
}: DropzoneModalOptions = {}): void {
  const allowedExtensions = new Set(extensions.map((ext) => ext.toLowerCase()));

  const loadFile = async (file: File) => {
    const ending = file.name.split('.').at(-1)?.toLowerCase() ?? '';

    if (allowedExtensions.has(ending)) {
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
  label.innerHTML = instruction ?? t('phrases.draganddrop');

  const dropzone_input = document.createElement('input');
  dropzone_input.className = 'dzx-input';
  dropzone_input.setAttribute('type', 'file');
  if (accept) dropzone_input.setAttribute('accept', accept);
  label.appendChild(dropzone_input);
  dropzone.appendChild(label);

  openModal({
    buttons: [{ label: t('common.cancel'), intent: 'none', close: true }, { label: t('actions.done') }],
    title: title ?? t('modals.dropzone.title'),
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
