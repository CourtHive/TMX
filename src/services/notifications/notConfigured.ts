import { t } from 'i18n';
import { context } from 'services/context';

export function notConfigured(): void {
  context.modal.inform({ title: t('phrases.notconfigured') });
}
