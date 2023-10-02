import { closeModal, openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';

import 'styles/dropzone.css';

export function dropzoneModal({ callback, autoClose = true } = {}) {
  const loadFile = (file) => {
    const ending = file.name.split('.').reverse()[0];
    let reader = new FileReader();

    reader.onload = function (evt) {
      if (evt.target.error) {
        console.log('file error', evt.target.error);
        return;
      }

      let fileContent = evt.target.result;
      if (!fileContent.length) return;
      if (isFunction(callback)) {
        callback(fileContent);
      } else {
        console.log(fileContent);
      }
    };

    if (['csv', 'json'].includes(ending)) {
      reader.readAsText(file);
    } else {
      console.log('not loaded');
      // reader.readAsBinaryString(file);
    }
  };

  const dropzone = document.createElement('div');
  dropzone.className = 'dzx-dropzone';
  dropzone.id = 'tmxDropzone';

  const label = document.createElement('label');
  label.className = 'dzx-inputLabel';
  label.innerHTML = 'Drag and Drop files into this zone';

  const dropzone_input = document.createElement('input');
  dropzone_input.className = 'dzx-input';
  dropzone_input.setAttribute('type', 'file');
  dropzone_input.setAttribute('accept', 'application/json');
  label.appendChild(dropzone_input);
  dropzone.appendChild(label);

  openModal({
    buttons: [{ label: 'Cancel', intent: 'none', close: true }, { label: 'Done' }],
    title: 'Import tournament records',
    content: dropzone
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
    false
  );

  dropzone.addEventListener(
    'dragleave',
    function () {
      this.classList.remove(DRAGGING);
    },
    false
  );

  dropzone.addEventListener(
    'drop',
    function (e) {
      const multiple = dropzone_input.getAttribute('multiple');
      this.classList.remove(DRAGGING);
      const files = e.dataTransfer.files;
      const dataTransfer = new DataTransfer();

      Array.prototype.forEach.call(files, (file) => {
        dataTransfer.items.add(file);
        if (!multiple) {
          return false;
        }
      });

      const filesToBeAdded = dataTransfer.files;
      Array.from(filesToBeAdded).forEach(loadFile);
      if (autoClose) closeModal();
    },
    false
  );
}
