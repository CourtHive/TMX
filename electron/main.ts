/**
 * Electron main process.
 *
 * Creates the browser window and loads the TMX renderer (either Vite dev
 * server in development or the built HTML in production).
 */
import { app, BrowserWindow, ipcMain, dialog, screen, session, shell } from 'electron';
import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron';
import { pathToFileURL } from 'url';
import { buildAppMenu } from './menu';
import * as path from 'path';
import * as fs from 'fs';
import {
  ALLOWED_PERMISSIONS,
  normalizeServerUrl,
  OPEN_EXTENSIONS,
  SAVE_EXTENSIONS,
  safeDefaultName,
  allowedFilters,
  MAX_FILE_BYTES,
  isAppBlobUrl,
  externalUrl,
  isAppUrl,
} from './policy';

let mainWindow: BrowserWindow | null = null;

/** The renderer's own URL. Navigation, IPC and permissions are allowed only from it. */
let appUrl = '';

// Store for user preferences (window bounds, server URL, etc.)
const PREFS_FILE = path.join(app.getPath('userData'), 'tmx-prefs.json');

interface AppPrefs {
  windowBounds?: { x: number; y: number; width: number; height: number };
  serverUrl?: string;
}

function loadPrefs(): AppPrefs {
  try {
    if (fs.existsSync(PREFS_FILE)) {
      return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf-8'));
    }
  } catch {
    // ignore corrupt prefs
  }
  return {};
}

function savePrefs(prefs: AppPrefs): void {
  try {
    fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2));
  } catch {
    // best-effort
  }
}

/**
 * The renderer to load. `ELECTRON_RENDERER_URL` (the electron-vite dev server) is honoured only in
 * an unpackaged run: a packaged app always loads its own bundled `index.html`.
 */
function rendererTarget(): { url: string; file?: string } {
  const devUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
  if (devUrl) return { url: devUrl };
  const file = path.join(__dirname, '../../dist/index.html');
  return { url: pathToFileURL(file).href, file };
}

function createWindow(): void {
  const prefs = loadPrefs();
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const bounds = prefs.windowBounds ?? {
    width: Math.min(1400, screenWidth),
    height: Math.min(900, screenHeight),
    x: undefined as number | undefined,
    y: undefined as number | undefined,
  };

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 800,
    minHeight: 600,
    title: 'TMX',
    webPreferences: {
      // CommonJS: a sandboxed preload cannot be an ES module (see electron.vite.config.ts).
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  // Set up application menu
  buildAppMenu(mainWindow);

  const target = rendererTarget();
  appUrl = target.url;
  if (target.file) {
    mainWindow.loadFile(target.file);
  } else {
    mainWindow.loadURL(target.url);
  }

  // Save window bounds on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      const currentPrefs = loadPrefs();
      currentPrefs.windowBounds = mainWindow.getBounds();
      savePrefs(currentPrefs);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── IPC Handlers ────────────────────────────────────────────────────────────
//
// The renderer is untrusted. Every handler first checks that the call came from the main window's
// top frame while it shows the app, and no handler accepts a file path: the main process opens the
// native dialog and does the I/O, so the path the user picks never crosses the bridge.

function fromApp(event: IpcMainInvokeEvent | IpcMainEvent): boolean {
  const frame = event.senderFrame;
  if (!mainWindow || event.sender !== mainWindow.webContents || !frame || frame.parent) return false;
  return isAppUrl(frame.url, appUrl);
}

function handle(channel: string, listener: (...args: any[]) => unknown): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!fromApp(event)) throw new Error(`${channel}: refused, not the app frame`);
    return listener(...args);
  });
}

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.slice(0, 200) : undefined;

handle('file:save', async (request: any) => {
  const filters = allowedFilters(request?.filters, SAVE_EXTENSIONS);
  const data = request?.data;
  if (!mainWindow || !filters || !(data instanceof Uint8Array) || data.byteLength > MAX_FILE_BYTES) {
    throw new Error('file:save: refused');
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: optionalText(request.title),
    defaultPath: safeDefaultName(request.defaultName),
    filters,
  });
  if (result.canceled || !result.filePath) return { saved: false };
  await fs.promises.writeFile(result.filePath, data);
  return { saved: true };
});

handle('file:open', async (request: any) => {
  const filters = allowedFilters(request?.filters, OPEN_EXTENSIONS);
  if (!mainWindow || !filters) throw new Error('file:open: refused');
  const result = await dialog.showOpenDialog(mainWindow, {
    title: optionalText(request.title),
    filters,
    properties: request.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return undefined;
  const files: { name: string; data: Uint8Array }[] = [];
  for (const filePath of result.filePaths) {
    const { size } = await fs.promises.stat(filePath);
    if (size > MAX_FILE_BYTES) throw new Error(`file:open: ${path.basename(filePath)} is larger than the limit`);
    files.push({ name: path.basename(filePath), data: new Uint8Array(await fs.promises.readFile(filePath)) });
  }
  return files;
});

ipcMain.on('app:getServerUrl', (event) => {
  event.returnValue = fromApp(event) ? loadPrefs().serverUrl || '' : '';
});

// Script in the page must not be able to repoint the desktop app silently: the URL is validated
// here and a change is confirmed by the user in a native dialog the page cannot draw or click.
handle('app:setServerUrl', async (value: unknown) => {
  const url = normalizeServerUrl(value);
  if (!url || !mainWindow) return { saved: false };
  const prefs = loadPrefs();
  if (prefs.serverUrl === url) return { saved: true };
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Use this server', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: 'Change the TMX server?',
    detail: `TMX will connect to ${url} from now on.`,
  });
  if (response !== 0) return { saved: false };
  prefs.serverUrl = url;
  savePrefs(prefs);
  return { saved: true };
});

handle('app:toggleDevTools', () => {
  mainWindow?.webContents.toggleDevTools();
});

// ── Navigation, windows and permissions ─────────────────────────────────────

function openExternally(url: string): void {
  const external = externalUrl(url);
  if (external) shell.openExternal(external).catch(() => undefined);
}

function lockDown(contents: WebContents): void {
  contents.on('will-navigate', (event, url) => {
    if (isAppUrl(url, appUrl)) return;
    // A blob: preview window's own first load. Never the main window, which would carry the bridge.
    if (isAppBlobUrl(url, appUrl) && contents !== mainWindow?.webContents) return;
    event.preventDefault();
    openExternally(url);
  });
  contents.on('will-redirect', (event, url) => {
    if (!isAppUrl(url, appUrl)) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    // The PDF preview (`pdfExport.ts`) opens a blob: URL. It gets its own sandboxed window,
    // without the preload, and this same lock-down.
    if (isAppBlobUrl(url, appUrl) && isAppUrl(contents.getURL(), appUrl)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false },
        },
      };
    }
    openExternally(url);
    return { action: 'deny' };
  });
}

function restrictPermissions(): void {
  const allowed = (contents: WebContents | null, permission: string) =>
    ALLOWED_PERMISSIONS.has(permission) && !!contents && isAppUrl(contents.getURL(), appUrl);
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) =>
    callback(allowed(contents, permission)),
  );
  session.defaultSession.setPermissionCheckHandler((contents, permission) => allowed(contents, permission));
}

app.on('web-contents-created', (_event, contents) => lockDown(contents));

// ── App Lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  restrictPermissions();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
