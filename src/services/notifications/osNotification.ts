/**
 * OS-level desktop notifications.
 *
 * Uses the Web Notifications API, which works in both browser (with permission)
 * and Electron (without permission prompt). Gated by a user preference.
 */

const PREF_KEY = 'tmx_desktop_notifications';

export function isDesktopNotificationsEnabled(): boolean {
  return localStorage.getItem(PREF_KEY) === 'true';
}

export function setDesktopNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(PREF_KEY, String(enabled));
}

export function showOSNotification({
  title,
  body,
  onClick,
}: {
  title: string;
  body?: string;
  onClick?: () => void;
}): void {
  if (!isDesktopNotificationsEnabled()) return;
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    const n = new Notification(title, { body });
    if (onClick) n.onclick = onClick;
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        const n = new Notification(title, { body });
        if (onClick) n.onclick = onClick;
      }
    });
  }
}
