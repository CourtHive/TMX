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
 * via setScoreRelayURL at runtime) → derived from the factory server URL. The
 * crowd surface is ON by default (a relay base always resolves); a provider
 * turns it off via `settings.crowdScoring.enabled = false` — see
 * `isCrowdScoringEnabled` below.
 */

import { resolveCrowdScoringEnabled } from '@courthive/provider-config';
import { getJwtTokenStorageKey } from 'config/localStorage';
import { tmxToast } from 'services/notifications/tmxToast';
import { providerConfig } from 'config/providerConfig';
import { serverConfig } from 'config/serverConfig';
import axios from 'axios';
import { t } from 'i18n';

const JWT_TOKEN_STORAGE_NAME = getJwtTokenStorageKey();

/**
 * Derive the crowd-relay REST base from the factory server URL, mirroring the
 * websocket resolver in `services/messaging/scoreRelay.ts`:
 *   - localhost dev → the standalone relay on `:8384`
 *   - prod → `${serverUrl}/relay` (nginx strips `/relay/` → relay :8384, so
 *     REST paths land as `/api/crowd-sessions`)
 * Returns '' only when no server URL is resolvable (e.g. non-browser test env).
 */
function deriveRelayBaseURL(): string {
  const fromServer = serverConfig.get().socketPath;
  const serverUrl = fromServer || (typeof window === 'undefined' ? '' : window.location.origin);
  if (!serverUrl) return '';
  try {
    const url = new URL(serverUrl);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.port = '8384';
      return url.origin;
    }
  } catch {
    // Not a valid URL — fall through to the nginx-proxied prod path
  }
  return `${serverUrl}/relay`;
}

/**
 * Values that mean "this deployment has no relay", as opposed to "no relay was
 * configured, derive one". Vite inlines `import.meta.env` at build time and
 * gives a build no way to express an empty string distinguishable from an unset
 * variable, so a container image that runs without a relay needs a word rather
 * than a blank to turn the derivation off.
 */
const DISABLED_SENTINELS = new Set(['disabled', 'false', 'off']);

/**
 * Resolve an explicit relay setting.
 *
 * - `undefined` — nothing was configured; the caller should derive a default.
 * - `''` — deliberately disabled; the caller should NOT derive a default.
 * - anything else — the configured base URL, trimmed, without a trailing slash.
 */
export function resolveExplicitRelayURL(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const configured = value.trim();
  if (DISABLED_SENTINELS.has(configured.toLowerCase())) return '';
  return configured ? configured.replace(/\/+$/, '') : undefined;
}

function resolveInitialBaseURL(): string {
  const fromVite = resolveExplicitRelayURL((import.meta as any)?.env?.VITE_SCORE_RELAY_URL);
  if (fromVite !== undefined) return fromVite;
  const fromProcess = typeof process === 'undefined' ? undefined : process.env?.SCORE_RELAY_URL;
  const explicitProcessURL = resolveExplicitRelayURL(fromProcess);
  if (explicitProcessURL !== undefined) return explicitProcessURL;
  return deriveRelayBaseURL();
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
        tmxToast({ message: t('scoreRelay.networkError'), intent: 'is-danger' });
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

/**
 * Whether the crowd poll/promote surface should be active: the relay must be
 * reachable AND the provider must not have disabled crowd scoring. ON by
 * default — a provider opts out via `settings.crowdScoring.enabled = false`
 * (resolved through `@courthive/provider-config`). Evaluated per call so it
 * reflects the provider config once it loads after boot.
 */
export function isCrowdScoringEnabled(): boolean {
  return isScoreRelayConfigured() && resolveCrowdScoringEnabled(providerConfig.get());
}

export const scoreRelayApi: any = axiosInstance;
