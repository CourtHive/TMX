/**
 * Electron main process.
 *
 * Creates the browser window and loads the TMX renderer: the Vite dev server in development,
 * otherwise the built renderer served from `app://tmx/` (never `file://` — see `serveRenderer`).
 */
import { app, BrowserWindow, ipcMain, dialog, screen, session, shell, protocol, net } from 'electron';
import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron';
import { pathToFileURL } from 'url';
import { buildAppMenu } from './menu';
import * as path from 'path';
import * as fs from 'fs';
import {
  withAllowedExtension,
  ALLOWED_PERMISSIONS,
  hasAllowedExtension,
  normalizeServerUrl,
  isTrustedExternal,
  OPEN_EXTENSIONS,
  SAVE_EXTENSIONS,
  connectSources,
  resolveAppFile,
  safeDefaultName,
  allowedFilters,
  MAX_FILE_BYTES,
  isAppBlobUrl,
  externalUrl,
  APP_ORIGIN,
  APP_SCHEME,
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

// `app://` must be registered before the app is ready. `standard` + `secure` give it a real origin
// (`app://tmx`) with storage and fetch, so the renderer's CSP `'self'` means that origin only.
protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } },
]);

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

/** The persisted server URL, re-validated on every read (an older build stored it unchecked). */
const savedServerUrl = (): string | undefined => normalizeServerUrl(loadPrefs().serverUrl);

/**
 * The renderer to load. `ELECTRON_RENDERER_URL` (the electron-vite dev server) is honoured only in
 * an unpackaged run: a packaged app always loads its own bundled renderer.
 */
function rendererUrl(): string {
  const devUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
  return devUrl || `${APP_ORIGIN}/index.html`;
}

/**
 * Serves the built renderer from `app://tmx/`. Over `file://` the page's CSP `'self'` matched every
 * local file and Chromium let a `file://` page fetch others, so script in the page could read any
 * file the user can (`fetch('file:///…')`) and run any local `.js`. From `app://tmx` neither is
 * possible, and only files inside `dist/` are served. The document also gets a `connect-src`
 * header naming the configured server, which a static `<meta>` cannot know.
 */
function serveRenderer(): void {
  const distDir = path.join(__dirname, '../../dist');
  protocol.handle(APP_SCHEME, async (request) => {
    const file = resolveAppFile(request.url, distDir);
    if (!file) return new Response('Not found', { status: 404 });
    const response = await net.fetch(pathToFileURL(file).href);
    if (!file.endsWith('.html')) return response;
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', connectSources(savedServerUrl(), app.isPackaged));
    return new Response(response.body, { status: response.status, headers });
  });
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

  appUrl = rendererUrl();
  mainWindow.loadURL(appUrl);

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
  typeof value === 'string' ? value.slice(0, 80) : undefined;

handle('file:save', async (request: any) => {
  const filters = allowedFilters(request?.filters, SAVE_EXTENSIONS);
  const data = request?.data;
  if (!mainWindow || !filters || !(data instanceof Uint8Array) || data.byteLength > MAX_FILE_BYTES) {
    throw new Error('file:save: refused');
  }
  const defaultName = safeDefaultName(request.defaultName);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: optionalText(request.title),
    defaultPath: defaultName && withAllowedExtension(defaultName, filters),
    filters,
  });
  if (result.canceled || !result.filePath) return { saved: false };
  // The page supplies the bytes, so it must not choose an executable type: a name the user typed
  // with another extension gets an allowed one appended.
  await fs.promises.writeFile(withAllowedExtension(result.filePath, filters), data);
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
  const refused = result.filePaths.find((filePath) => !hasAllowedExtension(filePath, filters));
  if (refused) throw new Error(`file:open: ${path.basename(refused)} is not an allowed file type`);
  const files: { name: string; data: Uint8Array }[] = [];
  for (const filePath of result.filePaths) {
    const { size } = await fs.promises.stat(filePath);
    if (size > MAX_FILE_BYTES) throw new Error(`file:open: ${path.basename(filePath)} is larger than the limit`);
    files.push({ name: path.basename(filePath), data: new Uint8Array(await fs.promises.readFile(filePath)) });
  }
  return files;
});

ipcMain.on('app:getServerUrl', (event) => {
  event.returnValue = fromApp(event) ? savedServerUrl() || '' : '';
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
  // The document's connect-src names the server, so the new one is reachable only after a reload.
  setTimeout(() => mainWindow?.webContents.reload(), 0);
  return { saved: true };
});

handle('app:toggleDevTools', () => {
  mainWindow?.webContents.toggleDevTools();
});

// ── Navigation, windows and permissions ─────────────────────────────────────

let externalPromptOpen = false;

/**
 * Hands an https link to the system browser. CourtHive's domains and the configured server open
 * directly; any other host is confirmed in a native dialog first (script in the page could
 * otherwise open phishing pages or https app links at will). One prompt at a time.
 */
async function openExternally(url: string): Promise<void> {
  const external = externalUrl(url);
  if (!external) return;
  if (!isTrustedExternal(external, savedServerUrl())) {
    if (!mainWindow || externalPromptOpen) return;
    externalPromptOpen = true;
    try {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Open in browser', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        message: `Open a link to ${new URL(external).host}?`,
        detail: external.slice(0, 300),
      });
      if (response !== 0) return;
    } finally {
      externalPromptOpen = false;
    }
  }
  await shell.openExternal(external).catch(() => undefined);
}

function lockDown(contents: WebContents): void {
  contents.on('will-navigate', (event, url) => {
    if (isAppUrl(url, appUrl)) return;
    // A blob: preview window's own first load. Never the main window, which would carry the bridge.
    if (isAppBlobUrl(url, appUrl) && contents !== mainWindow?.webContents) return;
    event.preventDefault();
    openExternally(url).catch(() => undefined);
  });
  contents.on('will-redirect', (event, url) => {
    if (!isAppUrl(url, appUrl)) event.preventDefault();
  });
  // will-navigate covers main frames only; sub-frames may show the app, a blob: or about: page.
  contents.on('will-frame-navigate', (details) => {
    if (details.isMainFrame) return;
    const { url } = details;
    if (isAppUrl(url, appUrl) || isAppBlobUrl(url, appUrl) || url.startsWith('about:')) return;
    details.preventDefault();
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
    openExternally(url).catch(() => undefined);
    return { action: 'deny' };
  });
}

function restrictPermissions(): void {
  // Judged by the REQUESTING frame's URL/origin, so a sub-frame does not inherit the top document's grant.
  const allowed = (permission: string, requester: string | undefined) =>
    ALLOWED_PERMISSIONS.has(permission) && !!requester && isAppUrl(requester, appUrl);
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) =>
    callback(allowed(permission, details?.requestingUrl || contents?.getURL())),
  );
  session.defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
    allowed(permission, requestingOrigin),
  );
}

app.on('web-contents-created', (_event, contents) => lockDown(contents));

// ── App Lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  serveRenderer();
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
