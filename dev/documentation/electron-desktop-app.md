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

| Target | Tool | Config | Output |
|--------|------|--------|--------|
| Web | `vite` | `vite.config.ts` | `dist/` |
| Electron main | `electron-vite` | `electron.vite.config.ts` → `main` | `dist-electron/main/main.js` |
| Electron preload | `electron-vite` | `electron.vite.config.ts` → `preload` | `dist-electron/preload/preload.mjs` |
| Electron renderer | `electron-vite` | `electron.vite.config.ts` → `renderer` | `dist/` (same as web) |

The renderer config includes `vite-tsconfig-paths` and `vite-plugin-environment` (same plugins
as the web config) so that absolute imports and `process.env.SERVER` work identically.

`electron-vite` sets `build.externalizeDeps: false` for main and preload, with a custom
`external` function that only externalizes the `electron` package itself (not our `electron/`
source directory).

### Platform Detection

```typescript
import { platform } from 'platform';

platform.type;                // 'web' | 'electron'
platform.isDesktop();         // true in Electron
platform.canAccessFileSystem(); // true if preload bridge is available
```

Detection happens once at module load by checking for `window.electronAPI` (injected by preload).
All platform-specific behavior branches on the `PlatformAdapter` interface — application code
never checks `window.electronAPI` directly.

---

## Preload Bridge (IPC)

The preload script (`electron/preload.ts`) exposes a typed API via `contextBridge`:

```typescript
window.electronAPI = {
  // File dialogs
  showSaveDialog(options): Promise<string | undefined>,
  showOpenDialog(options): Promise<string[] | undefined>,

  // File system
  readFile(filePath): Promise<Uint8Array>,
  writeFile(filePath, data): Promise<void>,

  // App metadata
  getAppDataPath(): string,
  getServerUrl(): string,
  setServerUrl(url): Promise<void>,

  // DevTools (admin-gated in renderer)
  toggleDevTools(): Promise<void>,

  // Menu actions (main → renderer one-way channel)
  onMenuAction(callback: (action: string) => void): void,
};
```

The `ElectronBridge` interface in `src/platform/electron.ts` mirrors this shape. The
`PlatformAdapter` wraps each method as an optional capability so web code never sees them.

---

## Main Process (`electron/main.ts`)

### Window Management

- Creates a single `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`
- Window bounds (position + size) are persisted to `tmx-prefs.json` in the app's `userData` dir
- Restored on next launch; defaults to 1400x900 (clamped to screen)
- `minWidth: 800`, `minHeight: 600`

### Content Loading

- **Development**: `electron-vite dev` sets `ELECTRON_RENDERER_URL` → `mainWindow.loadURL()`
  points to the Vite dev server (typically `http://localhost:5173`)
- **Production**: `mainWindow.loadFile('../../dist/index.html')` relative to the built main.js

### IPC Handlers

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `dialog:save` | renderer → main | Native save dialog |
| `dialog:open` | renderer → main | Native open dialog |
| `fs:readFile` | renderer → main | Read file from disk |
| `fs:writeFile` | renderer → main | Write file to disk |
| `app:getDataPath` | renderer → main | User data directory path |
| `app:getServerUrl` | renderer → main | Load persisted server URL |
| `app:setServerUrl` | renderer → main | Persist server URL |
| `app:toggleDevTools` | renderer → main | Toggle Chrome DevTools |
| `menu:action` | main → renderer | Menu item clicked (one-way) |

---

## Application Menu (`electron/menu.ts`)

Built with `Menu.buildFromTemplate()` and set via `Menu.setApplicationMenu()`.

| Menu | Items |
|------|-------|
| **App** (macOS only) | About, Services, Hide, Quit |
| **File** | Open Tournament (Cmd+O), Export Tournament (Cmd+E), Close/Quit |
| **Edit** | Undo, Redo, Cut, Copy, Paste, Select All |
| **View** | Reload, Force Reload, Toggle Developer Tools (Cmd+Shift+F12), Zoom, Fullscreen |
| **Window** | Minimize, Zoom, Front (macOS) |
| **Help** | About TMX |

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

- **Electron**: calls `platform.showSaveDialog()` → `platform.writeFile()` (native Save As)
- **Web**: falls back to the existing `data:` URI + invisible `<a>` click pattern

The filter defaults to the appropriate file type (`.json`, `.csv`, etc.).

### Import (`src/services/storage/importTournaments.ts`)

`importTournaments()` checks `platform.canAccessFileSystem()`:

- **Electron**: calls `platform.showOpenDialog()` with `multiple: true` → `platform.readFile()`
  for each selected file → parses JSON → feeds into the existing `addTournament()` flow
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

| Module | Key fields |
|--------|------------|
| `serverConfig` | serverFirst, serverTimeout, socketPath, saveLocal, socketIo |
| `deviceConfig` | isMobile, isTouch, isMac, isElectron, isStandalone |
| `featureFlags` | pdfPrinting, googleSheetsImport, schedule2, usePublishState |
| `preferencesConfig` | activeScale, scoringApproach, smartComplements, hotkeys, ioc |
| `displayConfig` | composition, tableHeightMultiplier, printing |
| `scheduleConfig` | teams, clubs, time24, minCourtGridRows |
| `scoringConfig` | scoreboard matchFormats, options, settings |
| `debugConfig` | log.verbose, renderLog, devNotes, averages |
| `locationConfig` | geolocate, geoposition, map, leaflet tile layers |
| `scalesConfig` | rating scales (read-only, from factory fixtures) |

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
'plist>@xmldom/xmldom': ^0.8.11
```

`plist` is build-time only (never in the app bundle, never fed untrusted input),
so the 0.8 line is not an exposure. Everything else stays on 0.9.

### `window.electronAPI` is undefined in the packaged app

The preload was emitted under a name `electron/main.ts` does not load. Electron
accepts an ESM preload **only** when the file is named `.mjs`, and electron-vite
v5 defaults `entryFileNames` to `[name].js`; `electron.vite.config.ts` pins
`output: { format: 'es', entryFileNames: 'preload.mjs' }` for this reason.

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

| Gate | Scope before | Covers `electron/` now |
|---|---|---|
| `pnpm lint` | `eslint src e2e` | yes — `eslint src e2e electron` |
| `pnpm check-types` | `tsconfig.json` (`include: ["src"]`) | yes — third leg runs `electron/tsconfig.json` |
| `pnpm test` | vitest, `src/**` | no (by design — see below) |
| CI | no desktop job | yes — `.github/workflows/electron.yml` |

Unit tests deliberately do **not** cover the Electron entry points: main and
preload only do meaningful work inside a running Electron process, so a mocked
`ipcMain` would assert the mock. The desktop target is covered by Playwright
instead — the ecosystem's only DOM/E2E layer.

### Smoke suite (`e2e/electron/`)

Run with `pnpm test:electron`. Config: `e2e/playwright.electron.config.ts`
(separate from the web journeys — no `webServer`, no browser project, no retries).

| Spec | Guards |
|---|---|
| `build-contract.spec.ts` | Static assertions on build OUTPUT — `package.json#main` resolves, the preload filename `main.ts` loads is actually emitted, preload is `.mjs`, `index.html` asset paths stay relative, `version.json` is emitted |
| `app-launch.spec.ts` | Launches `dist-electron/main/main.js`: window opens, assets resolve under `file://`, TMX itself boots (`globalThis.dev`), no uncaught errors, and **no request fails against the `file://` origin** |
| `preload-bridge.spec.ts` | `window.electronAPI` is injected, exposes every method `PlatformAdapter` needs, and both IPC directions round-trip |
| `packaged-app.spec.ts` | The real `.app`/`.exe`/AppImage from electron-builder — boots from inside the asar, ships the preload, loads every bundled asset. Auto-skips unless `release/` exists |

Two habits keep this suite honest:

- **Cold profile per launch.** Every spec passes `--user-data-dir=<temp>`
  (`e2e/electron/helpers/userDataDir.ts`). Electron persists `userData` across
  runs, and a cached i18n manifest from a previous run silently disarmed the
  failed-request guard — the suite stayed green while a reverted fix was
  reintroduced. See architectural-standard A6.
- **Falsify the detector.** Every guard here was verified to report *dirty*, not
  just clean: reverting the preload fix fires 7 failures, reverting
  `staticAssetUrl` fires on `file:///fonts/catalog.json`, and reverting the
  `baseApi` fix fires on `file:///i18n/manifest`.

---

## Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Electron Shell | DONE | BrowserWindow, dev/prod loading, window persistence |
| 2. Platform Adapter | DONE | PlatformAdapter interface, web + electron implementations |
| 3. Config Migration | DONE | 10 typed modules, env shim, 36 files migrated |
| 4. Native Features | DONE | File dialogs, app menu, standalone UI, OS notifications, admin DevTools |
| 5. Distribution | PARTIAL | Build + package + CI + smoke suite done; **code signing, app icon, and auto-update still outstanding** |

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
