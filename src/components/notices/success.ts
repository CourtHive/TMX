import { tmxToast } from 'services/notifications/tmxToast';

export function success() {
  tmxToast({ intent: 'is-success', message: 'Success' });
}
