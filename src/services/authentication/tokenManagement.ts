import { getJwtTokenStorageKey, getRefreshTokenStorageKey } from 'config/localStorage';
import { jwtDecode } from 'jwt-decode';

const JWT_TOKEN_STORAGE_NAME = getJwtTokenStorageKey();
const REFRESH_TOKEN_STORAGE_NAME = getRefreshTokenStorageKey();

export function removeToken(): void {
  localStorage.removeItem(JWT_TOKEN_STORAGE_NAME);
}

export function getToken(): string | null {
  return localStorage.getItem(JWT_TOKEN_STORAGE_NAME);
}

export function setToken(token: string): void {
  localStorage.setItem(JWT_TOKEN_STORAGE_NAME, token);
}

export function removeRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_NAME);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_NAME);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_STORAGE_NAME, token);
}

/**
 * Whether an access token is past (or within `skewSeconds` of) its `exp`. An undecodable token, or one without `exp`,
 * is NOT reported expired: callers use this to decide whether a refresh can help, and refreshing cannot fix a token
 * that is malformed or refused for another reason.
 */
export function isAccessTokenExpired(token: string | null | undefined, nowMs = Date.now(), skewSeconds = 30): boolean {
  if (!token) return false;
  try {
    const { exp } = jwtDecode<{ exp?: number }>(token);
    return typeof exp === 'number' && exp - skewSeconds <= nowMs / 1000;
  } catch {
    return false;
  }
}
