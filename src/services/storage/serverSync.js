import { getLoginState } from 'services/authentication/loginState';
import { tmxToast } from 'services/notifications/tmxToast';
import { coms } from 'services/coms';

import { PROVIDER_CALENDAR } from 'constants/comsConstants';

export function serverSync() {
  const state = getLoginState();
  const providerId = state?.profile?.provider?.providerId;
  if (!providerId) return tmxToast({ message: 'No associated provider' });
  coms.emitTmx({ data: { action: PROVIDER_CALENDAR, payload: { providerId } } });
}
