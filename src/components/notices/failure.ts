import { tmxToast } from 'services/notifications/tmxToast';

export function failure(error) {
  tmxToast({ intent: 'is-danger', message: error?.message ?? 'Failure' });
}
