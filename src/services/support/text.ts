import { t } from 'i18n';

type SupportKey =
  | 'help'
  | 'report'
  | 'title'
  | 'description'
  | 'expected'
  | 'steps'
  | 'send'
  | 'close'
  | 'explanation'
  | 'promise'
  | 'settings'
  | 'accepted'
  | 'pending'
  | 'verified'
  | 'failed'
  | 'changed'
  | 'isolated'
  | 'tooLong'
  | 'login'
  | 'receipt'
  | 'status'
  | 'accountTitle'
  | 'accountExplanation'
  | 'accountEmail'
  | 'accountSave'
  | 'accountResend'
  | 'accountMissing'
  | 'accountSaved'
  | 'accountFailed'
  | 'emailNone'
  | 'emailPending'
  | 'emailAwaiting'
  | 'emailAccepted'
  | 'emailFailed'
  | 'deliveryUnknown'
  | 'deliveryNotSent';

export function supportText(key: SupportKey, values: Record<string, unknown> = {}): string {
  return t(`supportReports.${key}`, values);
}
