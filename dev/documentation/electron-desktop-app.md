# TMX Electron Desktop Application

TMX ships as both a web PWA and an Electron desktop app from the same repository.
The web deployment remains the primary target; Electron is additive, not a fork.

---

## Quick Start

```bash
pnpm electron:dev        # Dev server + Electron window (hot-reload)
pnpm electron:build      # Build main/preload/renderer for production
pnpm electron:preview    # Preview production build in Electron
pnpm electron:package    # Package distributable (DMG/NSIS/AppImage)

pnpm test:electron       # Build + Playwright smoke suite against the desktop target
pnpm test:electron:ui    # Same, in Playwright's interactive UI
pnpm check-types:electron # Type-check electron/ only
```

Web scripts (`pnpm start`, `pnpm build`, etc.) are completely unchanged.

---

## Architecture Overview

```
TMX/
├── electron/
│   ├── main.ts              # Main process — BrowserWindow, IPC, lifecycle
│   ├── preload.ts           # Context bridge → window.electronAPI
│   ├── menu.ts              # Application menu (File/Edit/View/Window/Help)
│   └── tsconfig.json        # Separate tsconfig (CommonJS, ES2022)
├── src/
│   ├── platform/
│   │   ├── types.ts         # PlatformAdapter interface
│   │   ├── web.ts           # Browser adapter (no native capabilities)
│   │   ├── electron.ts      # Electron adapter (delegates to preload bridge)
│   │   ├── menuHandler.ts   # Renderer-side menu action dispatcher
│   │   └── index.ts         # Auto-detection singleton
│   ├── config/              # 10 typed config modules (replace env god object)
│   └── ...                  # Existing app code — unchanged
├── electron.vite.config.ts  # electron-vite v5 build config
├── electron-builder.json5   # Packaging config (macOS/Windows/Linux)
├── vite.config.ts           # Web-only Vite config — unchanged
└── package.json             # "main": "dist-electron/main/main.js"
```

### Build Pipeline

| Target            | Tool            | Config                                 | Output                              |
| ----------------- | --------------- | -------------------------------------- | ----------------------------------- |
| Web               | `vite`          | `vite.config.ts`                       | `dist/`                             |
| Electron main     | `electron-vite` | `electron.vite.config.ts` → `main`     | `dist-electron/main/main.js`        |
| Electron preload  | `electron-vite` | `electron.vite.config.ts` → `preload`  | `dist-electron/preload/preload.cjs` |
| Electron renderer | `electron-vite` | `electron.vite.config.ts` → `renderer` | `dist/` (same as web)               |

The renderer config includes `vite-tsconfig-paths` and `vite-plugin-environment` (same plugins
as the web config) so that absolute imports and `process.env.SERVER` work identically.

`electron-vite` sets `build.externalizeDeps: false` for main and preload, with a custom
`external` function that only externalizes the `electron` package itself (not our `electron/`
source directory).

### Platform Detection

```typescript
import { platform } from 'platform';

platform.type; // 'web' | 'electron'
platform.isDesktop(); // true in Electron
platform.canAccessFileSystem(); // true if preload bridge is available
```

Detection happens once at module load by checking for `window.electronAPI` (injected by preload).
All platform-specific behavior branches on the `PlatformAdapter` interface — application code
never checks `window.electronAPI` directly.

---

## Preload Bridge (IPC)

The renderer is **untrusted**: it renders server-delivered strings with innerHTML, so script in the
page is assumed reachable (see `Mentat/planning/TMX_ELECTRON_SECURITY.md`). The bridge is
therefore narrow, and no method takes a file path. The preload (`electron/preload.ts`) runs
sandboxed and exposes:

```typescript
window.electronAPI = {
  // Files: main shows the native dialog and does the I/O; the chosen path never returns
  saveFile({ title?, defaultName?, filters, data }): Promise<{ saved: boolean }>,
  openFiles({ title?, filters, multiple? }): Promise<{ name: string; data: Uint8Array }[] | undefined>,

  // Server URL: https, or http on localhost; a change is confirmed in a native dialog
  getServerUrl(): string,
  setServerUrl(url): Promise<{ saved: boolean }>,

  // DevTools (admin-gated in renderer)
  toggleDevTools(): Promise<void>,

  // Menu actions (main → renderer one-way channel)
  onMenuAction(callback: (action: string) => void): void,
};
```

The `ElectronBridge` interface in `src/platform/electron.ts` mirrors this shape. The
`PlatformAdapter` wraps each method as an optional capability so web code never sees them.

### What the main process enforces (`electron/main.ts`, `electron/policy.ts`)

- **Origin**: the built renderer is served from `app://tmx/` by a protocol handler that resolves
  only inside `dist/`, never from `file://`. Over `file://` the CSP `'self'` matched every local
  file and Chromium let the page fetch others, so page script could read any file the user can.
  Browser storage (IndexedDB, localStorage) belongs to `app://tmx`; data a pre-2026-10-16 build
  stored under the `file://` origin is not visible to it.
- **Sender check** on every handler: the call must come from the main window's top frame while
  it shows the app.
- **Files**: filter extensions from an allow-list (save: `json`, `csv`, `txt`; open: `json`),
  a 100 MB cap per file, and a bare file name as the dialog's default. A saved file always gets
  an allowed extension (`Update.bat` → `Update.bat.json`); open refuses other file types.
- **Navigation**: the window may only show the app. A link or redirect elsewhere is cancelled,
  and an `https:` URL is handed to the system browser: directly for CourtHive domains and the
  configured server, after a native confirmation for any other host. `window.open` is denied the same way,
  except an app-made `blob:` URL (the PDF preview), which opens in a sandboxed window with no
  preload. Sub-frames are held to the app, `blob:` and `about:`. `<webview>` is disabled.
- **Permissions**: only `notifications`, `clipboard-sanitized-write` and `fullscreen`, judged by
  the requesting frame's origin.
- **Content-Security-Policy**: injected into the packaged renderer's `index.html` at build time
  (`electron.vite.config.ts`, where each allowance is listed with its reason). No inline script
  except the hashed theme bootstrap, no `eval`. The document response adds a `connect-src`
  header naming the configured server (https + wss; localhost only when unpackaged or unset),
  so a confirmed server change reloads the window.
- `ELECTRON_RENDERER_URL` is honoured only when the app is not packaged.

`e2e/electron/security.spec.ts` runs injected-script attacks against each of these; set
`TMX_E2E_PACKAGED=1` to run it against the packaged app in `release/`.

---

## Main Process (`electron/main.ts`)

### Window Management

- Creates a single `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `webviewTag: false`
- Window bounds (position + size) are persisted to `tmx-prefs.json` in the app's `userData` dir
- Restored on next launch; defaults to 1400x900 (clamped to screen)
- `minWidth: 800`, `minHeight: 600`

### Content Loading

- **Development**: `electron-vite dev` sets `ELECTRON_RENDERER_URL` → `mainWindow.loadURL()`
  points to the Vite dev server (typically `http://localhost:5173`). Ignored in a packaged app.
- **Production**: `mainWindow.loadURL('app://tmx/index.html')`, served from `dist/` by the
  `app://` protocol handler

### IPC Handlers

| Channel              | Direction       | Purpose                                            |
| -------------------- | --------------- | -------------------------------------------------- |
| `file:save`          | renderer → main | Native save dialog + write; returns `{ saved }`    |
| `file:open`          | renderer → main | Native open dialog + read; returns names, contents |
| `app:getServerUrl`   | renderer → main | Load persisted server URL                          |
| `app:setServerUrl`   | renderer → main | Validate, confirm natively, persist server URL     |
| `app:toggleDevTools` | renderer → main | Toggle Chrome DevTools                             |
| `menu:action`        | main → renderer | Menu item clicked (one-way)                        |

Every renderer → main handler refuses a call that is not from the main window's top frame
showing the app.

---

## Application Menu (`electron/menu.ts`)

Built with `Menu.buildFromTemplate()` and set via `Menu.setApplicationMenu()`.

| Menu                 | Items                                                                          |
| -------------------- | ------------------------------------------------------------------------------ |
| **App** (macOS only) | About, Services, Hide, Quit                                                    |
| **File**             | Open Tournament (Cmd+O), Export Tournament (Cmd+E), Close/Quit                 |
| **Edit**             | Undo, Redo, Cut, Copy, Paste, Select All                                       |
| **View**             | Reload, Force Reload, Toggle Developer Tools (Cmd+Shift+F12), Zoom, Fullscreen |
| **Window**           | Minimize, Zoom, Front (macOS)                                                  |
| **Help**             | About TMX                                                                      |

Menu actions that interact with TMX data (Open, Export, DevTools, About) are sent as IPC messages
to the renderer via `menu:action`. The renderer's `menuHandler.ts` dispatches them to the
appropriate TMX functions.

### Developer Tools Access

DevTools are **not** auto-opened. Access is restricted:

- **Menu**: View → Toggle Developer Tools (Cmd+Shift+F12 / Ctrl+Shift+F12)
- **Secret key combo**: Cmd+Shift+F12 (Mac) / Ctrl+Shift+F12 (Windows/Linux)
- **Both paths require** the logged-in user to have `admin` or `superadmin` role
- If no user is logged in or the user lacks admin role, the shortcut does nothing

The role check happens in the renderer (`menuHandler.ts` → `isAdmin()` → `getLoginState()`),
not in the main process, so the gate uses the same auth state as the rest of TMX.

---

## Native File Dialogs

In Electron, tournament import/export uses native OS dialogs instead of browser download tricks.

### Export (`src/services/export/download.ts`)

`downloadJSON()` and `downloadText()` check `platform.canAccessFileSystem()`:

- **Electron**: calls `platform.saveFile()`; main shows the native Save As and writes the file
- **Web**: falls back to the existing `data:` URI + invisible `<a>` click pattern

The filter defaults to the appropriate file type (`.json`, `.csv`, etc.).

### Import (`src/services/storage/importTournaments.ts`)

`importTournaments()` checks `platform.canAccessFileSystem()`:

- **Electron**: calls `platform.openFiles()` with `multiple: true`; main shows the native Open
  and returns each file's name and contents → parses JSON → feeds into the existing
  `addTournament()` flow
- **Web**: falls back to `dropzoneModal()` (drag-and-drop / `<input type="file">`)

---

## Standalone Mode (Settings UI)

When running in Electron, the Settings tab shows a **Connection** panel (indigo, Electron-only):

- **Server URL**: text input, persists via `platform.setServerUrl()` to `tmx-prefs.json`
- **Connection status**: green/red dot with "Connected"/"Disconnected" label
- **Work Offline toggle**: when checked:
  - Disconnects the Socket.IO connection
  - Sets `serverConfig.serverFirst = false` and `saveLocal = true`
  - All mutations run local-first via the factory engine
  - When unchecked, reconnects and restores `serverFirst = true`

The Connection panel only renders when `deviceConfig.get().isElectron` is true (invisible in web).

---

## OS Notifications

Desktop notifications use the Web Notifications API (works in both browser and Electron).

- **Opt-in**: "Desktop Notifications" checkbox in Beta Features settings (Electron-only)
- **Preference**: stored in `localStorage` key `tmx_desktop_notifications`
- **Current triggers**:
  - Socket disconnect: "Server connection lost"
- **API**: `showOSNotification({ title, body, onClick? })` in `src/services/notifications/osNotification.ts`
- In Electron, notifications work without a permission prompt (Chromium grants it automatically)

---

## Typed Config Modules

The `env` god object has been replaced by 10 focused config modules in `src/config/`:

| Module              | Key fields                                                   |
| ------------------- | ------------------------------------------------------------ |
| `serverConfig`      | serverFirst, serverTimeout, socketPath, saveLocal, socketIo  |
| `deviceConfig`      | isMobile, isTouch, isMac, isElectron, isStandalone           |
| `featureFlags`      | pdfPrinting, googleSheetsImport, schedule2, usePublishState  |
| `preferencesConfig` | activeScale, scoringApproach, smartComplements, hotkeys, ioc |
| `displayConfig`     | composition, tableHeightMultiplier, printing                 |
| `scheduleConfig`    | teams, clubs, time24, minCourtGridRows                       |
| `scoringConfig`     | scoreboard matchFormats, options, settings                   |
| `debugConfig`       | log.verbose, renderLog, devNotes, averages                   |
| `locationConfig`    | geolocate, geoposition, map, leaflet tile layers             |
| `scalesConfig`      | rating scales (read-only, from factory fixtures)             |

Each module exports `{ get(), set(partial), reset() }`. `env.ts` remains as a deprecated
backward-compatible shim with getter/setter pairs delegating to the typed modules.

Settings persistence: `hydrateConfigFromStorage()` reads localStorage into config modules at
startup; `persistConfigToStorage()` writes config module state back to localStorage.

---

## Troubleshooting

### Blank white window on `pnpm electron:dev`

**Stale IndexedDB lock**: if Electron crashes or is killed without clean shutdown, the LevelDB
LOCK file for IndexedDB may be left behind. Symptoms: repeated `Failed to open LevelDB database`
errors in the console, app renders nothing.

Fix:

```bash
rm -f "$HOME/Library/Application Support/tmx/IndexedDB/http_localhost_*.indexeddb.leveldb/LOCK"
```

### Port conflicts

`electron-vite dev` starts a Vite dev server. If ports 5173-5175 are in use, it auto-increments.
The port is printed in the console output. The main process reads `ELECTRON_RENDERER_URL` which
electron-vite sets automatically.

### `pnpm electron:package` fails with `mimeType "undefined" is not valid`

electron-builder parses Electron's `Info.plist` through `plist@3`, which calls
`parseFromString(xml)` with no mimeType — mandatory as of `@xmldom/xmldom@0.9`.
TMX overrides `@xmldom/xmldom` to `^0.9.0` for security, which also captured
`plist`. Resolved by the scoped override in `pnpm-workspace.yaml`:

```yaml
'plist>@xmldom/xmldom': ^0.8.15
```

`plist` is build-time only (never in the app bundle, never fed untrusted input),
so the 0.8 line is not an exposure. Everything else stays on 0.9.

This broke a second time when Renovate "updated" the scoped pin to `^0.9.0` (#1275), and nothing
noticed: CI packages on Linux, which never parses an `Info.plist`. Restored 2026-10-16, and a
`renovate.json` rule now holds `plist>@xmldom/xmldom` below 0.9. Package on macOS before trusting
a change here.

### `window.electronAPI` is undefined in the packaged app

The preload was emitted under a name or format `electron/main.ts` cannot load. The
window runs with `sandbox: true`, where a preload must be a CommonJS script (an ES
module is never injected), so `electron.vite.config.ts` pins
`output: { format: 'cjs', entryFileNames: 'preload.cjs' }`. Before the sandbox
(2026-10-16) it was ESM named `.mjs`; electron-vite v5 defaulting `entryFileNames`
to `[name].js` broke that once.

Nothing errors when this breaks — `src/platform/index.ts` simply falls back to
the **web** adapter, so native dialogs become browser downloads and the
Connection panel vanishes. `preload-bridge.spec.ts` exists to catch it.

### `process.env.SERVER` undefined

The renderer config in `electron.vite.config.ts` must include `vite-plugin-environment` with
the same env vars as `vite.config.ts`:

```typescript
plugins: [tsconfigPaths(), EnvironmentPlugin({ SERVER: '', ENVIRONMENT: '', PUBLIC_URL: '' })],
```

Without this, `process.env.SERVER` won't be replaced at compile time and will throw at runtime.

---

## Verification

Until 2026-08-15 the desktop target had **no gate of any kind**, and the build was
broken on `main` for five months without a single red signal. The cause was
scoping, not neglect:

| Gate               | Scope before                         | Covers `electron/` now                        |
| ------------------ | ------------------------------------ | --------------------------------------------- |
| `pnpm lint`        | `eslint src e2e`                     | yes — `eslint src e2e electron`               |
| `pnpm check-types` | `tsconfig.json` (`include: ["src"]`) | yes — third leg runs `electron/tsconfig.json` |
| `pnpm test`        | vitest, `src/**`                     | no (by design — see below)                    |
| CI                 | no desktop job                       | yes — `.github/workflows/electron.yml`        |

Unit tests deliberately do **not** cover the Electron entry points: main and
preload only do meaningful work inside a running Electron process, so a mocked
`ipcMain` would assert the mock. The desktop target is covered by Playwright
instead — the ecosystem's only DOM/E2E layer.

### Smoke suite (`e2e/electron/`)

Run with `pnpm test:electron`. Config: `e2e/playwright.electron.config.ts`
(separate from the web journeys — no `webServer`, no browser project, no retries).

| Spec                     | Guards                                                                                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build-contract.spec.ts` | Static assertions on build OUTPUT — `package.json#main` resolves, the preload filename `main.ts` loads is actually emitted, preload is `.mjs`, `index.html` asset paths stay relative, `version.json` is emitted |
| `app-launch.spec.ts`     | Launches `dist-electron/main/main.js`: window opens, assets resolve under `app://tmx`, TMX itself boots (`globalThis.dev`), no uncaught errors, and **no request fails against the `file://` origin**            |
| `preload-bridge.spec.ts` | `window.electronAPI` is injected, exposes every method `PlatformAdapter` needs, and both IPC directions round-trip                                                                                               |
| `packaged-app.spec.ts`   | The real `.app`/`.exe`/AppImage from electron-builder — boots from inside the asar, ships the preload, loads every bundled asset. Auto-skips unless `release/` exists                                            |

Two habits keep this suite honest:

- **Cold profile per launch.** Every spec passes `--user-data-dir=<temp>`
  (`e2e/electron/helpers/userDataDir.ts`). Electron persists `userData` across
  runs, and a cached i18n manifest from a previous run silently disarmed the
  failed-request guard — the suite stayed green while a reverted fix was
  reintroduced. See architectural-standard A6.
- **Falsify the detector.** Every guard here was verified to report _dirty_, not
  just clean: reverting the preload fix fires 7 failures, reverting
  `staticAssetUrl` fires on `file:///fonts/catalog.json`, and reverting the
  `baseApi` fix fires on `file:///i18n/manifest` (both measured under the old
  `file://` origin; failures are now tracked on `app://`, including 404 responses).

---

## Implementation Status

| Phase               | Status  | Description                                                                                            |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| 1. Electron Shell   | DONE    | BrowserWindow, dev/prod loading, window persistence                                                    |
| 2. Platform Adapter | DONE    | PlatformAdapter interface, web + electron implementations                                              |
| 3. Config Migration | DONE    | 10 typed modules, env shim, 36 files migrated                                                          |
| 4. Native Features  | DONE    | File dialogs, app menu, standalone UI, OS notifications, admin DevTools                                |
| 5. Distribution     | PARTIAL | Build + package + CI + smoke suite done; **code signing, app icon, and auto-update still outstanding** |

### Phase 5 — what remains

`pnpm electron:package` produces a working, verified DMG today, but
electron-builder still warns about three things, all cosmetic-but-shipping:

- **No application icon** — the DMG ships the default Electron icon
  (`default Electron icon is used`). Needs an `.icns`/`.ico` in
  `electron-builder.json5`.
- **No `description` / `author` in `package.json`** — these become the macOS
  bundle metadata.
- **No code signing** — `0 valid identities found`, so macOS Gatekeeper will
  warn on first launch. Needs Apple Developer Program ($99/yr) + a Windows cert.

Auto-update is untouched: `platform.canAutoUpdate()` returns `true` in the
Electron adapter, but nothing consumes it.

---

## Open Questions

1. **Auto-update infrastructure** — GitHub Releases (free, simple) vs S3/custom server?
2. **Offline → online sync** — replay mutation log or upload full tournament record?
   (Now under active design — see `Mentat/planning/DISCONNECTED_SYNC_RECONCILIATION.md`.)
3. **Deep linking** — should `courthive://tournament/123` open the desktop app?
4. **Multi-window** — should users be able to open multiple tournaments in separate windows?
5. **Code signing** — Apple Developer Program ($99/yr) + Windows cert needed for unsigned warnings
