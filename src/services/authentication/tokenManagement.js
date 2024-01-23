import { getJwtTokenStorageKey } from 'config/localStorage';

const JWT_TOKEN_STORAGE_NAME = getJwtTokenStorageKey();

export function removeToken() {
  localStorage.removeItem(JWT_TOKEN_STORAGE_NAME);
}

export function getToken() {
  return localStorage.getItem(JWT_TOKEN_STORAGE_NAME);
}

export function setToken(token) {
  localStorage.setItem(JWT_TOKEN_STORAGE_NAME, token);
}
