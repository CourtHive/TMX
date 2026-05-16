/**
 * Score-relay REST client — Phase 4 / crowd promotion UI.
 *
 * Score-relay is a separate process (different host:port than CFS) that owns
 * crowd-scoring data per Mentat Decision 6. TMX talks to its slice-3 REST API
 * (epixodic@7c3e173) for the TD-facing promote / demote / cancel flows.
 *
 * This module mirrors baseApi.ts on purpose: same JWT bearer pulled from
 * localStorage['tmxToken'], same toast-on-error pattern, same shape of the
 * exported handle. The only difference is the baseURL.
 *
 * Config order: `VITE_SCORE_RELAY_URL` (build-time) → `SCORE_RELAY_URL` (set
 * via setScoreRelayURL at runtime) → empty (disables the client).
 */

import { getJwtTokenStorageKey } from 'config/localStorage';
import { tmxToast } from 'services/notifications/tmxToast';
import axios from 'axios';

const JWT_TOKEN_STORAGE_NAME = getJwtTokenStorageKey();

function resolveInitialBaseURL(): string {
  const fromVite = (import.meta as any)?.env?.VITE_SCORE_RELAY_URL;
  if (typeof fromVite === 'string' && fromVite.trim()) return fromVite.trim().replace(/\/+$/, '');
  const fromProcess = typeof process !== 'undefined' ? process.env?.SCORE_RELAY_URL : undefined;
  if (typeof fromProcess === 'string' && fromProcess.trim()) return fromProcess.trim().replace(/\/+$/, '');
  return '';
}

const initialBaseURL = resolveInitialBaseURL();
if (initialBaseURL) console.log('[scoreRelayApi] score-relay URL:', initialBaseURL);
else console.log('[scoreRelayApi] score-relay disabled (set VITE_SCORE_RELAY_URL to enable)');

const axiosInstance = axios.create({ baseURL: initialBaseURL });

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(JWT_TOKEN_STORAGE_NAME);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const silent = (error.config as any)?.silenceErrors;
    if (!silent) {
      if (error.message === 'Network Error') {
        tmxToast({ message: 'score-relay: network error', intent: 'is-danger' });
      } else if (error.response) {
        const message =
          error.response.data?.error ||
          error.response.data?.message ||
          error.response.data ||
          `score-relay: HTTP ${error.response.status}`;
        tmxToast({ message: String(message), intent: 'is-danger' });
      }
    }
    return Promise.reject(error);
  },
);

export function setScoreRelayURL(url: string): void {
  axiosInstance.defaults.baseURL = url.replace(/\/+$/, '');
  console.log(`[scoreRelayApi] score-relay URL changed to: ${axiosInstance.defaults.baseURL}`);
}

export function getScoreRelayURL(): string {
  return axiosInstance.defaults.baseURL ?? '';
}

export function isScoreRelayConfigured(): boolean {
  return !!axiosInstance.defaults.baseURL;
}

export const scoreRelayApi: any = axiosInstance;
