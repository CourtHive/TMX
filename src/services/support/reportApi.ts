import { baseApi, authUrl } from 'services/apis/baseApi';

export async function submitSupportReport(payload: unknown) {
  // rejectErrors: the dialog shows CFS's refusal reason inline instead of a global toast behind the modal.
  const response = await baseApi.post('/support/reports', payload, { rejectErrors: true } as any);
  if (!response?.data?.accepted || !response.data.reference) throw new Error('report-not-confirmed');
  return response.data;
}
export type SupportCapability = {
  available: boolean;
  reason?: string;
  scope?: 'provider' | 'platform';
  providerId?: string;
};

/**
 * What CFS will accept from this session (competition-factory-server #1309), asked before the form can send so it
 * never shows a form that is refused afterwards. `provider` is the selected or impersonated provider: CFS uses it only
 * for a super-admin, whose impersonation lives in the client.
 */
export async function fetchSupportCapability(provider?: string): Promise<SupportCapability> {
  const query = provider ? `?provider=${encodeURIComponent(provider)}` : '';
  const response = await baseApi.get(`/support/capability${query}`, { rejectErrors: true } as any);
  if (typeof response?.data?.available !== 'boolean') throw new Error('capability-unavailable');
  return response.data;
}

export async function fetchSupportReceipt(reference: string) {
  const response = await baseApi.get(`/support/reports/${encodeURIComponent(reference)}`, {
    rejectErrors: true,
  } as any);
  if (!response?.data?.accepted) throw new Error('receipt-not-confirmed');
  return response.data;
}

export async function accountContactRequest(action: 'read' | 'set' | 'resend', contactEmail?: string) {
  const response =
    action === 'read'
      ? await baseApi.get(authUrl('/auth/me'))
      : await baseApi.post(
          authUrl(action === 'set' ? '/account/contact-email/set' : '/account/contact-email/resend-verification'),
          action === 'set' ? { contactEmail } : {},
        );
  if (!response?.data || response.data.error || (action !== 'read' && !response.data.success))
    throw new Error('account-contact-unavailable');
  return response.data;
}
