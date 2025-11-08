import { getJwtTokenStorageKey } from 'config/localStorage';

const JWT_TOKEN_STORAGE_NAME = getJwtTokenStorageKey();

export function removeToken(): void {
  localStorage.removeItem(JWT_TOKEN_STORAGE_NAME);
}

export function getToken(): string | null {
  return localStorage.getItem(JWT_TOKEN_STORAGE_NAME);
}

export function setToken(token: string): void {
  localStorage.setItem(JWT_TOKEN_STORAGE_NAME, token);
}
