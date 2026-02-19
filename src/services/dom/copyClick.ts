/**
 * Copy text to clipboard using modern clipboard API.
 */
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

export async function copyClick(message: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(message);
    tmxToast({ message: t('toasts.copiedToClipboard'), intent: 'is-success' });
  } catch (err) {
    tmxToast({ message: String(err), intent: 'is-danger' });
  }
}
