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
  /**
   * Where tournament chat lives (Mentat/planning/CHAT_TO_AMS.md). `'ams'`: courthive-ams stores it and score-relay's
   * `/chat` delivers it, and CFS is not in the path. `'cfs'`: CFS's `POST /tmx/chat` and its `/tmx` socket, kept for
   * one release so a bad deploy reverts by configuration; removed with CFS's chat (phase 4).
   */
  chatBackend: 'ams' | 'cfs';
}

const defaults: ServerConfig = {
  serverFirst: true,
  serverTimeout: 10_000,
  saveLocal: false,
  socketPath: '',
  socketIo: { tmx: '/tmx' },
  chatBackend: 'ams',
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
