/**
 * A single "refresh to load a newer deploy" prompt, shared by the two version
 * checks so a situation that trips both — the SPA-freshness check
 * (`checkTmxVersion`) and the factory client/server mismatch check
 * (`checkFactoryVersion`) — surfaces exactly one refresh toast instead of two.
 *
 * The prompt is only shown when a refresh will actually change what loads (a
 * newer aligned deploy exists); callers must not use this for an unresolvable
 * mismatch, where a reload is futile.
 */
import { tmxToast } from 'services/notifications/tmxToast';

let prompted = false;

export function promptRefresh(message: string): void {
  if (prompted) return;
  prompted = true;
  console.warn('[version]', message);
  tmxToast({
    intent: 'is-info',
    duration: 0,
    dismissible: true,
    pauseOnHover: true,
    message,
    action: { text: 'Refresh', onClick: () => globalThis.location.reload() },
  });
}

export function resetRefreshPrompt(): void {
  prompted = false;
}
