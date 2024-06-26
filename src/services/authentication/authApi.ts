import { baseApi } from '../apis/baseApi';

export async function systemLogin(email, password) {
  return baseApi.post('/auth/login', {
    password,
    email,
  });
}

export async function inviteUser(email, providerId, roles, permissions, services) {
  return baseApi.post('/auth/invite', {
    permissions,
    providerId,
    services,
    email,
    roles,
  });
}

export async function systemRegister(firstName, lastName, password, code) {
  return baseApi.post('/auth/register', {
    firstName,
    lastName,
    password,
    code,
  });
}

export async function setPassword(password, setPasswordToken) {
  return baseApi.post('/auth/set-password', {
    setPasswordToken,
    password,
  });
}

export async function confirmEmail(emailConfirmationId) {
  return baseApi.get(`/auth/confirm/${emailConfirmationId}`);
}

export async function forgotPassword(email) {
  return baseApi.post('/auth/forgot-password', { email });
}

export async function resetPassword(email, password, code) {
  return baseApi.post('/auth/reset-password', { email, password, code });
}
