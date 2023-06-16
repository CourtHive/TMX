import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

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

  context.modal.setContent(
    `<div class='dzx-dropzone' id='tmxDropzone'><label class="dzx-inputLabel">Drag and Drop files into this zone<input class="dzx-input" type="file" accept="application/json"></label></div>`
  );
  const dropzone = document.getElementById('tmxDropzone');
  const dropzone_input = dropzone.querySelector('.dzx-input');
  const multiple = dropzone_input.getAttribute('multiple') ? true : false;

  ['drag', 'dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop'].forEach(function (event) {
    dropzone.addEventListener(event, function (e) {
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
      if (autoClose) context.modal.close();
    },
    false
  );

  context.modal.open({
    buttons: [{ label: 'Cancel', intent: 'none', close: true }, { label: 'Done' }],
    title: 'Import tournament records'
  });
}
