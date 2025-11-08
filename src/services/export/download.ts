import * as safeJSON from 'utilities/safeJSON';

function download(filename: string, dataStr: string): void {
  const a = document.createElement('a');
  a.style.display = 'none';
  a.setAttribute('href', dataStr);
  a.setAttribute('download', filename);
  const elem = document.body.appendChild(a);
  elem.click();
  elem.remove();
}

export function downloadJSON(filename: string, json: any): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(safeJSON.stringify(json) || '');
  download(filename, dataStr);
}

export function downloadText(filename: string, text: string): void {
  const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
  download(filename, dataStr);
}

export function downloadURI(uri: string, name: string): void {
  const link = document.createElement('a');
  link.download = name;
  link.href = uri;

  const elem = document.body.appendChild(link);
  elem.click();
  elem.remove();
}
