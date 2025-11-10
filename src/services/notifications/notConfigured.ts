import { lang } from '../translator';
import { context } from 'services/context';

export function notConfigured(): void {
  context.modal.inform({ title: lang.tr('phrases.notconfigured') });
}
