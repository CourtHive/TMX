import { loadJSON } from './loadJSON';
import i18n from 'i18next';

import { AppToaster } from 'services/notifications/toaster';

export function loadFile(file, callback) {
  const meta = parseFileName(file.name);

  const reader = new FileReader();
  reader.onload = function (evt) {
    if (evt.target.error) {
      AppToaster.show({ icon: 'error', intent: 'warning', message: i18n.t('phrases.fileerror') });
      return;
    }

    const file_content = evt.target.result;
    if (!file_content.length) return;

    if (meta.filetype.indexOf('xls') >= 0) {
      AppToaster.show({ icon: 'error', intent: 'warning', message: 'Excel Import Disabled' });
    } else if (meta.filetype.indexOf('json') >= 0) {
      const json = JSON.parse(file_content);
      if (json) {
        loadJSON({ json, callback });
      }
    }
  };

  if (!meta.filetype) {
    AppToaster.show({ icon: 'error', intent: 'warning', message: i18n.t('phrases.invalid') });
    return;
  } else {
    if (['csv', 'json'].indexOf(meta.filetype) >= 0) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  }
}

function parseFileName(filename) {
  const meta = {
    filename,
    filetype: validExtension(filename)
  };

  return meta;
}

function validExtension(filename) {
  if (filename.length < 0) return;
  const ext = filename.split('.').reverse()[0].toLowerCase();
  const validExt = ['csv', 'xls', 'xlsm', 'xlsx', 'json', 'xtr'];
  const index = validExt.indexOf(ext);
  if (index >= 0) return validExt[index];
}
