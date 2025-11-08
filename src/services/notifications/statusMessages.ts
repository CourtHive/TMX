import { lang } from '../translator';
import { tmxToast } from './tmxToast';

export function updateReady(): void {
  const message = 'New Version Cached: Close Tab or Browser and Re-open to Update';
  tmxToast({ intent: 'is-success', message });
}

export function popupsBlocked(): void {
  const message = `${lang.tr('phrases.blocked')}. ${lang.tr('phrases.enablepopups')}`;
  tmxToast({ intent: 'is-danger', message });
}
