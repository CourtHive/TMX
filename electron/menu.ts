/**
 * Application menu for the Electron desktop app.
 *
 * Sends menu actions to the renderer via IPC so the existing
 * TMX application code handles them (import, export, etc.).
 */
import { app, BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron';

export function buildAppMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === 'darwin';

  function sendAction(action: string): void {
    mainWindow.webContents.send('menu:action', action);
  }

  const template: MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    // File
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Tournament...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendAction('open-tournament'),
        },
        {
          label: 'Export Tournament...',
          accelerator: 'CmdOrCtrl+E',
          click: () => sendAction('export-tournament'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    // Edit
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    // View
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+F12',
          click: () => sendAction('toggle-devtools'),
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // Window
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }]),
      ],
    },
    // Help
    {
      label: 'Help',
      submenu: [
        {
          label: 'About TMX',
          click: () => sendAction('about'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
