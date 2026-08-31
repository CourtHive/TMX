/**
 * Link entry modal for updating values.
 * Renders form with existing value and callback on update.
 */
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

type EnterLinkParams = {
  title: string;
  existingValue?: string;
  callback?: (value: string) => void;
  message?: string;
};

export function enterLink({ title, existingValue, callback, message }: EnterLinkParams): void {
  const onClick = ({ content }: any) => {
    const newValue = content?.newValue.value;
    if (isFunction(callback) && callback) callback(newValue);
  };

  const content = (elem: HTMLElement) =>
    renderForm(elem, [
      { text: message },
      {
        value: existingValue,
        label: t('ui.newValue'),
        field: 'newValue',
      },
    ]);

  openModal({
    title,
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('modals.editProvider.update'), intent: 'is-primary', onClick: onClick as any, close: true },
    ],
  });
}
