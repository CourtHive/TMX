import { context } from 'services/context';
import { t } from 'i18n';

export function notConfigured(): void {
  context.modal.inform({ title: t('phrases.notconfigured') });
}
