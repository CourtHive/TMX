/**
 * Electron main process.
 *
 * Creates the browser window and loads the TMX renderer (either Vite dev
 * server in development or the built HTML in production).
 */
import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron';
import { buildAppMenu } from './menu';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;

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
      preload: path.join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Set up application menu
  buildAppMenu(mainWindow);

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    // In production, load the built index.html from the renderer output
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
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

ipcMain.handle('dialog:save', async (_event, options) => {
  if (!mainWindow) return undefined;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: options?.title,
    defaultPath: options?.defaultPath,
    filters: options?.filters,
  });
  return result.canceled ? undefined : result.filePath;
});

ipcMain.handle('dialog:open', async (_event, options) => {
  if (!mainWindow) return undefined;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options?.title,
    filters: options?.filters,
    properties: [options?.multiple ? 'multiSelections' : 'openFile'],
  });
  return result.canceled ? undefined : result.filePaths;
});

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  return fs.promises.readFile(filePath);
});

ipcMain.handle('fs:writeFile', async (_event, filePath: string, data: Uint8Array) => {
  await fs.promises.writeFile(filePath, data);
});

ipcMain.on('app:getDataPath', (event) => {
  event.returnValue = app.getPath('userData');
});

ipcMain.on('app:getServerUrl', (event) => {
  const prefs = loadPrefs();
  event.returnValue = prefs.serverUrl || '';
});

ipcMain.handle('app:setServerUrl', (_event, url: string) => {
  const prefs = loadPrefs();
  prefs.serverUrl = url;
  savePrefs(prefs);
});

ipcMain.handle('app:toggleDevTools', () => {
  if (mainWindow) {
    mainWindow.webContents.toggleDevTools();
  }
});

// ── App Lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

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
