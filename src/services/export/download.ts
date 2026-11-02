import * as safeJSON from 'utilities/safeJSON';
import { platform } from 'platform';
import { t } from 'i18n';

function download(filename: string, dataStr: string): void {
  const a = document.createElement('a');
  a.style.display = 'none';
  a.setAttribute('href', dataStr);
  a.setAttribute('download', filename);
  const elem = document.body.appendChild(a);
  elem.click();
  elem.remove();
}

/** Native save in Electron: the main process shows the dialog and writes; the path never returns here. */
async function saveNatively(title: string, filename: string, filterName: string, ext: string, content: string) {
  await platform.saveFile!({
    title,
    defaultName: filename,
    filters: [{ name: filterName, extensions: [ext] }],
    data: new TextEncoder().encode(content),
  });
}

/** Save JSON to a file — uses native dialog in Electron, browser download otherwise */
export async function downloadJSON(filename: string, json: any): Promise<void> {
  const content = safeJSON.stringify(json) || '';

  if (platform.canAccessFileSystem() && platform.saveFile) {
    // A cancelled dialog does not fall through to a browser download.
    await saveNatively(t('exportFile.saveJson'), filename, 'JSON Files', 'json', content);
    return;
  }

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(content);
  download(filename, dataStr);
}

/** Save text to a file — uses native dialog in Electron, browser download otherwise */
export async function downloadText(filename: string, text: string): Promise<void> {
  if (platform.canAccessFileSystem() && platform.saveFile) {
    const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
    await saveNatively(t('exportFile.saveFile'), filename, 'Text Files', ext, text);
    return;
  }

  const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
  download(filename, dataStr);
}

/** Save XML to a file — uses native dialog in Electron, browser download otherwise */
export async function downloadXML(filename: string, xml: string): Promise<void> {
  if (platform.canAccessFileSystem() && platform.saveFile) {
    await saveNatively(t('exportFile.saveXml'), filename, 'XML Files', 'xml', xml);
    return;
  }

  const dataStr = 'data:application/xml;charset=utf-8,' + encodeURIComponent(xml);
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
