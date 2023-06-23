import { baseApi } from '../apis/baseApi';

export async function systemLogin(email, password) {
  return baseApi.post('/auth/login', {
    password,
    email
  });
}

export async function systemRegister(preferredFamilyName, preferredGivenName, inviteKey, email, password) {
  return baseApi.post('/auth/register', {
    preferredFamilyName,
    preferredGivenName,
    inviteKey,
    password,
    email
  });
}

export async function setPassword(password, setPasswordToken) {
  return baseApi.post('/auth/set-password', {
    setPasswordToken,
    password
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
