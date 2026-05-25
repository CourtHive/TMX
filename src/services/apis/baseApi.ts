import { getJwtTokenStorageKey, getRefreshTokenStorageKey } from 'config/localStorage';
import { tmxToast } from 'services/notifications/tmxToast';
import axios from 'axios';

const JWT_TOKEN_STORAGE_NAME = getJwtTokenStorageKey();
const REFRESH_TOKEN_STORAGE_NAME = getRefreshTokenStorageKey();
const baseURL = process.env.SERVER || globalThis.location?.origin || '';
console.log('[baseApi] server URL:', baseURL);
const axiosInstance = axios.create({ baseURL });

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(JWT_TOKEN_STORAGE_NAME);
    if (token) config.headers.Authorization = `Bearer ${token}`;

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Endpoints that mint or revoke tokens must never trigger a refresh-on-401:
// the refresh would recurse, and a wrong-password login legitimately 401s.
const AUTH_ENDPOINTS = [
  '/auth/refresh',
  '/auth/login',
  '/auth/logout',
  '/auth/complete-first-login',
  '/auth/sso/login-with-token',
];
const isAuthEndpoint = (url?: string): boolean => !!url && AUTH_ENDPOINTS.some((p) => url.includes(p));

// Single-flight: concurrent 401s share one in-flight refresh so the refresh
// token is rotated exactly once. Two racing refreshes would present the same
// token twice, and the server's reuse-detection would burn the whole family.
let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_NAME);
  if (!refreshToken) return null;
  try {
    const { data } = await axiosInstance.post('/auth/refresh', { refreshToken }, { silenceErrors: true } as any);
    if (data?.token) {
      localStorage.setItem(JWT_TOKEN_STORAGE_NAME, data.token);
      // Rotation: the server returns a fresh refresh token on every refresh.
      if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_STORAGE_NAME, data.refreshToken);
      addAuthorization();
      return data.token;
    }
  } catch {
    /* fall through → null (caller handles logout) */
  }
  return null;
}

/**
 * Silently exchange the stored refresh token for a fresh access token. Returns
 * the new access token or null. Coalesces concurrent callers into one request.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

axiosInstance.interceptors.response.use(
  (response) => {
    if (response.data?.error && !(response.config as any)?.silenceErrors) {
      tmxToast({ message: response.data.error?.message, intent: 'is-danger' });
    }
    return response;
  },
  async (error) => {
    const original = error.config;
    const silenceErrors = (original as any)?.silenceErrors;

    // Access token expired (or otherwise rejected): attempt one silent refresh
    // and replay the original request before surfacing any error to the user.
    if (error.response?.status === 401 && original && !(original as any)._retried && !isAuthEndpoint(original.url)) {
      (original as any)._retried = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(original);
      }
      // No refresh token, or it was expired / rotated away → full logout.
      // Lazy import avoids a static cycle (loginState → authApi → baseApi).
      removeAuthorization();
      const { logOut } = await import('services/authentication/loginState');
      logOut();
      return;
    }

    if (error.message === 'Network Error' && !silenceErrors) {
      tmxToast({ message: error.message, intent: 'is-danger' });
    }
    if (error.response) {
      if (error.response?.status === 401) removeAuthorization();
      if (!silenceErrors) {
        const message = error.response.data.message || error.response.data.error || error.response.data;
        tmxToast({ message, intent: 'is-danger' });
      }
    }
    // Preserve the pre-existing contract: rejected requests resolve to
    // `undefined` (errors are surfaced via toasts), not a rejected promise.
    return undefined;
  },
);

const addAuthorization = () => {
  const token = localStorage.getItem(JWT_TOKEN_STORAGE_NAME);
  axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`;
};

const removeAuthorization = () => {
  axiosInstance.defaults.headers.common.Authorization = undefined;
};

export function setBaseURL(url: string): void {
  axiosInstance.defaults.baseURL = url;
  console.log(`[baseApi] server URL changed to: ${url}`);
}

export function getBaseURL(): string {
  return axiosInstance.defaults.baseURL ?? '';
}

export const baseApi: any = {
  ...axiosInstance,
  addAuthorization,
  removeAuthorization,
  refreshAccessToken,
};
