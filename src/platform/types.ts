/**
 * Platform abstraction layer.
 *
 * Defines the interface that web and Electron implementations must satisfy.
 * This keeps platform-specific concerns out of application code.
 */

export type PlatformType = 'web' | 'electron';

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface OpenDialogOptions {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  multiple?: boolean;
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

  /** Native save dialog — returns file path or undefined if cancelled */
  showSaveDialog?(options: SaveDialogOptions): Promise<string | undefined>;

  /** Native open dialog — returns file paths or undefined if cancelled */
  showOpenDialog?(options: OpenDialogOptions): Promise<string[] | undefined>;

  /** Read a file from disk (Electron only) */
  readFile?(filePath: string): Promise<Uint8Array>;

  /** Write a file to disk (Electron only) */
  writeFile?(filePath: string, data: Uint8Array): Promise<void>;

  /** Get the app's user data directory (Electron only) */
  getAppDataPath?(): string;

  /** Persist server URL preference (Electron only) */
  setServerUrl?(url: string): Promise<void>;

  /** Toggle Chrome DevTools (Electron only) */
  toggleDevTools?(): Promise<void>;

  /** Register a handler for application menu actions (Electron only) */
  onMenuAction?(callback: (action: string) => void): void;
}
