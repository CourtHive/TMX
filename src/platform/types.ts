/**
 * Platform abstraction layer.
 *
 * Defines the interface that web and Electron implementations must satisfy.
 * This keeps platform-specific concerns out of application code.
 */

export type PlatformType = 'web' | 'electron';

export interface FileFilter {
  name: string;
  extensions: string[];
}

/** The main process shows the save dialog and writes `data`; the chosen path never comes back. */
export interface SaveFileRequest {
  title?: string;
  /** A bare file name to pre-fill; any directory part is dropped. */
  defaultName?: string;
  filters: FileFilter[];
  data: Uint8Array;
}

export interface OpenFilesRequest {
  title?: string;
  filters: FileFilter[];
  multiple?: boolean;
}

export interface OpenedFile {
  name: string;
  data: Uint8Array;
}

export interface PlatformAdapter {
  readonly type: PlatformType;

  /** Whether the platform can access the local file system (native dialogs) */
  canAccessFileSystem(): boolean;

  /** Whether the platform supports auto-update */
  canAutoUpdate(): boolean;

  /** Whether the app is running as a standalone desktop app (not in a browser tab) */
  isDesktop(): boolean;

  /** Resolve the default server URL for Socket.IO connection */
  getDefaultServerUrl(): string;

  /** Save through a native dialog (Electron only) — resolves `{ saved: false }` when cancelled */
  saveFile?(request: SaveFileRequest): Promise<{ saved: boolean }>;

  /** Open files through a native dialog (Electron only) — undefined when cancelled */
  openFiles?(request: OpenFilesRequest): Promise<OpenedFile[] | undefined>;

  /** Persist the server URL (Electron only) — the user confirms a change; refused URLs are not saved */
  setServerUrl?(url: string): Promise<{ saved: boolean }>;

  /** Toggle Chrome DevTools (Electron only) */
  toggleDevTools?(): Promise<void>;

  /** Register a handler for application menu actions (Electron only) */
  onMenuAction?(callback: (action: string) => void): void;
}
