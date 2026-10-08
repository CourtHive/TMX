/**
 * Server and Socket.IO configuration.
 */
import { platform } from 'platform';

export interface ServerConfig {
  serverFirst: boolean;
  serverTimeout: number;
  saveLocal: boolean;
  socketPath: string;
  socketIo: { tmx: string };
  assistantUrl: string;
  /**
   * Send commands (`executionQueue`, chat) over HTTP instead of the socket, which then carries only
   * subscriptions and server push. Realtime transport Phase 1. On by default since 2026-10-08 (CA);
   * build with `VITE_COMMANDS_OVER_HTTP=false` to keep everything on the socket.
   */
  commandsOverHttp: boolean;
}

/** On unless the build says `false`. Exported for its test. */
export function commandsOverHttpDefault(value: string | undefined): boolean {
  return value !== 'false';
}

const defaults: ServerConfig = {
  serverFirst: true,
  serverTimeout: 10_000,
  saveLocal: false,
  socketPath: '',
  socketIo: { tmx: '/tmx' },
  assistantUrl: import.meta.env.VITE_ASSISTANT_URL ?? '',
  commandsOverHttp: commandsOverHttpDefault(import.meta.env.VITE_COMMANDS_OVER_HTTP),
};

let current: ServerConfig | undefined;

function ensureInit(): ServerConfig {
  if (!current) {
    current = { ...defaults, socketPath: platform.getDefaultServerUrl() };
  }
  return current;
}

export const serverConfig = {
  get: (): Readonly<ServerConfig> => ensureInit(),
  set: (partial: Partial<ServerConfig>) => {
    current = { ...ensureInit(), ...partial };
  },
  reset: () => {
    current = { ...defaults, socketPath: platform.getDefaultServerUrl() };
  },
} as const;
