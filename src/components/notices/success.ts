import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

export function success() {
  tmxToast({ intent: 'is-success', message: t('common.success') });
}
