import { baseApi, authUrl } from 'services/apis/baseApi';

export async function submitSupportReport(payload: unknown) {
  const response = await baseApi.post('/support/reports', payload);
  if (!response?.data?.accepted || !response.data.reference) throw new Error('report-not-confirmed');
  return response.data;
}
export async function fetchSupportReceipt(reference: string) {
  const response = await baseApi.get(`/support/reports/${encodeURIComponent(reference)}`);
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
