import { AppToaster } from 'services/notifications/toaster';
import { getJwtTokenStorageKey } from 'config/localStorage';
import axios from 'axios';

const JWT_TOKEN_STORAGE_NAME = getJwtTokenStorageKey();

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_HIVE_SERVER_URL
});

axiosInstance.interceptors.request.use(
  (config) => {
    addAuthorization(config);
    return config;
  },
  (error) => {
    AppToaster.show({
      icon: 'error',
      intent: 'danger',
      message: error.message
    });
    return error;
  }
);

axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.message === 'Network Error') {
      AppToaster.show({
        icon: 'error',
        intent: 'danger',
        message: error.message
      });
    }
    if (error.response) {
      if (error.response.status === 401) {
        removeAuthorization();
        // Unauthorized error has occured! Logout user from app and do a cleanup.
      }
      const message = error.response.data.message || error.response.data.error || error.response.data;
      AppToaster.show({
        icon: 'error',
        intent: 'danger',
        message
      });
    }
  }
);

const addAuthorization = (config) => {
  const token = localStorage.getItem(JWT_TOKEN_STORAGE_NAME);
  if (token) config.headers.Authorization = `Bearer ${token}`;
};

const removeAuthorization = () => {
  axiosInstance.defaults.headers.common.Authorization = undefined;
};

export const baseApi = {
  ...axiosInstance,
  addAuthorization,
  removeAuthorization
};
