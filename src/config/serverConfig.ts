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
   * Send commands (`executionQueue`) as `POST /factory` instead of over the socket, which then
   * carries only subscriptions and server push. Realtime transport Phase 1; off by default.
   */
  commandsOverHttp: boolean;
}

const defaults: ServerConfig = {
  serverFirst: true,
  serverTimeout: 10_000,
  saveLocal: false,
  socketPath: '',
  socketIo: { tmx: '/tmx' },
  assistantUrl: import.meta.env.VITE_ASSISTANT_URL ?? '',
  commandsOverHttp: import.meta.env.VITE_COMMANDS_OVER_HTTP === 'true',
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
