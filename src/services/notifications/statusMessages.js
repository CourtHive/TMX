import { lang } from '../translator';
import { tmxToast } from './tmxToast';

export function updateReady() {
  let message = 'New Version Cached: Close Tab or Browser and Re-open to Update';
  tmxToast({ intent: 'is-success', message });
}

export function popupsBlocked() {
  let message = `${lang.tr('phrases.blocked')}. ${lang.tr('phrases.enablepopups')}`;
  return tmxToast({ intent: 'is-danger', message });
}
/*
function enableNotifications() {
    // TODO: future, once server and service workers implemented...
    // Notification.requestPermission(granted => { env.notifications = granted; });
}
*/
