import { lang } from '../translator';
import { context } from 'services/context';

export function notConfigured() {
  context.modal.inform({ title: lang.tr('phrases.notconfigured') });
}
