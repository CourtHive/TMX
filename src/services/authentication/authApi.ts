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

export async function ssoLoginWithToken(token: string) {
  return baseApi.post('/auth/sso/login-with-token', { token });
}

export async function completeFirstLogin(limitedToken: string, newPassword: string) {
  return baseApi.post('/auth/complete-first-login', { limitedToken, newPassword });
}

/**
 * Server-side revocation of a refresh token on logout. Idempotent and best-effort
 * — failures are silenced so logout always completes locally. The access-token
 * refresh itself lives in baseApi (refreshAccessToken) to avoid an import cycle.
 */
export async function revokeRefreshToken(refreshToken: string) {
  return baseApi.post('/auth/logout', { refreshToken }, { silenceErrors: true });
}
