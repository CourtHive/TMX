import { getJwtTokenStorageKey } from 'config/localStorage';
import { tmxToast } from 'services/notifications/tmxToast';
import { env } from 'settings/env';
import axios from 'axios';

const JWT_TOKEN_STORAGE_NAME = getJwtTokenStorageKey();
const local = window.location.host.includes('localhost') || window.location.hostname === '127.0.0.1';
const baseURL = env.baseURL || local ? 'http://localhost:8383' : 'https://courthive.net';
const axiosInstance = axios.create({ baseURL });

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(JWT_TOKEN_STORAGE_NAME);
    if (token) config.headers.common.Authorization = `Bearer ${token}`;

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.message === 'Network Error') {
      tmxToast({ message: error.message, intent: 'is-danger' });
    }
    if (error.response) {
      if (error.response?.status === 401) removeAuthorization();
      const message = error.response.data.message || error.response.data.error || error.response.data;
      tmxToast({ message, intent: 'is-danger' });
    }
  },
);

const addAuthorization = () => {
  const token = localStorage.getItem(JWT_TOKEN_STORAGE_NAME);
  axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`;
};

const removeAuthorization = () => {
  axiosInstance.defaults.headers.common.Authorization = undefined;
};

export const baseApi = {
  ...axiosInstance,
  addAuthorization,
  removeAuthorization,
};
