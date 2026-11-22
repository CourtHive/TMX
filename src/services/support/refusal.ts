import { supportText, type SupportKey } from 'services/support/text';

/**
 * CFS names the reason for every refused support request (`code` beside the status, competition-factory-server
 * #1304). The report dialog shows it inline, where the reporter is; before this a refusal raised a global toast that
 * sat behind the modal dialog and offered "Report a problem" for the report itself.
 */
const BY_CODE: Record<string, SupportKey> = {
  SUPPORT_NO_SESSION_PROVIDER: 'noProvider',
  SUPPORT_PROVIDER_NOT_PERMITTED: 'notPermitted',
  SUPPORT_INTAKE_DISABLED: 'disabled',
  SUPPORT_SESSION_CHANGED: 'changed',
};

export function refusalText(error: any): string {
  const data = error?.response?.data;
  const key = typeof data?.code === 'string' ? BY_CODE[data.code] : undefined;
  if (key) return supportText(key);
  // An unmapped refusal keeps the generic promise and, when the server named one, its reason for diagnosis.
  const reason = typeof data?.message === 'string' && data.message.length <= 160 ? data.message : '';
  return reason ? `${supportText('failed')} (${reason})` : supportText('failed');
}
