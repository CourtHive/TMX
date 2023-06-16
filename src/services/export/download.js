import * as safeJSON from 'utilities/safeJSON';

function download(filename, dataStr) {
  let a = document.createElement('a');
  a.style.display = 'none';
  a.setAttribute('href', dataStr);
  a.setAttribute('download', filename);
  let elem = document.body.appendChild(a);
  elem.click();
  elem.remove();
}

export function downloadJSON(filename, json) {
  let dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(safeJSON.stringify(json));
  download(filename, dataStr);
}

export function downloadText(filename, text) {
  let dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
  download(filename, dataStr);
}

export function downloadURI(uri, name) {
  let link = document.createElement('a');
  link.download = name;
  link.href = uri;

  let elem = document.body.appendChild(link);
  elem.click();
  elem.remove();
}
