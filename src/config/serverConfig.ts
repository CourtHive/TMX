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
}

const defaults: ServerConfig = {
  serverFirst: true,
  serverTimeout: 10_000,
  saveLocal: false,
  socketPath: '',
  socketIo: { tmx: '/tmx' },
  assistantUrl: import.meta.env.VITE_ASSISTANT_URL ?? '',
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
