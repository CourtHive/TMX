import { getJwtTokenStorageKey } from 'config/localStorage';
import { tmxToast } from 'services/notifications/tmxToast';
import axios from 'axios';

const JWT_TOKEN_STORAGE_NAME = getJwtTokenStorageKey();
const baseURL = process.env.SERVER;
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

axiosInstance.interceptors.response.use(
  (response) => {
    if (response.data?.error) tmxToast({ message: response.data.error?.message, intent: 'is-danger' });
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

export const baseApi: any = {
  ...axiosInstance,
  addAuthorization,
  removeAuthorization,
};
