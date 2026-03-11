import * as safeJSON from 'utilities/safeJSON';
import { platform } from 'platform';

function download(filename: string, dataStr: string): void {
  const a = document.createElement('a');
  a.style.display = 'none';
  a.setAttribute('href', dataStr);
  a.setAttribute('download', filename);
  const elem = document.body.appendChild(a);
  elem.click();
  elem.remove();
}

/** Save JSON to a file — uses native dialog in Electron, browser download otherwise */
export async function downloadJSON(filename: string, json: any): Promise<void> {
  const content = safeJSON.stringify(json) || '';

  if (platform.canAccessFileSystem() && platform.showSaveDialog && platform.writeFile) {
    const ext = filename.endsWith('.json') ? 'json' : filename.split('.').pop() || 'json';
    const filePath = await platform.showSaveDialog({
      title: 'Save JSON',
      defaultPath: filename,
      filters: [{ name: 'JSON Files', extensions: [ext] }],
    });
    if (filePath) {
      await platform.writeFile(filePath, new TextEncoder().encode(content));
      return;
    }
    // User cancelled — don't fall through to browser download
    return;
  }

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(content);
  download(filename, dataStr);
}

/** Save text to a file — uses native dialog in Electron, browser download otherwise */
export async function downloadText(filename: string, text: string): Promise<void> {
  if (platform.canAccessFileSystem() && platform.showSaveDialog && platform.writeFile) {
    const ext = filename.split('.').pop() || 'txt';
    const filePath = await platform.showSaveDialog({
      title: 'Save File',
      defaultPath: filename,
      filters: [{ name: 'Text Files', extensions: [ext] }],
    });
    if (filePath) {
      await platform.writeFile(filePath, new TextEncoder().encode(text));
      return;
    }
    return;
  }

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
