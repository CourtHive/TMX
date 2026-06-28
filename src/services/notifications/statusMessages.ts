import { tmxToast } from './tmxToast';
import { t } from 'i18n';

export function updateReady(): void {
  const message = 'New Version Cached: Close Tab or Browser and Re-open to Update';
  tmxToast({ intent: 'is-success', message });
}

export function popupsBlocked(): void {
  const message = `${t('phrases.blocked')}. ${t('phrases.enablepopups')}`;
  tmxToast({ intent: 'is-danger', message });
}
