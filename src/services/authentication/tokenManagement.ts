import { getJwtTokenStorageKey, getRefreshTokenStorageKey } from 'config/localStorage';

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
